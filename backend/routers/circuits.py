# Copyright 2026 TheQuantAI
# Licensed under the Apache License, Version 2.0

"""
Circuits router — /api/circuits

CRUD operations for saved circuits.
For v0.1, uses in-memory storage. Will migrate to PostgreSQL + S3 in Sprint 3.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from backend.models import (
    CircuitResponse,
    SaveCircuitRequest,
    UpdateCircuitRequest,
)

router = APIRouter(prefix="/api/circuits", tags=["circuits"])

# In-memory circuit store (v0.1)
# Will be replaced with PostgreSQL + S3 in Sprint 3
_circuits: dict[str, dict] = {}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@router.post("", response_model=CircuitResponse, status_code=201)
async def create_circuit(request: SaveCircuitRequest) -> CircuitResponse:
    """Save a new circuit."""
    circuit_id = uuid.uuid4().hex[:12]
    now = _now_iso()
    circuit = {
        "id": circuit_id,
        "name": request.name,
        "code": request.code,
        "description": request.description,
        "user_id": request.user_id,
        "created_at": now,
        "updated_at": now,
    }
    _circuits[circuit_id] = circuit
    return CircuitResponse(**circuit)


@router.get("", response_model=list[CircuitResponse])
async def list_circuits(
    user_id: str = Query(default=None, description="Filter by user ID"),
) -> list[CircuitResponse]:
    """List saved circuits, optionally filtered by user."""
    circuits = _circuits.values()
    if user_id:
        circuits = [c for c in circuits if c.get("user_id") == user_id]
    return [CircuitResponse(**c) for c in circuits]


@router.get("/{circuit_id}", response_model=CircuitResponse)
async def get_circuit(circuit_id: str) -> CircuitResponse:
    """Get a specific circuit by ID."""
    if circuit_id not in _circuits:
        raise HTTPException(status_code=404, detail=f"Circuit '{circuit_id}' not found")
    return CircuitResponse(**_circuits[circuit_id])


@router.put("/{circuit_id}", response_model=CircuitResponse)
async def update_circuit(circuit_id: str, request: UpdateCircuitRequest) -> CircuitResponse:
    """Update an existing circuit."""
    if circuit_id not in _circuits:
        raise HTTPException(status_code=404, detail=f"Circuit '{circuit_id}' not found")

    circuit = _circuits[circuit_id]
    if request.name is not None:
        circuit["name"] = request.name
    if request.code is not None:
        circuit["code"] = request.code
    if request.description is not None:
        circuit["description"] = request.description
    circuit["updated_at"] = _now_iso()

    return CircuitResponse(**circuit)


@router.delete("/{circuit_id}", status_code=204)
async def delete_circuit(circuit_id: str) -> None:
    """Delete a circuit."""
    if circuit_id not in _circuits:
        raise HTTPException(status_code=404, detail=f"Circuit '{circuit_id}' not found")
    del _circuits[circuit_id]
