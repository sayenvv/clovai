"""Load a tab plus nested sub-workflow definitions from storage."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.repositories import list_workspace_workflow_definitions


class WorkflowFamilyNotFoundError(LookupError):
    """Raised when the requested tab has no saved workflow JSON."""


def _referenced_tab_ids(definition: dict) -> set[str]:
    ids: set[str] = set()
    for agent in definition.get("agents") or []:
        if not isinstance(agent, dict):
            continue
        metadata = agent.get("metadata") or {}
        page_id = metadata.get("subWorkflowPageId")
        if isinstance(page_id, str) and page_id:
            ids.add(page_id)
    settings = definition.get("settings") or {}
    metadata = settings.get("metadata") if isinstance(settings, dict) else {}
    for nested in (metadata or {}).get("subWorkflows") or []:
        if not isinstance(nested, dict):
            continue
        page_id = nested.get("pageId")
        if isinstance(page_id, str) and page_id:
            ids.add(page_id)
    return ids


def _parent_map(definitions: dict[str, dict]) -> dict[str, str]:
    parents: dict[str, str] = {}
    for page_id, definition in definitions.items():
        for child_id in _referenced_tab_ids(definition):
            if child_id in definitions and child_id != page_id and child_id not in parents:
                parents[child_id] = page_id
    return parents


def _root_tab_id(tab_id: str, parents: dict[str, str]) -> str:
    current = tab_id
    seen: set[str] = set()
    while current in parents and current not in seen:
        seen.add(current)
        current = parents[current]
    return current


def _family_tab_ids(root_id: str, parents: dict[str, str]) -> list[str]:
    children: dict[str, list[str]] = {}
    for child_id, parent_id in parents.items():
        children.setdefault(parent_id, []).append(child_id)

    ordered: list[str] = []
    stack = [root_id]
    seen: set[str] = set()
    while stack:
        current = stack.pop()
        if current in seen:
            continue
        seen.add(current)
        ordered.append(current)
        stack.extend(reversed(children.get(current, [])))
    return ordered


def load_workflow_family(
    session: Session,
    workspace_id: str,
    tab_id: str,
) -> tuple[str, dict[str, dict], dict[str, str]]:
    stored = {
        page_id: definition
        for page_id, definition in list_workspace_workflow_definitions(session, workspace_id)
    }
    if tab_id not in stored:
        raise WorkflowFamilyNotFoundError(tab_id)
    parents = _parent_map(stored)
    root_tab_id = _root_tab_id(tab_id, parents)
    family_ids = _family_tab_ids(root_tab_id, parents)
    family = {page_id: stored[page_id] for page_id in family_ids if page_id in stored}
    return root_tab_id, family, parents
