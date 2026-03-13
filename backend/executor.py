# Copyright 2026 TheQuantAI
# Licensed under the Apache License, Version 2.0

"""
Circuit Executor — runs QuantSDK circuits safely.

Executes user-submitted Python code in a restricted environment,
extracts the circuit and result, and returns structured data.
"""

from __future__ import annotations

import logging
import time
import uuid
from typing import Any

logger = logging.getLogger(__name__)


class ExecutionError(Exception):
    """Raised when circuit execution fails."""

    pass


def execute_circuit(code: str, shots: int = 1024, backend: str = "simulator_cpu") -> dict[str, Any]:
    """Execute a QuantSDK circuit from Python source code.

    This function:
    1. Executes the user's code in a sandboxed namespace
    2. Extracts Circuit objects created via QuantSDK
    3. Runs the circuit on the local simulator
    4. Returns structured results including circuit diagram

    Args:
        code: Python source code that uses QuantSDK.
        shots: Number of measurement shots.
        backend: Backend identifier (only local simulators for v0.1).

    Returns:
        Dictionary with execution results.

    Raises:
        ExecutionError: If execution fails.
    """
    import quantsdk as qs
    from quantsdk.circuit import Circuit
    from quantsdk.result import Result

    start_time = time.time()
    job_id = f"job-{uuid.uuid4().hex[:12]}"

    # Prepare a restricted execution namespace
    # In v0.1 we use a basic sandbox. Production will use containerized execution.
    namespace: dict[str, Any] = {
        "qs": qs,
        "quantsdk": qs,
        "math": __import__("math"),
    }

    # Track circuits and results created during execution
    circuits_created: list[Circuit] = []
    results_created: list[Result] = []

    # Monkey-patch Circuit.__init__ to capture circuit instances
    original_init = Circuit.__init__

    def capturing_init(self: Circuit, *args: Any, **kwargs: Any) -> None:
        original_init(self, *args, **kwargs)
        circuits_created.append(self)

    # Monkey-patch qs.run to capture results and override shots/backend
    original_run = qs.run

    def capturing_run(
        circuit: Circuit,
        shots: int = shots,
        backend: str | None = None,
        **kwargs: Any,
    ) -> Result:
        # Always use local simulator for v0.1
        result = original_run(circuit, shots=shots, seed=kwargs.get("seed"))
        results_created.append(result)
        return result

    try:
        # Apply patches
        Circuit.__init__ = capturing_init  # type: ignore[method-assign]
        namespace["qs"].run = capturing_run
        namespace["quantsdk"].run = capturing_run

        # Block dangerous builtins but allow whitelisted imports
        ALLOWED_MODULES = {"quantsdk", "math", "cmath", "random", "itertools", "functools", "collections"}

        def _restricted_import(name: str, *args: Any, **kwargs: Any) -> Any:
            top_level = name.split(".")[0]
            if top_level not in ALLOWED_MODULES:
                raise ImportError(f"Module '{name}' is not allowed. Only QuantSDK and math-related modules are permitted.")
            return __builtins__["__import__"](name, *args, **kwargs) if isinstance(__builtins__, dict) else __import__(name, *args, **kwargs)

        safe_builtins = {
            "__import__": _restricted_import,
            "print": print,
            "range": range,
            "len": len,
            "int": int,
            "float": float,
            "str": str,
            "list": list,
            "dict": dict,
            "tuple": tuple,
            "set": set,
            "bool": bool,
            "abs": abs,
            "min": min,
            "max": max,
            "sum": sum,
            "round": round,
            "enumerate": enumerate,
            "zip": zip,
            "map": map,
            "filter": filter,
            "sorted": sorted,
            "reversed": reversed,
            "True": True,
            "False": False,
            "None": None,
        }
        namespace["__builtins__"] = safe_builtins

        # Execute user code
        exec(code, namespace)  # noqa: S102

    except Exception as e:
        raise ExecutionError(f"Circuit execution failed: {type(e).__name__}: {e}") from e
    finally:
        # Restore original functions
        Circuit.__init__ = original_init  # type: ignore[method-assign]
        qs.run = original_run

    execution_time = time.time() - start_time

    # Extract results
    if not circuits_created:
        raise ExecutionError(
            "No quantum circuit was created. "
            "Make sure your code creates a qs.Circuit() object."
        )

    # Use the last circuit created and last result (if any)
    circuit = circuits_created[-1]
    circuit_diagram = circuit.draw()

    if results_created:
        result = results_created[-1]
        return {
            "counts": result.counts,
            "probabilities": result.probabilities,
            "most_likely": result.most_likely,
            "shots": result.shots,
            "backend": result.backend,
            "execution_time": round(execution_time, 4),
            "job_id": job_id,
            "circuit_diagram": circuit_diagram,
            "metadata": {
                "num_qubits": circuit.num_qubits,
                "circuit_depth": circuit.depth,
                "gate_count": circuit.gate_count,
                **result.metadata,
            },
        }
    else:
        # Code didn't call qs.run() — run it ourselves
        if not any(g.name == "MEASURE" for g in circuit.gates):
            circuit.measure_all()

        result = qs.run(circuit, shots=shots)
        execution_time = time.time() - start_time

        return {
            "counts": result.counts,
            "probabilities": result.probabilities,
            "most_likely": result.most_likely,
            "shots": result.shots,
            "backend": result.backend,
            "execution_time": round(execution_time, 4),
            "job_id": job_id,
            "circuit_diagram": circuit_diagram,
            "metadata": {
                "num_qubits": circuit.num_qubits,
                "circuit_depth": circuit.depth,
                "gate_count": circuit.gate_count,
                **result.metadata,
            },
        }
