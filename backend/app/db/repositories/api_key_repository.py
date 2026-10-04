"""Create hashed customer API keys bound to a main workflow tab."""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import OrchestrationApiKey, Page

KEY_SCHEME = "enk_"
PREFIX_LENGTH = 12


@dataclass(frozen=True, slots=True)
class CreatedApiKey:
    record: OrchestrationApiKey
    secret: str


def hash_api_key(secret: str) -> str:
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


def generate_api_key_secret() -> str:
    return f"{KEY_SCHEME}{secrets.token_urlsafe(32)}"


def create_orchestration_api_key(
    session: Session,
    *,
    workspace_id: str,
    page_id: str,
    name: str,
    created_by_user_id: str,
) -> CreatedApiKey:
    page = session.get(Page, page_id)
    if page is None or page.workspace_id != workspace_id:
        raise ValueError("Page does not belong to this workspace")

    secret = generate_api_key_secret()
    record = OrchestrationApiKey(
        id=str(uuid4()),
        name=name.strip() or "API key",
        key_prefix=secret[:PREFIX_LENGTH],
        key_hash=hash_api_key(secret),
        workspace_id=workspace_id,
        page_id=page_id,
        created_by_user_id=created_by_user_id,
        is_active=True,
    )
    session.add(record)
    session.commit()
    session.refresh(record)
    return CreatedApiKey(record=record, secret=secret)


def list_orchestration_api_keys(
    session: Session,
    workspace_id: str,
) -> list[OrchestrationApiKey]:
    return list(
        session.scalars(
            select(OrchestrationApiKey)
            .where(OrchestrationApiKey.workspace_id == workspace_id)
            .order_by(OrchestrationApiKey.created_at.desc())
        )
    )


def get_orchestration_api_key(session: Session, key_id: str) -> OrchestrationApiKey | None:
    return session.get(OrchestrationApiKey, key_id)


def lookup_orchestration_api_key(session: Session, secret: str) -> OrchestrationApiKey | None:
    if not secret.strip():
        return None
    record = session.scalar(
        select(OrchestrationApiKey).where(
            OrchestrationApiKey.key_hash == hash_api_key(secret.strip()),
            OrchestrationApiKey.is_active.is_(True),
        )
    )
    return record


def touch_orchestration_api_key(session: Session, record: OrchestrationApiKey) -> None:
    record.last_used_at = datetime.now(UTC)
    session.commit()


def revoke_orchestration_api_key(session: Session, key_id: str) -> OrchestrationApiKey | None:
    record = session.get(OrchestrationApiKey, key_id)
    if record is None:
        return None
    record.is_active = False
    session.commit()
    session.refresh(record)
    return record
