"""API keys that map a customer secret to one main workflow tab."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, ForeignKeyConstraint, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.user import utc_now


class OrchestrationApiKey(Base):
    __tablename__ = "orchestration_api_keys"
    __table_args__ = (
        ForeignKeyConstraint(
            ["page_id", "workspace_id"],
            ["pages.id", "pages.workspace_id"],
            ondelete="CASCADE",
            name="fk_orchestration_api_keys_page_workspace",
        ),
        UniqueConstraint("key_hash", name="uq_orchestration_api_keys_key_hash"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    key_prefix: Mapped[str] = mapped_column(String(16))
    key_hash: Mapped[str] = mapped_column(String(64), index=True)
    workspace_id: Mapped[str] = mapped_column(String(128), index=True)
    page_id: Mapped[str] = mapped_column(String(128), index=True)
    created_by_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
