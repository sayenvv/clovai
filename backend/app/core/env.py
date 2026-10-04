"""Load environment variables from standard project locations."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import dotenv_values

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent


def _apply_dotenv(path: Path, *, override: bool) -> None:
    if not path.is_file():
        return
    for key, value in dotenv_values(path).items():
        if value is None or not str(value).strip():
            continue
        current = os.environ.get(key, "")
        if override or not current.strip():
            os.environ[key] = str(value).strip()


def load_project_env() -> None:
    """Load `.env` from repo root and `backend/.env` (backend non-empty values win)."""
    _apply_dotenv(REPO_ROOT / ".env", override=True)
    _apply_dotenv(BACKEND_ROOT / ".env", override=True)
