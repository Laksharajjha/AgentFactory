from pathlib import Path
from typing import Dict, Any, List
from app.workspaces.git_manager import GitManager


class BranchManager:
    """Manages isolated working branches and enforces default-branch protection."""

    PROTECTED_BRANCHES = {"main", "master", "production", "release"}

    @classmethod
    def create_working_branch(cls, sandbox_dir: Path, branch_name: str) -> Dict[str, Any]:
        clean = branch_name.strip()
        if clean in cls.PROTECTED_BRANCHES:
            raise ValueError(f"Cannot use protected branch '{clean}' as a mutable working branch.")
        res = GitManager.run_git(sandbox_dir, ["checkout", "-b", clean])
        return {
            "working_branch": clean,
            "created": res["success"],
            "details": res["stdout"] or res["stderr"],
        }

    @staticmethod
    def list_branches(sandbox_dir: Path) -> List[str]:
        res = GitManager.run_git(sandbox_dir, ["branch", "--format=%(refname:short)"])
        if not res["success"] or not res["stdout"]:
            return ["main"]
        return [line.strip() for line in res["stdout"].splitlines() if line.strip()]
