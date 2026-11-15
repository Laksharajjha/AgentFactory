import hashlib
import hmac
import logging
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.config import settings

logger = logging.getLogger("project_forge.storage")


class ArtifactStorageError(RuntimeError):
    """Raised when an object storage backend operation fails."""


class ArtifactStorage:
    """S3-Compatible & Tenant-Isolated Object Storage Gateway with Neon Object Storage & Local Fallback."""

    def __init__(
        self,
        *,
        backend: Optional[str] = None,
        bucket: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        region: Optional[str] = None,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        root_dir: Optional[str] = None,
        s3_client: Optional[Any] = None,
    ) -> None:
        self.root_dir = Path(root_dir or settings.ARTIFACT_STORAGE_DIR).resolve()
        self.bucket = (bucket if bucket is not None else (settings.AWS_S3_BUCKET or settings.OBJECT_STORAGE_BUCKET)).strip()
        self.endpoint_url = (
            endpoint_url if endpoint_url is not None else (settings.AWS_ENDPOINT_URL_S3 or settings.OBJECT_STORAGE_ENDPOINT)
        ).strip()
        self.region = (region if region is not None else (settings.AWS_REGION or settings.OBJECT_STORAGE_REGION or "us-east-1")).strip()
        self._access_key = (access_key if access_key is not None else (settings.AWS_ACCESS_KEY_ID or settings.OBJECT_STORAGE_ACCESS_KEY)).strip()
        self._secret_key = (secret_key if secret_key is not None else (settings.AWS_SECRET_ACCESS_KEY or settings.OBJECT_STORAGE_SECRET_KEY)).strip()

        requested_backend = (backend or settings.ARTIFACT_STORAGE_BACKEND or "auto").strip().lower()
        has_s3_config = bool(self.bucket and self.endpoint_url and self._access_key and self._secret_key)

        if s3_client is not None:
            self._backend = "s3"
            self._s3_client = s3_client
        elif requested_backend == "s3":
            if not has_s3_config:
                raise ArtifactStorageError(
                    "ARTIFACT_STORAGE_BACKEND='s3' requires AWS_S3_BUCKET, AWS_ENDPOINT_URL_S3, "
                    "AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY (or OBJECT_STORAGE_* equivalents)."
                )
            self._backend = "s3"
            self._s3_client = self._build_s3_client()
        elif requested_backend == "auto" and has_s3_config:
            self._backend = "s3"
            self._s3_client = self._build_s3_client()
        else:
            self._backend = "local"
            self._s3_client = None
            self.root_dir.mkdir(parents=True, exist_ok=True)

    @property
    def backend_mode(self) -> str:
        return self._backend

    def _build_s3_client(self) -> Any:
        # Neon Object Storage requires path-style addressing and SigV4.
        return boto3.client(
            "s3",
            endpoint_url=self.endpoint_url,
            aws_access_key_id=self._access_key,
            aws_secret_access_key=self._secret_key,
            region_name=self.region or "us-east-1",
            config=Config(
                s3={"addressing_style": "path"},
                signature_version="s3v4",
                retries={"max_attempts": 3, "mode": "standard"},
            ),
        )

    @staticmethod
    def _validate_storage_key(storage_key: str) -> str:
        key = (storage_key or "").strip()
        if not key or key.startswith("/") or "\\" in key:
            raise ValueError("Invalid storage key: absolute or backslash paths are rejected.")
        parts = [p for p in key.split("/") if p]
        if any(p in (".", "..") for p in parts):
            raise ValueError("Invalid storage key path traversal rejected.")
        return "/".join(parts)

    def build_storage_key(
        self,
        tenant_id: str,
        workspace_id: str,
        artifact_id: str,
        version: int,
        filename: str,
    ) -> str:
        safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in filename)
        return f"tenants/{tenant_id}/workspaces/{workspace_id}/artifacts/{artifact_id}/v{version}/{safe_name}"

    def put_bytes(
        self,
        storage_key: str,
        data: bytes,
        content_type: str = "application/octet-stream",
    ) -> Tuple[int, str]:
        safe_key = self._validate_storage_key(storage_key)
        checksum = hashlib.sha256(data).hexdigest()
        if self._backend == "s3":
            try:
                self._s3_client.put_object(
                    Bucket=self.bucket,
                    Key=safe_key,
                    Body=data,
                    ContentType=content_type or "application/octet-stream",
                    Metadata={"sha256": checksum},
                )
                return len(data), checksum
            except (ClientError, BotoCoreError) as exc:
                logger.error("S3 put_object failed for key=%s: %s", safe_key, type(exc).__name__)
                raise ArtifactStorageError(f"Failed to upload artifact object: {safe_key}") from exc

        target_path = (self.root_dir / safe_key).resolve()
        if not str(target_path).startswith(str(self.root_dir)):
            raise ValueError("Invalid storage key path traversal rejected.")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)
        return len(data), checksum

    def get_bytes(self, storage_key: str) -> bytes:
        safe_key = self._validate_storage_key(storage_key)
        if self._backend == "s3":
            try:
                resp = self._s3_client.get_object(Bucket=self.bucket, Key=safe_key)
                body = resp["Body"].read()
                return body
            except ClientError as exc:
                code = str(exc.response.get("Error", {}).get("Code", ""))
                if code in {"NoSuchKey", "404", "NotFound"}:
                    raise FileNotFoundError(f"Artifact object not found for key: {safe_key}") from exc
                logger.error("S3 get_object failed for key=%s (code=%s)", safe_key, code)
                raise ArtifactStorageError(f"Failed to download artifact object: {safe_key}") from exc
            except BotoCoreError as exc:
                logger.error("S3 get_object transport error for key=%s: %s", safe_key, type(exc).__name__)
                raise ArtifactStorageError(f"Failed to download artifact object: {safe_key}") from exc

        target_path = (self.root_dir / safe_key).resolve()
        if not str(target_path).startswith(str(self.root_dir)) or not target_path.exists():
            raise FileNotFoundError(f"Artifact object not found for key: {safe_key}")
        return target_path.read_bytes()

    def delete_object(self, storage_key: str) -> None:
        safe_key = self._validate_storage_key(storage_key)
        if self._backend == "s3":
            try:
                self._s3_client.delete_object(Bucket=self.bucket, Key=safe_key)
                return
            except (ClientError, BotoCoreError) as exc:
                logger.error("S3 delete_object failed for key=%s: %s", safe_key, type(exc).__name__)
                raise ArtifactStorageError(f"Failed to delete artifact object: {safe_key}") from exc

        target_path = (self.root_dir / safe_key).resolve()
        if str(target_path).startswith(str(self.root_dir)) and target_path.exists():
            target_path.unlink(missing_ok=True)

    def list_objects(self, prefix: str = "", max_keys: int = 1000) -> List[Dict[str, Any]]:
        safe_prefix = self._validate_storage_key(prefix) if prefix.strip() else ""
        if self._backend == "s3":
            try:
                kwargs: Dict[str, Any] = {"Bucket": self.bucket, "MaxKeys": max_keys}
                if safe_prefix:
                    kwargs["Prefix"] = safe_prefix
                resp = self._s3_client.list_objects_v2(**kwargs)
                return [
                    {
                        "key": obj["Key"],
                        "size": int(obj.get("Size", 0)),
                        "last_modified": obj["LastModified"].isoformat() if obj.get("LastModified") else None,
                        "etag": str(obj.get("ETag", "")).strip('"'),
                    }
                    for obj in resp.get("Contents", [])
                ]
            except (ClientError, BotoCoreError) as exc:
                logger.error("S3 list_objects_v2 failed for prefix=%s: %s", safe_prefix, type(exc).__name__)
                raise ArtifactStorageError(f"Failed to list artifact objects for prefix: {safe_prefix}") from exc

        base_dir = (self.root_dir / safe_prefix).resolve() if safe_prefix else self.root_dir
        if not str(base_dir).startswith(str(self.root_dir)) or not base_dir.exists():
            return []
        results: List[Dict[str, Any]] = []
        for path in sorted(base_dir.rglob("*")):
            if path.is_file():
                rel = path.relative_to(self.root_dir).as_posix()
                stat = path.stat()
                results.append({"key": rel, "size": stat.st_size, "last_modified": None, "etag": ""})
                if len(results) >= max_keys:
                    break
        return results

    def create_presigned_object_url(
        self,
        storage_key: str,
        ttl_seconds: Optional[int] = None,
        filename: Optional[str] = None,
    ) -> Tuple[str, int]:
        if self._backend != "s3":
            raise ArtifactStorageError("Direct S3 presigned URLs are only available when S3 storage backend is active.")
        safe_key = self._validate_storage_key(storage_key)
        ttl = ttl_seconds or settings.SIGNED_URL_TTL_SECONDS
        expires_at = int(time.time()) + ttl
        params: Dict[str, Any] = {"Bucket": self.bucket, "Key": safe_key}
        if filename:
            safe_fn = "".join(c if c.isalnum() or c in "._- " else "_" for c in filename)
            params["ResponseContentDisposition"] = f'attachment; filename="{safe_fn}"'
        try:
            url = self._s3_client.generate_presigned_url(
                "get_object",
                Params=params,
                ExpiresIn=ttl,
            )
            return url, expires_at
        except (ClientError, BotoCoreError) as exc:
            logger.error("S3 generate_presigned_url failed for key=%s: %s", safe_key, type(exc).__name__)
            raise ArtifactStorageError(f"Failed to generate presigned URL for key: {safe_key}") from exc

    def create_signed_download_url(
        self,
        artifact_id: str,
        workspace_id: str,
        version: int = 1,
        ttl_seconds: Optional[int] = None,
    ) -> Tuple[str, int]:
        ttl = ttl_seconds or settings.SIGNED_URL_TTL_SECONDS
        expires_at = int(time.time()) + ttl
        msg = f"{artifact_id}:{workspace_id}:{version}:{expires_at}".encode("utf-8")
        sig = hmac.new(settings.AUTH_SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        url = f"/api/artifacts/{artifact_id}/download?workspace_id={workspace_id}&version={version}&expires={expires_at}&signature={sig}"
        return url, expires_at

    def verify_signed_download(
        self,
        artifact_id: str,
        workspace_id: str,
        version: int,
        expires: int,
        signature: str,
    ) -> bool:
        if int(time.time()) > int(expires):
            return False
        msg = f"{artifact_id}:{workspace_id}:{version}:{expires}".encode("utf-8")
        expected = hmac.new(settings.AUTH_SECRET_KEY.encode("utf-8"), msg, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)


artifact_storage = ArtifactStorage()
