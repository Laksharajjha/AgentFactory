#!/usr/bin/env python3
"""One-time, idempotent CLI to provision the initial PLATFORM_ADMIN account.

Usage (interactive secure prompt):
    backend/.venv/bin/python backend/scripts/bootstrap_platform_admin.py --email admin@company.com --name "Platform Admin"
"""

import argparse
import asyncio
import getpass
from pathlib import Path
import sys
import uuid

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import select  # noqa: E402

from app.auth.auth_service import AuthService, hash_password  # noqa: E402
from app.database import AsyncSessionLocal, init_db, privileged_rls_context  # noqa: E402
from app.models import UserModel, WorkspaceMemberModel, WorkspaceModel  # noqa: E402


MIN_PASSWORD_LENGTH = 12


def _read_secure_password(password_stdin: bool) -> str:
    if password_stdin:
        if sys.stdin.isatty():
            raise SystemExit("Error: --password-stdin requires piped stdin, not an interactive TTY.")
        raw = sys.stdin.readline().rstrip("\r\n")
        if len(raw) < MIN_PASSWORD_LENGTH:
            raise SystemExit(f"Error: Password must be at least {MIN_PASSWORD_LENGTH} characters.")
        return raw

    if not sys.stdin.isatty():
        raise SystemExit(
            "Error: No interactive TTY available for secure password prompt. "
            "Run this script in an interactive terminal or pass --password-stdin."
        )

    pw1 = getpass.getpass(f"Administrator password (min {MIN_PASSWORD_LENGTH} chars): ")
    if len(pw1) < MIN_PASSWORD_LENGTH:
        raise SystemExit(f"Error: Password must be at least {MIN_PASSWORD_LENGTH} characters.")
    pw2 = getpass.getpass("Confirm administrator password: ")
    if pw1 != pw2:
        raise SystemExit("Error: Passwords do not match.")
    return pw1


async def provision_platform_admin(
    email: str,
    name: str,
    role_title: str,
    promote_existing: bool,
    confirm_promote: bool,
    password_stdin: bool,
) -> int:
    clean_email = email.strip().lower()
    if not clean_email or "@" not in clean_email:
        print("Error: A valid administrator email is required.", file=sys.stderr)
        return 1

    await init_db()

    async with AsyncSessionLocal() as session:
        async with privileged_rls_context(session):
            existing_user = (
                await session.execute(select(UserModel).where(UserModel.email == clean_email))
            ).scalar_one_or_none()

            if existing_user:
                ws, ws_role = await AuthService.ensure_personal_workspace_for_user(session, existing_user)
                if existing_user.platform_role == "PLATFORM_ADMIN":
                    print(
                        f"Idempotent no-op: user {existing_user.id} ({clean_email}) "
                        f"is already PLATFORM_ADMIN in workspace {ws.id} (role={ws_role})."
                    )
                    return 0

                if not promote_existing:
                    print(
                        f"Refused: user {existing_user.id} ({clean_email}) already exists with "
                        f"platform_role={existing_user.platform_role}. Pass --promote-existing to promote.",
                        file=sys.stderr,
                    )
                    return 2

                if not confirm_promote:
                    if not sys.stdin.isatty():
                        print(
                            "Refused: promoting an existing user requires interactive confirmation "
                            "or --confirm-promote.",
                            file=sys.stderr,
                        )
                        return 2
                    ack = input(f"Type '{clean_email}' to confirm promoting this user to PLATFORM_ADMIN: ").strip().lower()
                    if ack != clean_email:
                        print("Aborted: confirmation did not match.", file=sys.stderr)
                        return 2

                existing_user.platform_role = "PLATFORM_ADMIN"
                existing_user.is_active = True
                await session.commit()
                await AuthService.record_audit(
                    session=session,
                    tenant_id=ws.tenant_id,
                    user_id=existing_user.id,
                    workspace_id=ws.id,
                    actor_type="SYSTEM_CLI",
                    actor_id="bootstrap_platform_admin",
                    action="PLATFORM_ADMIN_PROMOTED",
                    resource_type="user",
                    resource_id=existing_user.id,
                    status="COMPLETED",
                    details={"email": clean_email, "workspace_id": ws.id},
                )
                print(
                    f"Promoted existing user {existing_user.id} ({clean_email}) to PLATFORM_ADMIN "
                    f"with workspace {ws.id} (role={ws_role})."
                )
                return 0

            password = _read_secure_password(password_stdin=password_stdin)
            user_id = f"usr_{uuid.uuid4().hex[:10]}"
            user = UserModel(
                id=user_id,
                name=name.strip(),
                email=clean_email,
                password_hash=hash_password(password),
                role=role_title.strip() or "Platform Administrator",
                platform_role="PLATFORM_ADMIN",
                email_verified=True,
                auth_provider="local",
                is_active=True,
            )
            session.add(user)
            await session.flush()

            ws, ws_role = await AuthService.ensure_personal_workspace_for_user(session, user)
            await AuthService.record_audit(
                session=session,
                tenant_id=ws.tenant_id,
                user_id=user.id,
                workspace_id=ws.id,
                actor_type="SYSTEM_CLI",
                actor_id="bootstrap_platform_admin",
                action="PLATFORM_ADMIN_BOOTSTRAPPED",
                resource_type="user",
                resource_id=user.id,
                status="COMPLETED",
                details={"email": clean_email, "workspace_id": ws.id, "workspace_role": ws_role},
            )
            print(
                f"Provisioned PLATFORM_ADMIN user {user.id} ({clean_email}) "
                f"with workspace {ws.id} (role={ws_role})."
            )
            return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Secure, one-time idempotent bootstrap for the initial PLATFORM_ADMIN account."
    )
    parser.add_argument("--email", required=True, help="Administrator email address")
    parser.add_argument("--name", default="Platform Administrator", help="Administrator display name")
    parser.add_argument("--role-title", default="Platform Administrator", help="Job/role title")
    parser.add_argument(
        "--promote-existing",
        action="store_true",
        help="Explicitly allow promoting an existing user to PLATFORM_ADMIN",
    )
    parser.add_argument(
        "--confirm-promote",
        action="store_true",
        help="Non-interactive confirmation flag when used with --promote-existing",
    )
    parser.add_argument(
        "--password-stdin",
        action="store_true",
        help="Read password from stdin instead of interactive getpass prompt",
    )
    args = parser.parse_args()
    return asyncio.run(
        provision_platform_admin(
            email=args.email,
            name=args.name,
            role_title=args.role_title,
            promote_existing=args.promote_existing,
            confirm_promote=args.confirm_promote,
            password_stdin=args.password_stdin,
        )
    )


if __name__ == "__main__":
    raise SystemExit(main())
