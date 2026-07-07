"""Load environment variables from standard project locations."""

from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv

BACKEND_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = BACKEND_ROOT.parent


def load_project_env() -> None:
    """Load `.env` from repo root and `backend/.env` (backend overrides root)."""
    load_dotenv(REPO_ROOT / ".env")
    load_dotenv(BACKEND_ROOT / ".env", override=True)
