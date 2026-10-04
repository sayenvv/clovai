"""Create hashed customer API keys bound to a main workflow tab.

Revision ID: 20261004_0002
Revises: 20260713_0001
Create Date: 2026-10-04
"""

from typing import Sequence

from alembic import op
import sqlalchemy as sa


revision: str = "20261004_0002"
down_revision: str | None = "20260713_0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "orchestration_api_keys",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("key_prefix", sa.String(length=16), nullable=False),
        sa.Column("key_hash", sa.String(length=64), nullable=False),
        sa.Column("workspace_id", sa.String(length=128), nullable=False),
        sa.Column("page_id", sa.String(length=128), nullable=False),
        sa.Column("created_by_user_id", sa.String(length=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["created_by_user_id"],
            ["users.id"],
            name=op.f("fk_orchestration_api_keys_created_by_user_id_users"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["page_id", "workspace_id"],
            ["pages.id", "pages.workspace_id"],
            name="fk_orchestration_api_keys_page_workspace",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_orchestration_api_keys")),
        sa.UniqueConstraint("key_hash", name="uq_orchestration_api_keys_key_hash"),
    )
    op.create_index(
        op.f("ix_orchestration_api_keys_key_hash"),
        "orchestration_api_keys",
        ["key_hash"],
        unique=False,
    )
    op.create_index(
        op.f("ix_orchestration_api_keys_workspace_id"),
        "orchestration_api_keys",
        ["workspace_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_orchestration_api_keys_page_id"),
        "orchestration_api_keys",
        ["page_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_orchestration_api_keys_created_by_user_id"),
        "orchestration_api_keys",
        ["created_by_user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_orchestration_api_keys_created_by_user_id"),
        table_name="orchestration_api_keys",
    )
    op.drop_index(op.f("ix_orchestration_api_keys_page_id"), table_name="orchestration_api_keys")
    op.drop_index(
        op.f("ix_orchestration_api_keys_workspace_id"),
        table_name="orchestration_api_keys",
    )
    op.drop_index(op.f("ix_orchestration_api_keys_key_hash"), table_name="orchestration_api_keys")
    op.drop_table("orchestration_api_keys")
