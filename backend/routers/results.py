# Copyright 2026 TheQuantAI
# Licensed under the Apache License, Version 2.0

"""
Results router — /api/results

Fetch execution results by job ID.
For v0.1, results are stored in-memory after execution.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models import ExecutionResult

router = APIRouter(prefix="/api/results", tags=["results"])

# In-memory results store (v0.1)
# Will be replaced with S3 + Redis in Sprint 3
_results: dict[str, ExecutionResult] = {}


def store_result(job_id: str, result: ExecutionResult) -> None:
    """Store an execution result (called by the run endpoint)."""
    _results[job_id] = result


@router.get("/{job_id}", response_model=ExecutionResult)
async def get_result(job_id: str) -> ExecutionResult:
    """Retrieve execution results for a specific job.

    Results are available immediately for local simulator execution.
    For hardware backends (Sprint 3+), results may take time to become available.
    """
    if job_id not in _results:
        raise HTTPException(
            status_code=404,
            detail=f"Result for job '{job_id}' not found. "
            "It may have expired or the job ID may be incorrect.",
        )
    return _results[job_id]


@router.get("", response_model=list[ExecutionResult])
async def list_results() -> list[ExecutionResult]:
    """List all available results (most recent first)."""
    return list(reversed(_results.values()))
