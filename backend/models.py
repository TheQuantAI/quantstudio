# Copyright 2026 TheQuantAI
# Licensed under the Apache License, Version 2.0

"""
Pydantic models for QuantStudio API.

Defines request/response schemas for all API endpoints.
"""

from __future__ import annotations

from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


# ─── Enums ───


class BackendType(str, Enum):
    SIMULATOR = "simulator"
    HARDWARE = "hardware"


class BackendStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    MAINTENANCE = "maintenance"
    BUSY = "busy"


class JobStatus(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


# ─── Request Models ───


class RunCircuitRequest(BaseModel):
    """Request to execute a quantum circuit."""

    code: str = Field(..., description="Python code using QuantSDK to build and run a circuit")
    shots: int = Field(default=1024, ge=1, le=100_000, description="Number of measurement shots")
    backend: str = Field(default="simulator_cpu", description="Backend identifier")


class SaveCircuitRequest(BaseModel):
    """Request to save a circuit."""

    name: str = Field(..., min_length=1, max_length=200, description="Circuit name")
    code: str = Field(..., min_length=1, description="Circuit Python code")
    description: str = Field(default="", max_length=1000)
    user_id: str = Field(default="anonymous", description="Owner user ID")


class UpdateCircuitRequest(BaseModel):
    """Request to update a circuit."""

    name: str | None = Field(default=None, min_length=1, max_length=200)
    code: str | None = Field(default=None, min_length=1)
    description: str | None = Field(default=None, max_length=1000)


# ─── Response Models ───


class BackendInfo(BaseModel):
    """Information about a quantum backend."""

    id: str
    name: str
    provider: str
    type: BackendType
    qubits: int
    status: BackendStatus
    queue_depth: int = 0
    avg_fidelity: float = 1.0
    cost_per_shot: float = 0.0
    description: str = ""
    technology: str = ""  # e.g. "superconducting", "trapped-ion", "photonic", "cpu", "gpu"
    native_gates: list[str] = Field(default_factory=list)
    connectivity: str = ""  # e.g. "all-to-all", "linear", "heavy-hex"
    max_shots: int = 100_000
    avg_queue_time_sec: float = 0.0  # estimated wait time
    region: str = ""  # e.g. "us-east", "eu-west", "asia"
    features: list[str] = Field(default_factory=list)


class ExecutionResult(BaseModel):
    """Result of circuit execution."""

    counts: dict[str, int]
    probabilities: dict[str, float]
    most_likely: str
    shots: int
    backend: str
    execution_time: float
    job_id: str
    circuit_diagram: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class CircuitResponse(BaseModel):
    """Saved circuit response."""

    id: str
    name: str
    code: str
    description: str
    user_id: str = "anonymous"
    created_at: str
    updated_at: str


class JobResponse(BaseModel):
    """Job status response."""

    job_id: str
    status: JobStatus
    backend: str
    result: ExecutionResult | None = None
    error: str | None = None


class HealthResponse(BaseModel):
    """Health check response."""

    status: str = "ok"
    version: str
    backends_available: int
