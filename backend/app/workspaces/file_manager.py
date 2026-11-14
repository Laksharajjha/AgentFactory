from pathlib import Path
from typing import Dict, Any, List


class FileManager:
    """Sandboxed file browser, reader, and writer with strict quota and path traversal guards."""

    MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024  # 2 MB per file limit

    @staticmethod
    def _resolve_safe_path(sandbox_dir: Path, relative_path: str) -> Path:
        root = sandbox_dir.resolve()
        cleaned = relative_path.lstrip("/\\")
        target = (root / cleaned).resolve()
        if not str(target).startswith(str(root)):
            raise PermissionError("Sandbox path escape attempt blocked.")
        if ".git" in target.parts:
            raise PermissionError("Direct modification of .git internals is prohibited.")
        return target

    @classmethod
    def list_files(cls, sandbox_dir: Path) -> List[Dict[str, Any]]:
        root = sandbox_dir.resolve()
        if not root.exists():
            return []
        items: List[Dict[str, Any]] = []
        for p in sorted(root.rglob("*")):
            if ".git" in p.parts or "__pycache__" in p.parts:
                continue
            if p.is_file():
                rel = str(p.relative_to(root))
                items.append({"path": rel, "size": p.stat().st_size})
        return items

    @classmethod
    def read_file(cls, sandbox_dir: Path, relative_path: str) -> str:
        target = cls._resolve_safe_path(sandbox_dir, relative_path)
        if not target.exists() or not target.is_file():
            raise FileNotFoundError(f"File '{relative_path}' not found in sandbox.")
        return target.read_text(encoding="utf-8", errors="replace")

    @classmethod
    def write_file(cls, sandbox_dir: Path, relative_path: str, content: str) -> Dict[str, Any]:
        raw = content.encode("utf-8")
        if len(raw) > cls.MAX_FILE_SIZE_BYTES:
            raise ValueError("File exceeds sandbox per-file quota (2 MB).")
        target = cls._resolve_safe_path(sandbox_dir, relative_path)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(raw)
        return {"path": relative_path, "bytes_written": len(raw)}
