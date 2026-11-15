import shutil
from pathlib import Path
from typing import Any, Dict, Optional

from app.workspaces.git_manager import GitManager


def _write_sandbox_git_excludes(sandbox_dir: Path) -> None:
    exclude_file = sandbox_dir / ".git" / "info" / "exclude"
    if not exclude_file.parent.exists():
        return
    existing = exclude_file.read_text(encoding="utf-8") if exclude_file.exists() else ""
    rules = ["__pycache__/", "*.py[cod]", ".pytest_cache/", ".DS_Store"]
    additions = [r for r in rules if r not in existing]
    if additions:
        prefix = "\n" if existing and not existing.endswith("\n") else ""
        exclude_file.write_text(existing + prefix + "\n".join(additions) + "\n", encoding="utf-8")


class RepositoryLoader:
    """Clones an authorized GitHub repository into an isolated execution sandbox."""

    @staticmethod
    def clone_repository(
        sandbox_dir: Path,
        clone_url: str,
        default_branch: str = "main",
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        if sandbox_dir.exists():
            shutil.rmtree(sandbox_dir, ignore_errors=True)
        sandbox_dir.mkdir(parents=True, exist_ok=True)

        clone_args = ["clone", "--branch", default_branch, "--single-branch", clone_url, "."]
        clone_res = GitManager.run_git(sandbox_dir, clone_args, timeout=90, auth_token=auth_token)
        if not clone_res["success"]:
            # Fallback to default clone without --branch if default branch name differs remotely
            shutil.rmtree(sandbox_dir, ignore_errors=True)
            sandbox_dir.mkdir(parents=True, exist_ok=True)
            clone_res = GitManager.run_git(
                sandbox_dir,
                ["clone", clone_url, "."],
                timeout=90,
                auth_token=auth_token,
            )
        if not clone_res["success"]:
            raise RuntimeError(
                f"Git clone failed for {clone_url} (exit={clone_res['exit_code']}): {clone_res['stderr']}"
            )

        _write_sandbox_git_excludes(sandbox_dir)
        head_res = GitManager.run_git(sandbox_dir, ["rev-parse", "HEAD"])
        branch_res = GitManager.run_git(sandbox_dir, ["rev-parse", "--abbrev-ref", "HEAD"])
        return {
            "base_commit": head_res["stdout"][:12] if head_res["success"] else "",
            "default_branch": branch_res["stdout"] if branch_res["success"] else default_branch,
            "cloned": True,
        }

    @staticmethod
    def initialize_sandbox_repo(
        sandbox_dir: Path,
        repo_full_name: str,
        default_branch: str = "main",
        seed_files: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        """Offline local-only repo initialization for unit tests without remote GitHub access."""
        sandbox_dir.mkdir(parents=True, exist_ok=True)
        GitManager.run_git(sandbox_dir, ["init", "-b", default_branch])
        _write_sandbox_git_excludes(sandbox_dir)

        initial_files = seed_files or {
            "README.md": f"# {repo_full_name}\n\nIsolated Project Forge Execution Workspace.\n",
            "src/auth_middleware.py": (
                "def verify_token(token: str) -> bool:\n"
                "    # Baseline token check\n"
                "    return bool(token and len(token) > 8)\n"
            ),
            "tests/test_auth.py": (
                "from src.auth_middleware import verify_token\n\n"
                "def test_verify_token():\n"
                "    assert verify_token('valid_token_12345') is True\n"
            ),
        }

        for rel_path, content in initial_files.items():
            target = (sandbox_dir / rel_path).resolve()
            if not str(target).startswith(str(sandbox_dir.resolve())):
                raise ValueError("Path traversal blocked during repository seeding.")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

        GitManager.run_git(sandbox_dir, ["add", "."])
        GitManager.run_git(sandbox_dir, ["commit", "-m", "chore: baseline repository snapshot"])
        head_res = GitManager.run_git(sandbox_dir, ["rev-parse", "HEAD"])
        return {
            "base_commit": head_res["stdout"][:12] if head_res["success"] else "initial",
            "default_branch": default_branch,
            "files_seeded": list(initial_files.keys()),
            "cloned": False,
        }
