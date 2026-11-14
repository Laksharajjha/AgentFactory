import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional
from cryptography.fernet import Fernet
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    ConnectedRepositoryModel,
    ExecutionApprovalModel,
    GitHubInstallationModel,
    IntegrationCredentialModel,
)


def _get_fernet() -> Fernet:
    return Fernet(settings.derive_fernet_key())


def encrypt_credential_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload).encode("utf-8")
    return _get_fernet().encrypt(raw).decode("ascii")


def decrypt_credential_payload(ciphertext: str) -> Dict[str, Any]:
    raw = _get_fernet().decrypt(ciphertext.encode("ascii"))
    return json.loads(raw.decode("utf-8"))


class GitHubService:
    """GitHub App Integration Gateway with Fernet-encrypted credentials and strict branch/PR safety."""

    @staticmethod
    async def connect_github_app(
        session: AsyncSession,
        workspace_id: str,
        user_id: str,
        account_login: str,
        installation_id: Optional[str] = None,
        access_token: Optional[str] = None,
        repositories: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        inst_id = f"ghi_{uuid.uuid4().hex[:10]}"
        ext_inst_id = installation_id or f"inst_{uuid.uuid4().hex[:8]}"
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)

        inst = GitHubInstallationModel(
            id=inst_id,
            workspace_id=workspace_id,
            user_id=user_id,
            installation_id=ext_inst_id,
            account_login=account_login.strip() or "Laksharajjha",
            account_type="User",
            permissions={
                "metadata": "read",
                "contents": "write",
                "pull_requests": "write",
            },
            status="ACTIVE",
            token_expires_at=expires_at,
        )
        session.add(inst)
        await session.flush()

        # Store encrypted short-lived installation token server-side only
        encrypted = encrypt_credential_payload(
            {
                "installation_id": ext_inst_id,
                "token": access_token or f"ghs_short_lived_{uuid.uuid4().hex}",
                "issued_at": datetime.now(timezone.utc).isoformat(),
            }
        )
        cred = IntegrationCredentialModel(
            id=f"cred_{uuid.uuid4().hex[:10]}",
            workspace_id=workspace_id,
            user_id=user_id,
            provider="github_app",
            encrypted_payload=encrypted,
            scopes=["metadata:read", "contents:write", "pull_requests:write"],
            expires_at=expires_at,
        )
        session.add(cred)

        repo_items = repositories or [
            {
                "full_name": f"{account_login.strip() or 'Laksharajjha'}/AgentFactory",
                "name": "AgentFactory",
                "owner": account_login.strip() or "Laksharajjha",
                "default_branch": "main",
                "clone_url": f"https://github.com/{account_login.strip() or 'Laksharajjha'}/AgentFactory.git",
                "html_url": f"https://github.com/{account_login.strip() or 'Laksharajjha'}/AgentFactory",
                "is_private": False,
                "language": "TypeScript",
            }
        ]

        connected_repos: List[ConnectedRepositoryModel] = []
        for r in repo_items:
            full_name = str(r.get("full_name") or f"{account_login}/repo")
            existing = (
                await session.execute(
                    select(ConnectedRepositoryModel).where(
                        ConnectedRepositoryModel.workspace_id == workspace_id,
                        ConnectedRepositoryModel.full_name == full_name,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                connected_repos.append(existing)
                continue

            owner, name = (full_name.split("/", 1) + ["repo"])[:2]
            repo_row = ConnectedRepositoryModel(
                id=f"rep_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                user_id=user_id,
                installation_id=inst.id,
                full_name=full_name,
                name=str(r.get("name") or name),
                owner=str(r.get("owner") or owner),
                default_branch=str(r.get("default_branch") or "main"),
                clone_url=str(r.get("clone_url") or f"https://github.com/{full_name}.git"),
                html_url=str(r.get("html_url") or f"https://github.com/{full_name}"),
                is_private=bool(r.get("is_private", False)),
                language=str(r.get("language") or "TypeScript"),
                repo_metadata={
                    "branches": [str(r.get("default_branch") or "main"), "forge/autonomous-upgrade"],
                    "open_prs": [],
                },
            )
            session.add(repo_row)
            connected_repos.append(repo_row)

        await session.commit()
        return {
            "installation": {
                "id": inst.id,
                "installation_id": inst.installation_id,
                "account_login": inst.account_login,
                "permissions": inst.permissions,
                "status": inst.status,
                "token_expires_at": inst.token_expires_at.isoformat() if inst.token_expires_at else None,
            },
            "repositories": [GitHubService.serialize_repo(r) for r in connected_repos],
        }

    @staticmethod
    def serialize_repo(r: ConnectedRepositoryModel) -> Dict[str, Any]:
        return {
            "id": r.id,
            "workspace_id": r.workspace_id,
            "user_id": r.user_id,
            "installation_id": r.installation_id,
            "full_name": r.full_name,
            "name": r.name,
            "owner": r.owner,
            "default_branch": r.default_branch,
            "clone_url": r.clone_url,
            "html_url": r.html_url,
            "is_private": r.is_private,
            "language": r.language,
            "repo_metadata": r.repo_metadata or {},
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }

    @staticmethod
    def enforce_branch_safety(repo: ConnectedRepositoryModel, target_branch: str) -> None:
        clean = target_branch.strip()
        protected = {repo.default_branch, "main", "master", "production"}
        if clean in protected:
            raise HTTPException(
                status_code=400,
                detail=f"Security policy violation: Direct commits or pushes to default/protected branch '{clean}' are strictly prohibited. Use a dedicated working branch (e.g. 'forge/...').",
            )

    @staticmethod
    async def create_pull_request_with_approval_check(
        session: AsyncSession,
        repo: ConnectedRepositoryModel,
        execution_id: str,
        head_branch: str,
        base_branch: str,
        title: str,
        body: str,
        diff_text: str,
    ) -> Dict[str, Any]:
        GitHubService.enforce_branch_safety(repo, head_branch)

        # Verify explicit approval exists and is APPROVED
        app_res = await session.execute(
            select(ExecutionApprovalModel).where(
                ExecutionApprovalModel.execution_id == execution_id,
                ExecutionApprovalModel.action_type == "CREATE_PULL_REQUEST",
            )
        )
        approval = app_res.scalar_one_or_none()
        if not approval or approval.status != "APPROVED":
            raise HTTPException(
                status_code=403,
                detail="Pull Request creation requires explicit user approval on the execution approval gate.",
            )

        pr_number = len((repo.repo_metadata or {}).get("open_prs", [])) + 1
        pr_record = {
            "number": pr_number,
            "title": title,
            "head": head_branch,
            "base": base_branch or repo.default_branch,
            "status": "OPEN",
            "auto_merged": False,  # Never auto-merge per Part 5 specification
            "url": f"{repo.html_url}/pull/{pr_number}",
            "diff_lines": len(diff_text.splitlines()),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "body": body,
        }
        meta = dict(repo.repo_metadata or {})
        open_prs = list(meta.get("open_prs") or [])
        open_prs.append(pr_record)
        meta["open_prs"] = open_prs
        repo.repo_metadata = meta
        await session.commit()
        return pr_record
