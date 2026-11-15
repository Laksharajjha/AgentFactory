import asyncio
import hashlib
import io
import os
import sys
import tempfile
import uuid
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from botocore.exceptions import ClientError

from app.artifacts.artifact_storage import ArtifactStorage, ArtifactStorageError
from app.config import settings


class _FakeBody:
    def __init__(self, data: bytes) -> None:
        self._stream = io.BytesIO(data)

    def read(self) -> bytes:
        return self._stream.read()


class _FakeS3Client:
    """In-memory S3-compatible stub for deterministic unit & failure-handling tests."""

    def __init__(self, fail_next_op: bool = False) -> None:
        self.objects: dict[tuple[str, str], dict] = {}
        self.fail_next_op = fail_next_op

    def _maybe_fail(self, op: str) -> None:
        if self.fail_next_op:
            self.fail_next_op = False
            raise ClientError(
                {"Error": {"Code": "InternalError", "Message": f"Simulated {op} failure"}},
                op,
            )

    def put_object(self, *, Bucket: str, Key: str, Body: bytes, ContentType: str = "", Metadata: dict | None = None):
        self._maybe_fail("PutObject")
        self.objects[(Bucket, Key)] = {
            "Body": Body,
            "ContentType": ContentType,
            "Metadata": Metadata or {},
            "Size": len(Body),
        }
        return {"ETag": f'"{hashlib.md5(Body).hexdigest()}"'}

    def get_object(self, *, Bucket: str, Key: str):
        self._maybe_fail("GetObject")
        item = self.objects.get((Bucket, Key))
        if item is None:
            raise ClientError({"Error": {"Code": "NoSuchKey", "Message": "The specified key does not exist."}}, "GetObject")
        return {"Body": _FakeBody(item["Body"]), "ContentType": item["ContentType"]}

    def delete_object(self, *, Bucket: str, Key: str):
        self._maybe_fail("DeleteObject")
        self.objects.pop((Bucket, Key), None)
        return {}

    def list_objects_v2(self, *, Bucket: str, Prefix: str = "", MaxKeys: int = 1000):
        self._maybe_fail("ListObjectsV2")
        contents = []
        for (b, k), item in sorted(self.objects.items()):
            if b == Bucket and (not Prefix or k.startswith(Prefix)):
                contents.append({"Key": k, "Size": item["Size"], "ETag": '"fake-etag"'})
                if len(contents) >= MaxKeys:
                    break
        return {"Contents": contents, "KeyCount": len(contents)}

    def generate_presigned_url(self, ClientMethod: str, *, Params: dict, ExpiresIn: int):
        self._maybe_fail("GeneratePresignedUrl")
        return f"https://s3.stub.local/{Params['Bucket']}/{Params['Key']}?X-Amz-Expires={ExpiresIn}"


def run_mocked_s3_tests() -> None:
    fake_s3 = _FakeS3Client()
    storage = ArtifactStorage(
        backend="s3",
        bucket="forge-artifacts",
        endpoint_url="https://s3.stub.local",
        region="ap-southeast-1",
        access_key="nak_test_dummy",
        secret_key="nsk_test_dummy",
        s3_client=fake_s3,
    )
    assert storage.backend_mode == "s3"

    # 1. Workspace-scoped key construction & upload
    key_a = storage.build_storage_key("ten_a", "ws_a", "art_1", 1, "report final.pdf")
    key_b = storage.build_storage_key("ten_b", "ws_b", "art_2", 1, "secret.pdf")
    assert key_a == "tenants/ten_a/workspaces/ws_a/artifacts/art_1/v1/report_final.pdf"
    assert key_b.startswith("tenants/ten_b/workspaces/ws_b/artifacts/")

    data_a = b"%PDF-1.4 workspace-a-content"
    data_b = b"%PDF-1.4 workspace-b-content"
    size_a, sha_a = storage.put_bytes(key_a, data_a, content_type="application/pdf")
    storage.put_bytes(key_b, data_b, content_type="application/pdf")
    assert size_a == len(data_a)
    assert sha_a == hashlib.sha256(data_a).hexdigest()
    print("PASS [MOCKED 1/6]: S3 upload & SHA-256 metadata verified")

    # 2. Download & prefix-scoped listing (workspace isolation)
    assert storage.get_bytes(key_a) == data_a
    ws_a_objs = storage.list_objects(prefix="tenants/ten_a/workspaces/ws_a/artifacts/")
    assert len(ws_a_objs) == 1 and ws_a_objs[0]["key"] == key_a
    print("PASS [MOCKED 2/6]: S3 download & workspace-prefix listing isolation verified")

    # 3. Presigned URL generation & HMAC download URL
    presigned_url, exp = storage.create_presigned_object_url(key_a, ttl_seconds=120, filename="report.pdf")
    assert "forge-artifacts" in presigned_url and key_a in presigned_url and exp > 0
    signed_api_url, api_exp = storage.create_signed_download_url("art_1", "ws_a", version=1, ttl_seconds=120)
    assert "signature=" in signed_api_url and api_exp > 0
    print("PASS [MOCKED 3/6]: S3 presigned URL & HMAC API download URL verified")

    # 4. Deletion & FileNotFoundError on missing object
    storage.delete_object(key_a)
    try:
        storage.get_bytes(key_a)
        raise AssertionError("Expected FileNotFoundError after delete_object")
    except FileNotFoundError:
        pass
    print("PASS [MOCKED 4/6]: S3 deletion & NoSuchKey -> FileNotFoundError verified")

    # 5. Failure handling (path traversal, missing config, upstream ClientError)
    for bad_key in ("../escape.txt", "/abs/path.txt", "a\\b.txt", ""):
        try:
            storage.put_bytes(bad_key, b"x")
            raise AssertionError(f"Expected ValueError for bad key {bad_key!r}")
        except ValueError:
            pass

    try:
        ArtifactStorage(backend="s3", bucket="", endpoint_url="", access_key="", secret_key="")
        raise AssertionError("Expected ArtifactStorageError when S3 config is missing")
    except ArtifactStorageError:
        pass

    fake_s3.fail_next_op = True
    try:
        storage.put_bytes(key_b, b"fail")
        raise AssertionError("Expected ArtifactStorageError on S3 ClientError")
    except ArtifactStorageError as exc:
        assert "nsk_test_dummy" not in str(exc)
    print("PASS [MOCKED 5/6]: Path traversal rejection, missing config & ClientError handling verified")

    # 6. Local development fallback
    with tempfile.TemporaryDirectory() as tmpdir:
        local_storage = ArtifactStorage(backend="local", root_dir=tmpdir)
        assert local_storage.backend_mode == "local"
        local_storage.put_bytes(key_a, data_a)
        assert local_storage.get_bytes(key_a) == data_a
        assert len(local_storage.list_objects("tenants/ten_a/")) == 1
        local_storage.delete_object(key_a)
        assert len(local_storage.list_objects("tenants/ten_a/")) == 0
    print("PASS [MOCKED 6/6]: Local development fallback storage verified")


async def run_live_neon_storage_tests() -> None:
    if not (settings.AWS_ENDPOINT_URL_S3 and settings.AWS_S3_BUCKET and settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY):
        print("SKIP [LIVE NEON]: Neon Object Storage credentials not configured in environment.")
        return

    import httpx

    live_storage = ArtifactStorage(backend="s3")
    assert live_storage.backend_mode == "s3"
    assert live_storage.bucket == "forge-artifacts"

    run_id = uuid.uuid4().hex[:8]
    tenant_id = f"ten_test_{run_id}"
    ws_id = f"ws_test_{run_id}"
    key = live_storage.build_storage_key(tenant_id, ws_id, f"art_{run_id}", 1, "persistence_check.md")
    payload = f"# Neon Object Storage Live Persistence Check ({run_id})\n".encode("utf-8")

    try:
        # 1. Live upload to Neon Object Storage
        size, checksum = live_storage.put_bytes(key, payload, content_type="text/markdown")
        assert size == len(payload)
        assert checksum == hashlib.sha256(payload).hexdigest()
        print(f"PASS [LIVE NEON 1/4]: Uploaded object to bucket={live_storage.bucket}")

        # 2. Live persistence across a fresh ArtifactStorage instance
        fresh_storage = ArtifactStorage(backend="s3")
        downloaded = fresh_storage.get_bytes(key)
        assert downloaded == payload
        listed = fresh_storage.list_objects(prefix=f"tenants/{tenant_id}/workspaces/{ws_id}/")
        assert len(listed) == 1 and listed[0]["key"] == key
        print("PASS [LIVE NEON 2/4]: Fresh instance download & prefix listing verified (durable persistence)")

        # 3. Live presigned GET URL against Neon Object Storage
        presigned_url, _ = fresh_storage.create_presigned_object_url(key, ttl_seconds=60, filename="persistence_check.md")
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(presigned_url)
            assert resp.status_code == 200, f"Expected 200, got {resp.status_code}"
            assert resp.content == payload
        print("PASS [LIVE NEON 3/4]: Live presigned URL GET verified (HTTP 200)")
    finally:
        # 4. Always clean up test object (never leaves test debris in forge-artifacts)
        live_storage.delete_object(key)

    try:
        live_storage.get_bytes(key)
        raise AssertionError("Expected FileNotFoundError after live Neon delete_object")
    except FileNotFoundError:
        pass
    print("PASS [LIVE NEON 4/4]: Live deletion & FileNotFoundError verified")


if __name__ == "__main__":
    run_mocked_s3_tests()
    asyncio.run(run_live_neon_storage_tests())
    print("ALL NEON OBJECT STORAGE ADAPTER TESTS PASSED!")
