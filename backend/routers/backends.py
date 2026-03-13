# Copyright 2026 TheQuantAI
# Licensed under the Apache License, Version 2.0

"""
Backends router — /api/backends

Lists available quantum backends with status, capabilities, and pricing.
"""

from __future__ import annotations

from fastapi import APIRouter

from backend.models import BackendInfo, BackendStatus, BackendType

router = APIRouter(prefix="/api/backends", tags=["backends"])

# Phase 1 backends — per Phase1_Implementation.md Section 11.2
# Enhanced with rich metadata for backend comparison view (Task 11)
AVAILABLE_BACKENDS: list[BackendInfo] = [
    BackendInfo(
        id="simulator_cpu",
        name="CPU Simulator",
        provider="TheQuantCloud",
        type=BackendType.SIMULATOR,
        qubits=25,
        status=BackendStatus.ONLINE,
        queue_depth=0,
        avg_fidelity=1.0,
        cost_per_shot=0.0,
        description="High-performance statevector simulator running on multi-core CPUs. Perfect fidelity, ideal for development and debugging.",
        technology="cpu",
        native_gates=["H", "X", "Y", "Z", "CX", "CZ", "RX", "RY", "RZ", "S", "T", "SWAP", "CCX"],
        connectivity="all-to-all",
        max_shots=1_000_000,
        avg_queue_time_sec=0.0,
        region="local",
        features=["statevector", "perfect-fidelity", "instant-execution", "free-tier"],
    ),
    BackendInfo(
        id="simulator_gpu",
        name="GPU Simulator (cuQuantum)",
        provider="TheQuantCloud",
        type=BackendType.SIMULATOR,
        qubits=32,
        status=BackendStatus.ONLINE,
        queue_depth=2,
        avg_fidelity=1.0,
        cost_per_shot=0.001,
        description="NVIDIA cuQuantum-accelerated simulator. Handles up to 32 qubits with massive parallelism for complex circuits.",
        technology="gpu",
        native_gates=["H", "X", "Y", "Z", "CX", "CZ", "RX", "RY", "RZ", "S", "T", "SWAP", "CCX"],
        connectivity="all-to-all",
        max_shots=10_000_000,
        avg_queue_time_sec=5.0,
        region="us-east",
        features=["gpu-accelerated", "statevector", "cuQuantum", "high-qubit-count"],
    ),
    BackendInfo(
        id="ibm_brisbane",
        name="IBM Brisbane",
        provider="IBM Quantum",
        type=BackendType.HARDWARE,
        qubits=127,
        status=BackendStatus.ONLINE,
        queue_depth=15,
        avg_fidelity=0.92,
        cost_per_shot=0.003,
        description="127-qubit Eagle r3 processor with heavy-hex topology. Production-grade superconducting QPU from IBM Quantum Network.",
        technology="superconducting",
        native_gates=["CX", "ID", "RZ", "SX", "X"],
        connectivity="heavy-hex",
        max_shots=100_000,
        avg_queue_time_sec=120.0,
        region="us-east",
        features=["error-mitigation", "dynamic-circuits", "mid-circuit-measurement", "Qiskit-native"],
    ),
    BackendInfo(
        id="ionq_harmony",
        name="IonQ Harmony",
        provider="IonQ",
        type=BackendType.HARDWARE,
        qubits=11,
        status=BackendStatus.ONLINE,
        queue_depth=5,
        avg_fidelity=0.95,
        cost_per_shot=0.01,
        description="11-qubit trapped-ion system with all-to-all connectivity. High gate fidelity ideal for algorithms needing long-range entanglement.",
        technology="trapped-ion",
        native_gates=["GPI", "GPI2", "MS"],
        connectivity="all-to-all",
        max_shots=10_000,
        avg_queue_time_sec=60.0,
        region="us-east",
        features=["all-to-all-connectivity", "high-fidelity", "algorithmic-qubits"],
    ),
    BackendInfo(
        id="ionq_aria",
        name="IonQ Aria",
        provider="IonQ",
        type=BackendType.HARDWARE,
        qubits=25,
        status=BackendStatus.BUSY,
        queue_depth=42,
        avg_fidelity=0.97,
        cost_per_shot=0.03,
        description="25-qubit trapped-ion system with industry-leading fidelity (#AQ 25). Best for variational and optimization algorithms.",
        technology="trapped-ion",
        native_gates=["GPI", "GPI2", "MS"],
        connectivity="all-to-all",
        max_shots=10_000,
        avg_queue_time_sec=300.0,
        region="us-east",
        features=["all-to-all-connectivity", "highest-fidelity", "algorithmic-qubits", "debiasing"],
    ),
    BackendInfo(
        id="rigetti_ankaa2",
        name="Rigetti Ankaa-2",
        provider="Rigetti",
        type=BackendType.HARDWARE,
        qubits=84,
        status=BackendStatus.ONLINE,
        queue_depth=8,
        avg_fidelity=0.93,
        cost_per_shot=0.005,
        description="84-qubit superconducting processor with tunable couplers. Fast gate speeds and competitive fidelity via Quil compilation.",
        technology="superconducting",
        native_gates=["CZ", "RZ", "RX", "MEASURE"],
        connectivity="square-octagonal",
        max_shots=100_000,
        avg_queue_time_sec=90.0,
        region="us-west",
        features=["tunable-couplers", "fast-reset", "parametric-compilation", "Quil-native"],
    ),
    BackendInfo(
        id="quantinuum_h1",
        name="Quantinuum H1-1",
        provider="Quantinuum",
        type=BackendType.HARDWARE,
        qubits=20,
        status=BackendStatus.ONLINE,
        queue_depth=12,
        avg_fidelity=0.998,
        cost_per_shot=0.05,
        description="20-qubit trapped-ion system with industry-best 2-qubit gate fidelity (99.8%). Racetrack architecture enables all-to-all connectivity.",
        technology="trapped-ion",
        native_gates=["RZ", "U1q", "ZZ"],
        connectivity="all-to-all",
        max_shots=10_000,
        avg_queue_time_sec=180.0,
        region="us-east",
        features=["highest-2Q-fidelity", "all-to-all-connectivity", "mid-circuit-measurement", "TKET-native"],
    ),
    BackendInfo(
        id="simulator_noisy",
        name="Noisy Simulator",
        provider="TheQuantCloud",
        type=BackendType.SIMULATOR,
        qubits=20,
        status=BackendStatus.ONLINE,
        queue_depth=0,
        avg_fidelity=0.95,
        cost_per_shot=0.0,
        description="Simulates realistic hardware noise models (depolarizing, thermal relaxation, readout errors). Useful for testing error mitigation strategies.",
        technology="cpu",
        native_gates=["H", "X", "Y", "Z", "CX", "CZ", "RX", "RY", "RZ"],
        connectivity="all-to-all",
        max_shots=100_000,
        avg_queue_time_sec=0.0,
        region="local",
        features=["noise-model", "error-simulation", "depolarizing-noise", "free-tier"],
    ),
]


@router.get("", response_model=list[BackendInfo])
async def list_backends() -> list[BackendInfo]:
    """List all available quantum backends.

    Returns backends with their current status, qubit count,
    fidelity, queue depth, and pricing information.
    """
    return AVAILABLE_BACKENDS


@router.get("/{backend_id}", response_model=BackendInfo)
async def get_backend(backend_id: str) -> BackendInfo:
    """Get details for a specific backend."""
    for backend in AVAILABLE_BACKENDS:
        if backend.id == backend_id:
            return backend
    from fastapi import HTTPException

    raise HTTPException(status_code=404, detail=f"Backend '{backend_id}' not found")
