import hashlib
import hmac
import os
import time
from pathlib import Path
from typing import Optional, Tuple

from app.config import settings


class ArtifactStorage:
    """S3-Compatible & Tenant-Isolated Object Storage Gateway with HMAC-SHA256 Signed Download URLs."""

    def __init__(self) -> None:
        self.root_dir = Path(settings.ARTIFACT_STORAGE_DIR).resolve()
        self.root_dir.mkdir(parents=True, exist_ok=True)

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

    def put_bytes(self, storage_key: str, data: bytes) -> Tuple[int, str]:
        target_path = (self.root_dir / storage_key).resolve()
        if not str(target_path).startswith(str(self.root_dir)):
            raise ValueError("Invalid storage key path traversal rejected.")
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_bytes(data)
        checksum = hashlib.sha256(data).hexdigest()
        return len(data), checksum

    def get_bytes(self, storage_key: str) -> bytes:
        target_path = (self.root_dir / storage_key).resolve()
        if not str(target_path).startswith(str(self.root_dir)) or not target_path.exists():
            raise FileNotFoundError(f"Artifact object not found for key: {storage_key}")
        return target_path.read_bytes()

    def delete_object(self, storage_key: str) -> None:
        target_path = (self.root_dir / storage_key).resolve()
        if str(target_path).startswith(str(self.root_dir)) and target_path.exists():
            target_path.unlink(missing_ok=True)

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
