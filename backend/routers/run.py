# Copyright 2026 TheQuantAI
# Licensed under the Apache License, Version 2.0

"""
Run router — /api/run

Executes quantum circuits using QuantSDK.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, HTTPException

from backend.executor import ExecutionError, execute_circuit
from backend.models import ExecutionResult, RunCircuitRequest
from backend.routers.results import store_result

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/run", tags=["execution"])


@router.post("", response_model=ExecutionResult)
async def run_circuit(request: RunCircuitRequest) -> ExecutionResult:
    """Execute a quantum circuit.

    Accepts Python code that uses QuantSDK, executes it on the
    local simulator, and returns structured results including
    counts, probabilities, circuit diagram, and metadata.

    For v0.1, all execution happens on the local CPU simulator
    regardless of the backend parameter. Hardware backends will
    be connected in Sprint 3 (Cloud Beta).
    """
    try:
        result = execute_circuit(
            code=request.code,
            shots=request.shots,
            backend=request.backend,
        )
        execution_result = ExecutionResult(**result)

        # Store result for /api/results/{job_id} retrieval
        store_result(execution_result.job_id, execution_result)

        return execution_result

    except ExecutionError as e:
        logger.warning("Circuit execution error: %s", e)
        raise HTTPException(status_code=400, detail=str(e)) from e

    except Exception as e:
        logger.exception("Unexpected error during circuit execution")
        raise HTTPException(
            status_code=500,
            detail=f"Internal execution error: {type(e).__name__}: {e}",
        ) from e
