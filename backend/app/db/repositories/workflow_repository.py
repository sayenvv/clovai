"""Transactional persistence for workflow JSON and its ownership hierarchy."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Page, User, Workflow, Workspace, WorkspaceMember
from app.modules.workflows import WorkflowBuildSpec


@dataclass(frozen=True, slots=True)
class PersistenceActor:
    user_id: str
    email: str
    full_name: str
    role: str = "developer"
    workspace_name: str = "Workspace"
    account_type: str = "individual"


@dataclass(frozen=True, slots=True)
class StoredWorkflow:
    record_id: str
    workspace_id: str
    page_id: str
    workflow_id: str
    saved_at: datetime


def _ensure_user(session: Session, actor: PersistenceActor) -> User:
    user = session.get(User, actor.user_id)
    if user is None:
        user = User(
            id=actor.user_id,
            email=actor.email,
            full_name=actor.full_name,
            role=actor.role,
        )
        session.add(user)
        session.flush()
        return user

    user.email = actor.email
    user.full_name = actor.full_name
    user.role = actor.role
    return user


def _ensure_workspace(
    session: Session,
    workspace_id: str,
    actor: PersistenceActor,
) -> Workspace:
    workspace = session.get(Workspace, workspace_id)
    if workspace is None:
        workspace = Workspace(
            id=workspace_id,
            owner_user_id=actor.user_id,
            name=actor.workspace_name,
            account_type=actor.account_type,
        )
        session.add(workspace)
        session.flush()

    membership = session.get(WorkspaceMember, (workspace_id, actor.user_id))
    if membership is None:
        membership = WorkspaceMember(
            workspace_id=workspace_id,
            user_id=actor.user_id,
            role="owner" if workspace.owner_user_id == actor.user_id else "editor",
        )
        session.add(membership)
    return workspace


def _ensure_page(
    session: Session,
    spec: WorkflowBuildSpec,
    actor: PersistenceActor,
) -> Page:
    page = session.get(Page, spec.meta.page_id)
    if page is not None and page.workspace_id != spec.meta.workspace_id:
        raise ValueError("Page ID already belongs to another workspace")

    if page is None:
        page = Page(
            id=spec.meta.page_id,
            workspace_id=spec.meta.workspace_id,
            created_by_user_id=actor.user_id,
            name=spec.meta.page_name,
        )
        session.add(page)
    else:
        page.name = spec.meta.page_name
    return page


def save_workflow_definition(
    session: Session,
    spec: WorkflowBuildSpec,
    actor: PersistenceActor,
) -> StoredWorkflow:
    """Provision parent rows and upsert the page's current workflow atomically."""
    saved_at = datetime.now(UTC)
    payload = spec.model_dump(mode="json", by_alias=True)
    payload["meta"]["savedAt"] = saved_at.isoformat()

    with session.begin():
        _ensure_user(session, actor)
        _ensure_workspace(session, spec.meta.workspace_id, actor)
        _ensure_page(session, spec, actor)
        session.flush()

        workflow = session.scalar(
            select(Workflow).where(
                Workflow.workspace_id == spec.meta.workspace_id,
                Workflow.page_id == spec.meta.page_id,
            )
        )
        if workflow is None:
            workflow = Workflow(
                id=str(uuid4()),
                workflow_id=spec.meta.workflow_id,
                workspace_id=spec.meta.workspace_id,
                page_id=spec.meta.page_id,
                created_by_user_id=actor.user_id,
                updated_by_user_id=actor.user_id,
                definition=payload,
                schema_version=spec.meta.schema_version,
                version=spec.meta.workflow_version,
                status=spec.meta.status,
                created_at=spec.meta.created_at,
                updated_at=saved_at,
            )
            session.add(workflow)
        else:
            workflow.workflow_id = spec.meta.workflow_id
            workflow.updated_by_user_id = actor.user_id
            workflow.definition = payload
            workflow.schema_version = spec.meta.schema_version
            workflow.version = spec.meta.workflow_version
            workflow.status = spec.meta.status
            workflow.updated_at = saved_at
        session.flush()
        record_id = workflow.id

    return StoredWorkflow(
        record_id=record_id,
        workspace_id=spec.meta.workspace_id,
        page_id=spec.meta.page_id,
        workflow_id=spec.meta.workflow_id,
        saved_at=saved_at,
    )


def load_workflow_definition(
    session: Session,
    workspace_id: str,
    page_id: str,
) -> dict | None:
    return session.scalar(
        select(Workflow.definition).where(
            Workflow.workspace_id == workspace_id,
            Workflow.page_id == page_id,
        )
    )
