import base64
import subprocess
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional


class GitManager:
    """Isolated Git CLI wrapper operating strictly inside an execution sandbox directory."""

    @staticmethod
    def _scrub_secret(text: str, secret: Optional[str]) -> str:
        if not text or not secret:
            return text
        basic = base64.b64encode(f"x-access-token:{secret}".encode("utf-8")).decode("ascii")
        return text.replace(secret, "[REDACTED_TOKEN]").replace(basic, "[REDACTED_TOKEN]")

    @staticmethod
    def run_git(
        sandbox_dir: Path,
        args: List[str],
        timeout: int = 30,
        auth_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        cmd = ["git"] + args
        env: Dict[str, str] = {
            "PATH": "/usr/bin:/bin:/usr/local/bin:/opt/homebrew/bin",
            "GIT_TERMINAL_PROMPT": "0",
            "PYTHONDONTWRITEBYTECODE": "1",
            "GIT_AUTHOR_NAME": "Project Forge Autonomous Agent",
            "GIT_AUTHOR_EMAIL": "agents@projectforge.ai",
            "GIT_COMMITTER_NAME": "Project Forge Autonomous Agent",
            "GIT_COMMITTER_EMAIL": "agents@projectforge.ai",
        }

        if auth_token:
            basic = base64.b64encode(f"x-access-token:{auth_token}".encode("utf-8")).decode("ascii")
            # Pass auth via environment-only git config (never in remote URLs, CLI args, or .git/config)
            env.update(
                {
                    "GIT_CONFIG_COUNT": "2",
                    "GIT_CONFIG_KEY_0": "credential.helper",
                    "GIT_CONFIG_VALUE_0": "",
                    "GIT_CONFIG_KEY_1": "http.https://github.com/.extraheader",
                    "GIT_CONFIG_VALUE_1": f"AUTHORIZATION: basic {basic}",
                }
            )

        proc = subprocess.run(
            cmd,
            cwd=str(sandbox_dir),
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )

        return {
            "exit_code": proc.returncode,
            "stdout": GitManager._scrub_secret(proc.stdout.strip(), auth_token),
            "stderr": GitManager._scrub_secret(proc.stderr.strip(), auth_token),
            "success": proc.returncode == 0,
        }

    @staticmethod
    def push_branch(
        sandbox_dir: Path,
        branch_name: str,
        auth_token: str,
        protected_branches: Optional[Iterable[str]] = None,
    ) -> Dict[str, Any]:
        clean_branch = branch_name.strip()
        blocked = {"main", "master", "production", "release"}
        if protected_branches:
            blocked.update(b.strip() for b in protected_branches if b)
        if clean_branch in blocked:
            raise PermissionError(f"Push to protected branch '{clean_branch}' is strictly prohibited.")

        res = GitManager.run_git(
            sandbox_dir,
            ["push", "-u", "origin", clean_branch],
            timeout=60,
            auth_token=auth_token,
        )
        return {
            "pushed": res["success"],
            "branch": clean_branch,
            "stdout": res["stdout"],
            "stderr": res["stderr"],
            "exit_code": res["exit_code"],
        }
