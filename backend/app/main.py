from fastapi import FastAPI

from app.api.router import api_router
from app.core.env import load_project_env


def create_app() -> FastAPI:
    load_project_env()
    application = FastAPI(
        title="Eleven Nodes API",
        version="0.1.0",
        description="Backend API for the Eleven Nodes platform.",
    )
    application.include_router(api_router, prefix="/api")
    return application


app = create_app()
