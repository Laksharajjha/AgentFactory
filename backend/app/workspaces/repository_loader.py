from pathlib import Path
from typing import Dict, Any
from app.workspaces.git_manager import GitManager


class RepositoryLoader:
    """Initializes or clones an authorized repository into an isolated execution sandbox."""

    @staticmethod
    def initialize_sandbox_repo(
        sandbox_dir: Path,
        repo_full_name: str,
        default_branch: str = "main",
        seed_files: Dict[str, str] | None = None,
    ) -> Dict[str, Any]:
        sandbox_dir.mkdir(parents=True, exist_ok=True)
        GitManager.run_git(sandbox_dir, ["init", "-b", default_branch])

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
        }
