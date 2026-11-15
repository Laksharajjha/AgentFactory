import base64
import hashlib
import hmac
import json
import logging
import secrets
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import httpx
import jwt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import (
    ConnectedRepositoryModel,
    ExecutionApprovalModel,
    GitHubInstallationModel,
    IntegrationCredentialModel,
    WorkspaceMemberModel,
    WorkspaceModel,
)

logger = logging.getLogger("project_forge.github")

GITHUB_API_BASE = "https://api.github.com"
GITHUB_API_VERSION = "2022-11-28"


def _get_fernet() -> Fernet:
    return Fernet(settings.derive_fernet_key())


def encrypt_credential_payload(payload: Dict[str, Any]) -> str:
    raw = json.dumps(payload).encode("utf-8")
    return _get_fernet().encrypt(raw).decode("ascii")


def decrypt_credential_payload(ciphertext: str) -> Dict[str, Any]:
    raw = _get_fernet().decrypt(ciphertext.encode("ascii"))
    return json.loads(raw.decode("utf-8"))


def _github_headers(bearer_or_token: str, scheme: str = "Bearer") -> Dict[str, str]:
    return {
        "Authorization": f"{scheme} {bearer_or_token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": "ProjectForge-Platform/3.0",
    }


def _parse_iso_dt(raw: Optional[str]) -> datetime:
    if not raw:
        return datetime.now(timezone.utc) + timedelta(minutes=55)
    normalized = raw.replace("Z", "+00:00")
    dt = datetime.fromisoformat(normalized)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


class GitHubService:
    """Real GitHub App & OAuth Integration Gateway with Fernet-encrypted tokens and strict branch/PR safety."""

    # In-memory installation token cache: (workspace_id, ext_installation_id) -> (token, expires_at)
    _token_cache: Dict[Tuple[str, str], Tuple[str, datetime]] = {}
    # Short-lived PKCE/CSRF OAuth state store: state -> {workspace_id, user_id, code_verifier, redirect_uri, expires_at}
    _oauth_states: Dict[str, Dict[str, Any]] = {}

    @staticmethod
    def _load_private_key_pem() -> str:
        pem_inline = (settings.GITHUB_PRIVATE_KEY_PEM or "").strip()
        if pem_inline:
            return pem_inline.replace("\\n", "\n")
        key_path_raw = (settings.GITHUB_PRIVATE_KEY_PATH or "").strip()
        if key_path_raw:
            p = Path(key_path_raw)
            if not p.is_absolute():
                p = Path(__file__).resolve().parents[2] / p
            if p.exists():
                return p.read_text(encoding="utf-8")
        raise HTTPException(
            status_code=503,
            detail="GitHub App private key is not configured on the server.",
        )

    @staticmethod
    def is_app_configured() -> bool:
        if not (settings.GITHUB_APP_ID or "").strip():
            return False
        try:
            GitHubService._load_private_key_pem()
            return True
        except HTTPException:
            return False

    @staticmethod
    def get_install_url() -> str:
        slug = (settings.GITHUB_APP_SLUG or "projectforge-platform").strip()
        return f"https://github.com/apps/{slug}/installations/new"

    @staticmethod
    def create_app_jwt() -> str:
        app_id = (settings.GITHUB_APP_ID or "").strip()
        if not app_id:
            raise HTTPException(status_code=503, detail="GITHUB_APP_ID is not configured.")
        pem = GitHubService._load_private_key_pem()
        now = int(time.time())
        payload = {
            "iat": now - 60,
            "exp": now + 540,  # 9 minutes (GitHub max 10 minutes)
            "iss": str(app_id),
        }
        return jwt.encode(payload, pem, algorithm="RS256")

    @staticmethod
    async def list_app_installations() -> List[Dict[str, Any]]:
        app_jwt = GitHubService.create_app_jwt()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{GITHUB_API_BASE}/app/installations",
                    headers=_github_headers(app_jwt, "Bearer"),
                )
        except httpx.HTTPError as exc:
            logger.error("GitHub /app/installations request failed: %s", type(exc).__name__)
            raise HTTPException(status_code=502, detail="Unable to reach GitHub API to list App installations.")

        if resp.status_code != 200:
            detail = resp.json().get("message", resp.text) if resp.content else f"HTTP {resp.status_code}"
            raise HTTPException(
                status_code=502 if resp.status_code >= 500 else resp.status_code,
                detail=f"GitHub App authentication failed ({resp.status_code}): {detail}",
            )
        return resp.json()

    @staticmethod
    async def resolve_installation(
        account_login: Optional[str] = None,
        installation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        installations = await GitHubService.list_app_installations()
        if not installations:
            raise HTTPException(
                status_code=404,
                detail=f"No installations found for GitHub App. Install it first at {GitHubService.get_install_url()}",
            )

        target_inst_id = (installation_id or settings.GITHUB_APP_INSTALLATION_ID or "").strip()
        target_login = (account_login or "").strip().lower()

        if target_inst_id:
            for inst in installations:
                if str(inst.get("id")) == target_inst_id:
                    if target_login and str((inst.get("account") or {}).get("login", "")).lower() != target_login:
                        continue
                    return inst

        if target_login:
            for inst in installations:
                if str((inst.get("account") or {}).get("login", "")).lower() == target_login:
                    return inst
            raise HTTPException(
                status_code=404,
                detail=f"GitHub App is not installed on account '{account_login}'. Install it at {GitHubService.get_install_url()}",
            )

        if len(installations) == 1:
            return installations[0]

        if target_inst_id:
            for inst in installations:
                if str(inst.get("id")) == target_inst_id:
                    return inst

        available = ", ".join(str((i.get("account") or {}).get("login", i.get("id"))) for i in installations)
        raise HTTPException(
            status_code=400,
            detail=f"Multiple GitHub installations exist ({available}); specify account_login or installation_id.",
        )

    @staticmethod
    async def _mint_installation_token(ext_installation_id: str) -> Tuple[str, datetime, Dict[str, str]]:
        app_jwt = GitHubService.create_app_jwt()
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{GITHUB_API_BASE}/app/installations/{ext_installation_id}/access_tokens",
                    headers=_github_headers(app_jwt, "Bearer"),
                )
        except httpx.HTTPError as exc:
            logger.error("GitHub access_tokens request failed for inst=%s: %s", ext_installation_id, type(exc).__name__)
            raise HTTPException(status_code=502, detail="Unable to reach GitHub API to mint installation token.")

        if resp.status_code != 201:
            detail = resp.json().get("message", resp.text) if resp.content else f"HTTP {resp.status_code}"
            raise HTTPException(
                status_code=502 if resp.status_code >= 500 else resp.status_code,
                detail=f"GitHub installation token generation failed ({resp.status_code}): {detail}",
            )
        body = resp.json()
        token = str(body.get("token") or "")
        if not token:
            raise HTTPException(status_code=502, detail="GitHub returned an empty installation token.")
        expires_at = _parse_iso_dt(body.get("expires_at"))
        permissions = dict(body.get("permissions") or {})
        return token, expires_at, permissions

    @staticmethod
    async def get_installation_token(
        session: AsyncSession,
        workspace_id: str,
        user_id: Optional[str] = None,
        ext_installation_id: Optional[str] = None,
    ) -> Tuple[str, GitHubInstallationModel]:
        if user_id:
            mem = (
                await session.execute(
                    select(WorkspaceMemberModel).where(
                        WorkspaceMemberModel.workspace_id == workspace_id,
                        WorkspaceMemberModel.user_id == user_id,
                    )
                )
            ).scalar_one_or_none()
            ws = (
                await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == workspace_id))
            ).scalar_one_or_none()
            if not ws or (ws.owner_user_id != user_id and not mem):
                raise HTTPException(
                    status_code=403,
                    detail="User is not an authorized member of this workspace.",
                )
        inst_q = select(GitHubInstallationModel).where(
            GitHubInstallationModel.workspace_id == workspace_id,
            GitHubInstallationModel.status == "ACTIVE",
        )
        if ext_installation_id:
            inst_q = inst_q.where(GitHubInstallationModel.installation_id == str(ext_installation_id))
        inst = (await session.execute(inst_q.order_by(GitHubInstallationModel.created_at.desc()))).scalars().first()
        if not inst:
            raise HTTPException(
                status_code=400,
                detail="No active GitHub App installation is connected to this workspace.",
            )

        cache_key = (workspace_id, inst.installation_id)
        now = datetime.now(timezone.utc)
        cached = GitHubService._token_cache.get(cache_key)
        if cached and cached[1] > now + timedelta(seconds=120):
            return cached[0], inst

        # Check encrypted DB credential
        cred = (
            await session.execute(
                select(IntegrationCredentialModel)
                .where(
                    IntegrationCredentialModel.workspace_id == workspace_id,
                    IntegrationCredentialModel.provider == "github_app",
                )
                .order_by(IntegrationCredentialModel.created_at.desc())
            )
        ).scalars().first()

        if cred and cred.encrypted_payload:
            try:
                payload = decrypt_credential_payload(cred.encrypted_payload)
                tok = str(payload.get("token") or "")
                exp = _parse_iso_dt(payload.get("expires_at"))
                if (
                    tok
                    and not tok.startswith("ghs_short_lived_")
                    and str(payload.get("installation_id")) == str(inst.installation_id)
                    and exp > now + timedelta(seconds=120)
                ):
                    GitHubService._token_cache[cache_key] = (tok, exp)
                    return tok, inst
            except (InvalidToken, ValueError, KeyError):
                logger.warning("Encrypted GitHub credential invalid for workspace=%s; refreshing from GitHub.", workspace_id)

        # Mint fresh token from GitHub App API and persist encrypted
        token, expires_at, permissions = await GitHubService._mint_installation_token(inst.installation_id)
        if permissions:
            inst.permissions = permissions
        inst.token_expires_at = expires_at

        encrypted = encrypt_credential_payload(
            {
                "installation_id": inst.installation_id,
                "token": token,
                "issued_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
            }
        )
        if cred:
            cred.encrypted_payload = encrypted
            cred.expires_at = expires_at
            cred.scopes = [f"{k}:{v}" for k, v in (inst.permissions or {}).items()]
        else:
            session.add(
                IntegrationCredentialModel(
                    id=f"cred_{uuid.uuid4().hex[:10]}",
                    workspace_id=workspace_id,
                    user_id=user_id or inst.user_id,
                    provider="github_app",
                    encrypted_payload=encrypted,
                    scopes=[f"{k}:{v}" for k, v in (inst.permissions or {}).items()],
                    expires_at=expires_at,
                )
            )
        await session.commit()
        GitHubService._token_cache[cache_key] = (token, expires_at)
        return token, inst

    @staticmethod
    async def _fetch_installation_repositories(token: str) -> List[Dict[str, Any]]:
        repos: List[Dict[str, Any]] = []
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                page = 1
                while True:
                    resp = await client.get(
                        f"{GITHUB_API_BASE}/installation/repositories",
                        params={"per_page": 100, "page": page},
                        headers=_github_headers(token, "token"),
                    )
                    if resp.status_code != 200:
                        detail = resp.json().get("message", resp.text) if resp.content else f"HTTP {resp.status_code}"
                        raise HTTPException(
                            status_code=502 if resp.status_code >= 500 else resp.status_code,
                            detail=f"GitHub repository discovery failed ({resp.status_code}): {detail}",
                        )
                    batch = resp.json().get("repositories", [])
                    repos.extend(batch)
                    if len(batch) < 100 or page >= 5:
                        break
                    page += 1
        except httpx.HTTPError as exc:
            logger.error("GitHub repository discovery network error: %s", type(exc).__name__)
            raise HTTPException(status_code=502, detail="Unable to reach GitHub API during repository discovery.")
        return repos

    @staticmethod
    async def _fetch_repo_branches_and_pulls(
        token: str,
        owner: str,
        repo_name: str,
    ) -> Tuple[List[str], List[Dict[str, Any]]]:
        branches: List[str] = []
        pulls: List[Dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=15.0) as client:
            br_resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/branches",
                params={"per_page": 30},
                headers=_github_headers(token, "token"),
            )
            if br_resp.status_code == 200:
                branches = [str(b["name"]) for b in br_resp.json() if b.get("name")]

            pr_resp = await client.get(
                f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/pulls",
                params={"state": "all", "per_page": 20},
                headers=_github_headers(token, "token"),
            )
            if pr_resp.status_code == 200:
                for pr in pr_resp.json():
                    pulls.append(GitHubService._format_github_pr(pr))
        return branches, pulls

    @staticmethod
    def _format_github_pr(pr: Dict[str, Any], diff_lines: int = 0) -> Dict[str, Any]:
        merged = bool(pr.get("merged_at"))
        state = str(pr.get("state") or "open").upper()
        status = "MERGED" if merged else state
        return {
            "number": int(pr["number"]),
            "title": str(pr.get("title") or ""),
            "head": str(((pr.get("head") or {}).get("ref")) or ""),
            "base": str(((pr.get("base") or {}).get("ref")) or ""),
            "status": status,
            "github_pr_status": "CREATED",
            "internal_approval_status": "APPROVED",
            "auto_merged": False,
            "url": str(pr.get("html_url") or ""),
            "diff_lines": diff_lines,
            "created_at": str(pr.get("created_at") or datetime.now(timezone.utc).isoformat()),
            "body": str(pr.get("body") or ""),
        }

    @staticmethod
    async def _verify_workspace_admin(
        session: AsyncSession,
        workspace_id: str,
        user_id: str,
    ) -> WorkspaceModel:
        ws = (
            await session.execute(select(WorkspaceModel).where(WorkspaceModel.id == workspace_id))
        ).scalar_one_or_none()
        if not ws:
            raise HTTPException(status_code=404, detail="Workspace not found.")
        if ws.owner_user_id == user_id:
            return ws
        mem = (
            await session.execute(
                select(WorkspaceMemberModel).where(
                    WorkspaceMemberModel.workspace_id == workspace_id,
                    WorkspaceMemberModel.user_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if not mem or str(mem.role).upper() not in {"OWNER", "ADMIN"}:
            raise HTTPException(
                status_code=403,
                detail="Only workspace OWNER or ADMIN members may manage GitHub App integrations.",
            )
        return ws

    @staticmethod
    async def verify_user_installation_access(
        github_user_token: str,
        installation_id: Optional[str] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Verify via GitHub /user and /user/installations that the authenticated GitHub user owns/can access the installation."""
        if not github_user_token:
            raise HTTPException(
                status_code=403,
                detail="Verified GitHub user OAuth authorization is required to connect an installation.",
            )
        async with httpx.AsyncClient(timeout=15.0) as client:
            user_resp = await client.get(
                f"{GITHUB_API_BASE}/user",
                headers=_github_headers(github_user_token, "Bearer"),
            )
            if user_resp.status_code != 200:
                raise HTTPException(
                    status_code=401,
                    detail="GitHub user OAuth token is invalid or expired.",
                )
            gh_login = str(user_resp.json().get("login") or "")

            inst_resp = await client.get(
                f"{GITHUB_API_BASE}/user/installations",
                headers=_github_headers(github_user_token, "Bearer"),
            )
            if inst_resp.status_code != 200:
                raise HTTPException(
                    status_code=502,
                    detail="Failed to verify user's authorized GitHub App installations.",
                )
            user_insts = inst_resp.json().get("installations", [])
            if not user_insts:
                raise HTTPException(
                    status_code=404,
                    detail=f"GitHub account '@{gh_login}' has no installations of this GitHub App. Install it at {GitHubService.get_install_url()}",
                )

            if installation_id:
                for inst in user_insts:
                    if str(inst.get("id")) == str(installation_id):
                        return gh_login, inst
                raise HTTPException(
                    status_code=403,
                    detail=f"GitHub account '@{gh_login}' is not authorized to access installation {installation_id}.",
                )

            return gh_login, user_insts[0]

    @staticmethod
    async def connect_github_app(
        session: AsyncSession,
        workspace_id: str,
        user_id: str,
        account_login: Optional[str] = None,
        installation_id: Optional[str] = None,
        github_user_token: Optional[str] = None,
    ) -> Dict[str, Any]:
        # Service-layer workspace OWNER/ADMIN enforcement
        await GitHubService._verify_workspace_admin(session, workspace_id, user_id)

        # SECURITY: Never allow unverified platform-level installation lookup to bind an installation to a workspace.
        if not github_user_token:
            raise HTTPException(
                status_code=403,
                detail=(
                    "Direct unverified GitHub App installation binding is disabled. "
                    "Complete GitHub App OAuth authorization (/api/github/oauth/start) to verify ownership of the GitHub installation."
                ),
            )

        verified_login, inst_meta = await GitHubService.verify_user_installation_access(
            github_user_token=github_user_token,
            installation_id=installation_id,
        )
        ext_inst_id = str(inst_meta["id"])
        acct = inst_meta.get("account") or {}
        resolved_login = str(acct.get("login") or verified_login or account_login or "")
        resolved_type = str(acct.get("type") or "User")
        perms = dict(inst_meta.get("permissions") or {})

        token, expires_at, minted_perms = await GitHubService._mint_installation_token(ext_inst_id)
        if minted_perms:
            perms = minted_perms

        # Deactivate prior installations in this workspace and upsert active one
        existing_insts = (
            await session.execute(
                select(GitHubInstallationModel).where(
                    GitHubInstallationModel.workspace_id == workspace_id
                )
            )
        ).scalars().all()
        inst: Optional[GitHubInstallationModel] = None
        for row in existing_insts:
            if row.installation_id == ext_inst_id:
                inst = row
            else:
                row.status = "DISCONNECTED"

        if inst is None:
            inst = GitHubInstallationModel(
                id=f"ghi_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                user_id=user_id,
                installation_id=ext_inst_id,
                account_login=resolved_login,
                account_type=resolved_type,
                permissions=perms,
                status="ACTIVE",
                token_expires_at=expires_at,
            )
            session.add(inst)
            await session.flush()
        else:
            inst.user_id = user_id
            inst.account_login = resolved_login
            inst.account_type = resolved_type
            inst.permissions = perms
            inst.status = "ACTIVE"
            inst.token_expires_at = expires_at

        # Replace encrypted github_app credential for this workspace
        await session.execute(
            delete(IntegrationCredentialModel).where(
                IntegrationCredentialModel.workspace_id == workspace_id,
                IntegrationCredentialModel.provider == "github_app",
            )
        )
        encrypted = encrypt_credential_payload(
            {
                "installation_id": ext_inst_id,
                "token": token,
                "issued_at": datetime.now(timezone.utc).isoformat(),
                "expires_at": expires_at.isoformat(),
            }
        )
        session.add(
            IntegrationCredentialModel(
                id=f"cred_{uuid.uuid4().hex[:10]}",
                workspace_id=workspace_id,
                user_id=user_id,
                provider="github_app",
                encrypted_payload=encrypted,
                scopes=[f"{k}:{v}" for k, v in perms.items()],
                expires_at=expires_at,
            )
        )
        GitHubService._token_cache[(workspace_id, ext_inst_id)] = (token, expires_at)

        # Discover real repositories from GitHub API
        gh_repos = await GitHubService._fetch_installation_repositories(token)
        connected_repos = await GitHubService._upsert_workspace_repos(
            session=session,
            workspace_id=workspace_id,
            user_id=user_id,
            inst=inst,
            token=token,
            gh_repos=gh_repos,
        )

        await session.commit()
        return {
            "status": "CONNECTED",
            "installation": GitHubService._serialize_installation(inst),
            "repositories": [GitHubService.serialize_repo(r) for r in connected_repos],
        }

    @staticmethod
    async def _upsert_workspace_repos(
        session: AsyncSession,
        workspace_id: str,
        user_id: str,
        inst: GitHubInstallationModel,
        token: str,
        gh_repos: List[Dict[str, Any]],
    ) -> List[ConnectedRepositoryModel]:
        connected_repos: List[ConnectedRepositoryModel] = []
        for r in gh_repos:
            full_name = str(r.get("full_name") or "")
            if not full_name:
                continue
            owner = str((r.get("owner") or {}).get("login") or full_name.split("/")[0])
            name = str(r.get("name") or full_name.split("/")[-1])
            default_branch = str(r.get("default_branch") or "main")
            branches, open_prs = await GitHubService._fetch_repo_branches_and_pulls(token, owner, name)
            if default_branch not in branches:
                branches = [default_branch] + branches

            existing = (
                await session.execute(
                    select(ConnectedRepositoryModel).where(
                        ConnectedRepositoryModel.workspace_id == workspace_id,
                        ConnectedRepositoryModel.full_name == full_name,
                    )
                )
            ).scalar_one_or_none()

            metadata_payload = {
                "branches": branches,
                "open_prs": open_prs,
                "permissions": inst.permissions or {},
                "synced_at": datetime.now(timezone.utc).isoformat(),
            }
            if existing:
                existing.installation_id = inst.id
                existing.default_branch = default_branch
                existing.clone_url = str(r.get("clone_url") or existing.clone_url)
                existing.html_url = str(r.get("html_url") or existing.html_url)
                existing.is_private = bool(r.get("private", False))
                existing.language = str(r.get("language") or existing.language or "Unknown")
                existing.repo_metadata = metadata_payload
                connected_repos.append(existing)
            else:
                repo_row = ConnectedRepositoryModel(
                    id=f"rep_{uuid.uuid4().hex[:10]}",
                    workspace_id=workspace_id,
                    user_id=user_id,
                    installation_id=inst.id,
                    full_name=full_name,
                    name=name,
                    owner=owner,
                    default_branch=default_branch,
                    clone_url=str(r.get("clone_url") or f"https://github.com/{full_name}.git"),
                    html_url=str(r.get("html_url") or f"https://github.com/{full_name}"),
                    is_private=bool(r.get("private", False)),
                    language=str(r.get("language") or "Unknown"),
                    repo_metadata=metadata_payload,
                )
                session.add(repo_row)
                connected_repos.append(repo_row)
        return connected_repos

    @staticmethod
    async def sync_workspace_repositories(
        session: AsyncSession,
        workspace_id: str,
        user_id: str,
    ) -> List[Dict[str, Any]]:
        token, inst = await GitHubService.get_installation_token(session, workspace_id, user_id=user_id)
        gh_repos = await GitHubService._fetch_installation_repositories(token)
        repos = await GitHubService._upsert_workspace_repos(
            session=session,
            workspace_id=workspace_id,
            user_id=user_id,
            inst=inst,
            token=token,
            gh_repos=gh_repos,
        )
        await session.commit()
        return [GitHubService.serialize_repo(r) for r in repos]

    @staticmethod
    async def sync_repository_pulls(
        session: AsyncSession,
        workspace_id: str,
        repo: ConnectedRepositoryModel,
    ) -> Dict[str, Any]:
        token, inst = await GitHubService.get_installation_token(session, workspace_id)
        branches, pulls = await GitHubService._fetch_repo_branches_and_pulls(token, repo.owner, repo.name)
        meta = dict(repo.repo_metadata or {})
        meta["branches"] = branches or [repo.default_branch]
        meta["open_prs"] = pulls
        meta["permissions"] = inst.permissions or {}
        meta["synced_at"] = datetime.now(timezone.utc).isoformat()
        repo.repo_metadata = meta
        await session.commit()
        return GitHubService.serialize_repo(repo)

    @staticmethod
    async def get_connection_status(
        session: AsyncSession,
        workspace_id: str,
    ) -> Dict[str, Any]:
        inst = (
            await session.execute(
                select(GitHubInstallationModel)
                .where(
                    GitHubInstallationModel.workspace_id == workspace_id,
                    GitHubInstallationModel.status == "ACTIVE",
                )
                .order_by(GitHubInstallationModel.created_at.desc())
            )
        ).scalars().first()
        repos = (
            await session.execute(
                select(ConnectedRepositoryModel).where(
                    ConnectedRepositoryModel.workspace_id == workspace_id
                )
            )
        ).scalars().all()

        if not inst:
            return {
                "status": "NOT_CONNECTED",
                "app_configured": GitHubService.is_app_configured(),
                "oauth_configured": bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET),
                "install_url": GitHubService.get_install_url(),
                "installation": None,
                "repositories": [GitHubService.serialize_repo(r) for r in repos],
            }

        return {
            "status": "CONNECTED",
            "app_configured": GitHubService.is_app_configured(),
            "oauth_configured": bool(settings.GITHUB_CLIENT_ID and settings.GITHUB_CLIENT_SECRET),
            "install_url": GitHubService.get_install_url(),
            "installation": GitHubService._serialize_installation(inst),
            "repositories": [GitHubService.serialize_repo(r) for r in repos],
        }

    @staticmethod
    async def disconnect_github_app(session: AsyncSession, workspace_id: str) -> Dict[str, Any]:
        insts = (
            await session.execute(
                select(GitHubInstallationModel).where(GitHubInstallationModel.workspace_id == workspace_id)
            )
        ).scalars().all()
        for inst in insts:
            inst.status = "DISCONNECTED"
            GitHubService._token_cache.pop((workspace_id, inst.installation_id), None)

        await session.execute(
            delete(IntegrationCredentialModel).where(
                IntegrationCredentialModel.workspace_id == workspace_id,
                IntegrationCredentialModel.provider == "github_app",
            )
        )
        await session.commit()
        return {"status": "NOT_CONNECTED"}

    @staticmethod
    def _validate_oauth_redirect_uri(redirect_uri: str) -> str:
        raw = (settings.GITHUB_OAUTH_REDIRECT_URI or redirect_uri or "").strip()
        if not raw:
            raise HTTPException(status_code=400, detail="Missing GitHub OAuth redirect_uri.")
        from urllib.parse import urlparse
        parsed = urlparse(raw)
        origin = f"{parsed.scheme}://{parsed.netloc}".lower()
        allowed = {o.strip().rstrip("/").lower() for o in (settings.CORS_ORIGINS or "").split(",") if o.strip()}
        if parsed.scheme not in ("http", "https") or origin not in allowed:
            raise HTTPException(status_code=400, detail="Untrusted GitHub OAuth redirect_uri origin.")
        return raw

    @staticmethod
    def create_oauth_authorization_url(
        workspace_id: str,
        user_id: str,
        redirect_uri: str,
    ) -> Dict[str, str]:
        if not settings.GITHUB_CLIENT_ID or not settings.GITHUB_CLIENT_SECRET:
            raise HTTPException(status_code=503, detail="GitHub OAuth client credentials are not configured.")

        effective_redirect = GitHubService._validate_oauth_redirect_uri(redirect_uri)

        # Prune expired states
        now_ts = time.time()
        expired = [k for k, v in GitHubService._oauth_states.items() if v["expires_at"] < now_ts]
        for k in expired:
            GitHubService._oauth_states.pop(k, None)

        state = secrets.token_urlsafe(32)
        code_verifier = secrets.token_urlsafe(64)
        digest = hashlib.sha256(code_verifier.encode("ascii")).digest()
        code_challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")

        GitHubService._oauth_states[state] = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "code_verifier": code_verifier,
            "redirect_uri": effective_redirect,
            "use_pkce": True,
            "expires_at": now_ts + 600,
        }

        install_state = secrets.token_urlsafe(32)
        GitHubService._oauth_states[install_state] = {
            "workspace_id": workspace_id,
            "user_id": user_id,
            "code_verifier": "",
            "redirect_uri": effective_redirect,
            "use_pkce": False,
            "expires_at": now_ts + 600,
        }

        params = urlencode(
            {
                "client_id": settings.GITHUB_CLIENT_ID,
                "redirect_uri": effective_redirect,
                "state": state,
                "code_challenge": code_challenge,
                "code_challenge_method": "S256",
            }
        )
        install_params = urlencode({"state": install_state})
        return {
            "authorize_url": f"https://github.com/login/oauth/authorize?{params}",
            "install_authorize_url": f"{GitHubService.get_install_url()}?{install_params}",
            "state": state,
            "install_state": install_state,
        }

    @staticmethod
    async def exchange_oauth_code(
        session: AsyncSession,
        state: str,
        code: str,
        workspace_id: str,
        user_id: str,
        installation_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        await GitHubService._verify_workspace_admin(session, workspace_id, user_id)

        # Constant-time state validation
        matched_key = None
        for candidate in list(GitHubService._oauth_states.keys()):
            if hmac.compare_digest(candidate, state):
                matched_key = candidate
                break
        if not matched_key:
            raise HTTPException(status_code=400, detail="Invalid or expired GitHub OAuth state parameter.")

        entry = GitHubService._oauth_states.pop(matched_key)
        if entry["expires_at"] < time.time():
            raise HTTPException(status_code=400, detail="GitHub OAuth state has expired.")
        if entry["workspace_id"] != workspace_id or entry["user_id"] != user_id:
            raise HTTPException(status_code=403, detail="GitHub OAuth state does not match the active user/workspace.")

        token_payload: Dict[str, str] = {
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "code": code,
        }
        if entry.get("use_pkce", True):
            token_payload["redirect_uri"] = entry["redirect_uri"]
            token_payload["code_verifier"] = entry["code_verifier"]

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                token_resp = await client.post(
                    "https://github.com/login/oauth/access_token",
                    headers={"Accept": "application/json"},
                    data=token_payload,
                )
                if token_resp.status_code != 200:
                    raise HTTPException(status_code=502, detail="GitHub OAuth token exchange failed.")
                token_data = token_resp.json()
                user_token = str(token_data.get("access_token") or "")
                if not user_token:
                    err_desc = token_data.get("error_description") or token_data.get("error") or "OAuth exchange failed"
                    raise HTTPException(status_code=400, detail=f"GitHub OAuth error: {err_desc}")

                user_resp = await client.get(f"{GITHUB_API_BASE}/user", headers=_github_headers(user_token, "Bearer"))
                if user_resp.status_code != 200:
                    raise HTTPException(status_code=502, detail="Failed to fetch GitHub user profile after OAuth.")
                gh_login = str(user_resp.json().get("login") or "")

                chosen_inst_id: Optional[str] = str(installation_id).strip() if installation_id else None
                if not chosen_inst_id:
                    inst_resp = await client.get(
                        f"{GITHUB_API_BASE}/user/installations",
                        headers=_github_headers(user_token, "Bearer"),
                    )
                    if inst_resp.status_code != 200:
                        raise HTTPException(status_code=502, detail="Failed to fetch GitHub user installations.")
                    insts = inst_resp.json().get("installations", [])
                    if insts:
                        chosen_inst_id = str(insts[0]["id"])
        except httpx.HTTPError as exc:
            logger.error("GitHub OAuth network error: %s", type(exc).__name__)
            raise HTTPException(status_code=502, detail="Unable to reach GitHub API during authorization.")

        return await GitHubService.connect_github_app(
            session=session,
            workspace_id=workspace_id,
            user_id=user_id,
            account_login=gh_login,
            installation_id=chosen_inst_id,
            github_user_token=user_token,
        )

    @staticmethod
    def _serialize_installation(inst: GitHubInstallationModel) -> Dict[str, Any]:
        return {
            "id": inst.id,
            "installation_id": inst.installation_id,
            "account_login": inst.account_login,
            "account_type": inst.account_type,
            "permissions": inst.permissions or {},
            "status": inst.status,
            "token_expires_at": inst.token_expires_at.isoformat() if inst.token_expires_at else None,
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
        protected = {repo.default_branch, "main", "master", "production", "release"}
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

        # Verify explicit internal approval exists and is APPROVED
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

        token, _ = await GitHubService.get_installation_token(session, repo.workspace_id)
        target_base = (base_branch or repo.default_branch).strip()

        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                resp = await client.post(
                    f"{GITHUB_API_BASE}/repos/{repo.owner}/{repo.name}/pulls",
                    headers=_github_headers(token, "token"),
                    json={
                        "title": title,
                        "head": head_branch.strip(),
                        "base": target_base,
                        "body": body,
                    },
                )
        except httpx.HTTPError as exc:
            logger.error("GitHub PR creation request failed for %s: %s", repo.full_name, type(exc).__name__)
            raise HTTPException(status_code=502, detail="Failed to reach GitHub API while creating Pull Request.")

        if resp.status_code != 201:
            err_body = resp.json() if resp.content else {}
            msg = err_body.get("message") or resp.text or f"HTTP {resp.status_code}"
            errors = err_body.get("errors")
            if errors:
                msg = f"{msg}: {errors}"
            status_map = {401: 401, 403: 403, 404: 404, 422: 422}
            raise HTTPException(
                status_code=status_map.get(resp.status_code, 502),
                detail=f"GitHub PR creation failed ({resp.status_code}): {msg}",
            )

        gh_pr = resp.json()
        if not gh_pr.get("html_url") or not gh_pr.get("number"):
            raise HTTPException(status_code=502, detail="GitHub returned an incomplete Pull Request response.")

        pr_record = GitHubService._format_github_pr(
            gh_pr,
            diff_lines=len(diff_text.splitlines()),
        )
        meta = dict(repo.repo_metadata or {})
        open_prs = [p for p in (meta.get("open_prs") or []) if p.get("number") != pr_record["number"]]
        open_prs.insert(0, pr_record)
        meta["open_prs"] = open_prs
        repo.repo_metadata = meta
        await session.commit()
        return pr_record
