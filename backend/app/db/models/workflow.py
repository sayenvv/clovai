"""Current persisted JSON workflow for a page."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.types import JSON_DOCUMENT
from app.db.models.user import utc_now


class Workflow(Base):
    __tablename__ = "workflows"
    __table_args__ = (
        ForeignKeyConstraint(
            ["page_id", "workspace_id"],
            ["pages.id", "pages.workspace_id"],
            ondelete="CASCADE",
            name="fk_workflows_page_workspace",
        ),
        UniqueConstraint("page_id", name="uq_workflows_page_id"),
        CheckConstraint(
            "status IN ('draft', 'validated', 'deployed', 'archived')", name="status"
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    workflow_id: Mapped[str] = mapped_column(String(128), index=True)
    workspace_id: Mapped[str] = mapped_column(String(128), index=True)
    page_id: Mapped[str] = mapped_column(String(128))
    created_by_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    updated_by_user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"), index=True
    )
    definition: Mapped[dict[str, Any]] = mapped_column(JSON_DOCUMENT)
    schema_version: Mapped[str] = mapped_column(String(32))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )
