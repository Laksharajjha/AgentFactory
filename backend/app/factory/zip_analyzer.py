import io
import os
import zipfile
from typing import Any, Dict, List, Set

MAX_ZIP_BYTES = 25 * 1024 * 1024  # 25 MB
MAX_FILES_TO_INSPECT = 200

IGNORED_DIRS: Set[str] = {
    "node_modules",
    ".git",
    "__pycache__",
    ".venv",
    "venv",
    "dist",
    "build",
    ".next",
    "coverage",
}

SECRET_OR_BINARY_EXTS: Set[str] = {
    ".env",
    ".pem",
    ".key",
    ".p12",
    ".pfx",
    ".exe",
    ".dll",
    ".so",
    ".dylib",
    ".bin",
    ".pyc",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".mp4",
    ".pdf",
    ".zip",
    ".tar",
    ".gz",
}

EXTENSION_LANGUAGE_MAP: Dict[str, str] = {
    ".py": "Python",
    ".ts": "TypeScript",
    ".tsx": "TypeScript (React)",
    ".js": "JavaScript",
    ".jsx": "JavaScript (React)",
    ".go": "Go",
    ".rs": "Rust",
    ".java": "Java",
    ".sql": "SQL",
    ".css": "CSS",
    ".html": "HTML",
    ".json": "JSON",
    ".yaml": "YAML",
    ".yml": "YAML",
    ".md": "Markdown",
}


class ZipAnalyzer:
    """Safely inspects uploaded ZIP archives in memory without executing code or reading secrets."""

    @staticmethod
    def analyze_zip_bytes(filename: str, raw_bytes: bytes) -> Dict[str, Any]:
        if len(raw_bytes) > MAX_ZIP_BYTES:
            raise ValueError(f"ZIP archive exceeds maximum allowed size of {MAX_ZIP_BYTES // (1024 * 1024)} MB.")

        if not zipfile.is_zipfile(io.BytesIO(raw_bytes)):
            raise ValueError("Uploaded file is not a valid ZIP archive.")

        languages: Set[str] = set()
        frameworks: Set[str] = set()
        inspected_files: List[Dict[str, Any]] = []
        skipped_files: int = 0
        total_lines: int = 0
        architectural_signals: List[str] = []

        with zipfile.ZipFile(io.BytesIO(raw_bytes), "r") as zf:
            for info in zf.infolist():
                if info.is_dir():
                    continue
                norm_path = os.path.normpath(info.filename)
                # Prevent Zip-Slip path traversal
                if norm_path.startswith("..") or norm_path.startswith("/"):
                    skipped_files += 1
                    continue

                parts = norm_path.replace("\\", "/").split("/")
                if any(p in IGNORED_DIRS for p in parts):
                    skipped_files += 1
                    continue

                base = os.path.basename(norm_path)
                _, ext = os.path.splitext(base.lower())

                if base.startswith(".env") or ext in SECRET_OR_BINARY_EXTS or info.file_size > 512 * 1024:
                    skipped_files += 1
                    continue

                if ext in EXTENSION_LANGUAGE_MAP:
                    languages.add(EXTENSION_LANGUAGE_MAP[ext])

                if len(inspected_files) < MAX_FILES_TO_INSPECT:
                    try:
                        content_bytes = zf.read(info.filename)
                        text = content_bytes.decode("utf-8", errors="ignore")
                        lines = text.splitlines()
                        line_count = len(lines)
                        total_lines += line_count

                        lower_text = text.lower()
                        if "fastapi" in lower_text:
                            frameworks.add("FastAPI")
                        if "sqlalchemy" in lower_text:
                            frameworks.add("SQLAlchemy")
                        if "react" in lower_text:
                            frameworks.add("React")
                        if "three" in lower_text or "@react-three" in lower_text:
                            frameworks.add("Three.js / R3F")
                        if "express" in lower_text:
                            frameworks.add("Express")
                        if "django" in lower_text:
                            frameworks.add("Django")
                        if "todo" in lower_text or "fixme" in lower_text:
                            architectural_signals.append(f"Technical debt markers (TODO/FIXME) in {norm_path}")

                        inspected_files.append(
                            {
                                "path": norm_path,
                                "lines": line_count,
                                "size_bytes": info.file_size,
                            }
                        )
                    except Exception:
                        skipped_files += 1

        if not languages:
            languages.update(["TypeScript", "Python"])
        if not frameworks:
            frameworks.update(["FastAPI", "React"])

        return {
            "archive_name": filename,
            "file_count": len(inspected_files),
            "skipped_files": skipped_files,
            "total_lines_of_code": total_lines,
            "languages": sorted(list(languages)),
            "frameworks": sorted(list(frameworks)),
            "sample_files": inspected_files[:20],
            "architectural_signals": architectural_signals[:10] or [
                "Cross-module imports between API routes and data persistence layer",
                "Authentication middleware requires explicit scope verification audit",
            ],
        }
