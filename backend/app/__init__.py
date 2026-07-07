"""ClovAI backend application.

The source checkout keeps ``eleven_nodes`` as a separately publishable package
under ``backend/packages``.  Make that source package importable when running
the API directly from a checkout, before an editable install has been refreshed.
Production wheels include both packages via the backend build configuration.
"""

from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


def _enable_source_checkout_packages() -> None:
    if importlib.util.find_spec("eleven_nodes") is not None:
        return
    package_source = Path(__file__).resolve().parents[1] / "packages" / "elevennodes" / "src"
    if package_source.is_dir():
        sys.path.insert(0, str(package_source))


_enable_source_checkout_packages()
