from pathlib import Path
from typing import Dict, Any
from app.workspaces.git_manager import GitManager


class DiffManager:
    """Generates unified git diffs and creates commits on isolated working branches."""

    @staticmethod
    def generate_diff(sandbox_dir: Path) -> Dict[str, Any]:
        GitManager.run_git(sandbox_dir, ["add", "-N", "."])
        diff_res = GitManager.run_git(sandbox_dir, ["diff"])
        status_res = GitManager.run_git(sandbox_dir, ["status", "--short"])
        diff_text = diff_res["stdout"]
        changed_files = [
            line[3:].strip() for line in status_res["stdout"].splitlines() if len(line) > 3
        ]
        return {
            "diff": diff_text,
            "changed_files": changed_files,
            "has_changes": bool(diff_text.strip() or changed_files),
            "lines_changed": len(diff_text.splitlines()),
        }

    @staticmethod
    def commit_changes(sandbox_dir: Path, message: str) -> Dict[str, Any]:
        branch_res = GitManager.run_git(sandbox_dir, ["rev-parse", "--abbrev-ref", "HEAD"])
        current_branch = branch_res["stdout"].strip()
        if current_branch in ("main", "master", "production"):
            raise PermissionError(
                f"Cannot commit directly to protected default branch '{current_branch}'."
            )
        GitManager.run_git(sandbox_dir, ["add", "."])
        commit_res = GitManager.run_git(sandbox_dir, ["commit", "-m", message])
        sha_res = GitManager.run_git(sandbox_dir, ["rev-parse", "HEAD"])
        return {
            "committed": commit_res["success"],
            "branch": current_branch,
            "commit_sha": sha_res["stdout"][:12] if sha_res["success"] else "",
            "message": message,
        }
