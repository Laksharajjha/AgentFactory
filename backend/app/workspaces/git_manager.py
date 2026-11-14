import subprocess
from pathlib import Path
from typing import Dict, Any, List


class GitManager:
    """Isolated Git CLI wrapper operating strictly inside an execution sandbox directory."""

    @staticmethod
    def run_git(sandbox_dir: Path, args: List[str], timeout: int = 15) -> Dict[str, Any]:
        cmd = ["git"] + args
        env = {
            "PATH": "/usr/bin:/bin:/usr/local/bin",
            "GIT_TERMINAL_PROMPT": "0",
            "GIT_AUTHOR_NAME": "Project Forge Autonomous Agent",
            "GIT_AUTHOR_EMAIL": "agents@projectforge.ai",
            "GIT_COMMITTER_NAME": "Project Forge Autonomous Agent",
            "GIT_COMMITTER_EMAIL": "agents@projectforge.ai",
        }
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
            "stdout": proc.stdout.strip(),
            "stderr": proc.stderr.strip(),
            "success": proc.returncode == 0,
        }
