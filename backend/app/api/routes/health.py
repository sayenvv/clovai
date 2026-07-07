from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter(prefix="/health", tags=["health"])


class HealthResponse(BaseModel):
    status: Literal["healthy"]
    service: str


@router.get("", response_model=HealthResponse, summary="Check API health")
async def health_check() -> HealthResponse:
    return HealthResponse(status="healthy", service="eleven-nodes-api")
