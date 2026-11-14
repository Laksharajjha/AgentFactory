import hashlib
import os
import urllib.parse
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    # Environment & Service Identity
    ENVIRONMENT: str = "development"
    APP_VERSION: str = "3.0.0"

    # Gemini AI & Free-Tier Quota Protection
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.1-flash-lite-preview"
    GEMINI_COMPLEX_MODEL: str = "gemini-3.1-flash-lite-preview"
    ENABLE_COMPLEX_MODEL: bool = False
    MAX_AGENT_ITERATIONS: int = 2
    MAX_WORKFORCE_CALLS: int = 25
    MAX_OUTPUT_TOKENS: int = 768
    MAX_RETRIES: int = 2
    GLOBAL_TOKEN_BUDGET: int = 100000
    PER_AGENT_TOKEN_BUDGET: int = 15000

    # Database: Neon PostgreSQL (authoritative production store) with non-destructive local SQLite fallback
    DATABASE_URL: str = "sqlite+aiosqlite:///./project_forge.db"
    NEON_DATABASE_URL: str = ""
    DIRECT_DATABASE_URL: str = ""
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_RECYCLE_SECONDS: int = 300
    ENABLE_RLS: bool = True

    # Authentication, Session & Encryption Secrets
    AUTH_SECRET_KEY: str = "forge-3-enterprise-hmac-secret-key-change-in-production-2026"
    CREDENTIAL_ENCRYPTION_KEY: str = "forge-3-credential-encryption-seed-key-2026"
    SESSION_EXPIRY_HOURS: int = 72
    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # GitHub App Integration
    GITHUB_APP_ID: str = ""
    GITHUB_APP_SLUG: str = "project-forge-autonomous"
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    GITHUB_PRIVATE_KEY_PEM: str = ""
    GITHUB_PRIVATE_KEY_PATH: str = ""
    GITHUB_WEBHOOK_SECRET: str = ""

    # Upstash Redis Coordination & Distributed Locks
    UPSTASH_REDIS_REST_URL: str = ""
    UPSTASH_REDIS_REST_TOKEN: str = ""
    REDIS_URL: str = ""

    # S3-Compatible Object Storage & Signed URLs (supports both OBJECT_STORAGE_* and AWS_* aliases)
    OBJECT_STORAGE_BUCKET: str = "project-forge-artifacts"
    OBJECT_STORAGE_ENDPOINT: str = ""
    OBJECT_STORAGE_REGION: str = "auto"
    OBJECT_STORAGE_ACCESS_KEY: str = ""
    OBJECT_STORAGE_SECRET_KEY: str = ""
    AWS_S3_BUCKET: str = ""
    AWS_ENDPOINT_URL_S3: str = ""
    AWS_REGION: str = ""
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    ARTIFACT_STORAGE_DIR: str = "./storage/artifacts"
    WORKSPACE_SANDBOX_ROOT: str = "./storage/sandboxes"
    SIGNED_URL_TTL_SECONDS: int = 900

    # Resource Governor & Fair Execution Queue Limits (Part 10 Specification)
    MAX_CONCURRENT_WORKFORCES: int = 2
    MAX_CONCURRENT_EXECUTIONS_PER_USER: int = 1
    MAX_QUEUED_WORKFORCES_PER_USER: int = 3
    MAX_GLOBAL_QUEUED_WORKFORCES: int = 10
    MAX_AGENTS_PER_WORKFORCE: int = 6
    MAX_SANDBOXES: int = 2
    MAX_EXECUTION_DURATION_SECONDS: int = 600
    LEASE_TTL_SECONDS: int = 90
    ADMISSION_PAUSED: bool = False

    model_config = SettingsConfigDict(
        env_file=(str(_BACKEND_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @staticmethod
    def _normalize_postgres_url(raw_url: str) -> str:
        url = raw_url.strip()
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and "+asyncpg" not in url:
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        if url.startswith("postgresql+asyncpg://") and "?" in url:
            parts = urllib.parse.urlsplit(url)
            q = urllib.parse.parse_qs(parts.query, keep_blank_values=True)
            if "sslmode" in q:
                ssl_val = q.pop("sslmode")[0]
                if "ssl" not in q and ssl_val in ("require", "verify-ca", "verify-full", "prefer"):
                    q["ssl"] = ["require"]
            q.pop("channel_binding", None)
            new_query = urllib.parse.urlencode(q, doseq=True)
            url = urllib.parse.urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))
        return url

    @property
    def effective_database_url(self) -> str:
        return self._normalize_postgres_url(self.NEON_DATABASE_URL or self.DATABASE_URL)

    @property
    def effective_direct_database_url(self) -> str:
        return self._normalize_postgres_url(self.DIRECT_DATABASE_URL or self.NEON_DATABASE_URL or self.DATABASE_URL)

    @property
    def is_postgres(self) -> bool:
        return self.effective_database_url.startswith("postgresql")

    def derive_fernet_key(self) -> bytes:
        import base64
        digest = hashlib.sha256(self.CREDENTIAL_ENCRYPTION_KEY.encode("utf-8")).digest()
        return base64.urlsafe_b64encode(digest)


settings = Settings()
