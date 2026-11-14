import shutil
from pathlib import Path


class WorkspaceCleanup:
    """Revokes temporary sandbox credentials and destroys disposable execution directories."""

    @staticmethod
    def destroy_sandbox(sandbox_dir: Path, root_dir: Path) -> bool:
        resolved_target = sandbox_dir.resolve()
        resolved_root = root_dir.resolve()
        if not str(resolved_target).startswith(str(resolved_root)) or resolved_target == resolved_root:
            raise ValueError("Refusing to clean up path outside sandbox root.")
        if resolved_target.exists():
            shutil.rmtree(resolved_target, ignore_errors=True)
            return True
        return False
