"""Diagram generation API routes."""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.modules.diagrams.flowchart_generator import (
    GenerateFlowchartRequest,
    GenerateFlowchartResponse,
    generate_flowchart_plan,
)

router = APIRouter(prefix="/diagrams", tags=["diagrams"])


@router.post(
    "/generate-flowchart",
    response_model=GenerateFlowchartResponse,
    summary="Generate a flowchart plan from a natural-language chat prompt",
)
async def generate_flowchart_route(body: GenerateFlowchartRequest) -> GenerateFlowchartResponse:
    try:
        return generate_flowchart_plan(body)
    except RuntimeError as error:
        raise HTTPException(status_code=502, detail=str(error)) from error
