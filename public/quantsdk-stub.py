# quantsdk stub — runs inside Pyodide (browser Python)
# Provides a compatible subset of the real QuantSDK API
# Copyright 2026 TheQuantAI

import math
import random
from collections import Counter

__version__ = "0.1.0 (browser)"


# ─── Complex helpers ─────────────────────────────────────────────

def _cmul(a, b):
    return (a[0]*b[0] - a[1]*b[1], a[0]*b[1] + a[1]*b[0])

def _cadd(a, b):
    return (a[0]+b[0], a[1]+b[1])

def _cnorm2(a):
    return a[0]*a[0] + a[1]*a[1]


# ─── Gate matrices ───────────────────────────────────────────────

_S2 = 1 / math.sqrt(2)

GATES = {
    "h":   [[(  _S2, 0), ( _S2, 0)], [( _S2, 0), (-_S2, 0)]],
    "x":   [[(    0, 0), (   1, 0)], [(   1, 0), (    0, 0)]],
    "y":   [[(    0, 0), (  0, -1)], [(   0, 1), (    0, 0)]],
    "z":   [[(    1, 0), (   0, 0)], [(   0, 0), (   -1, 0)]],
    "s":   [[(    1, 0), (   0, 0)], [(   0, 0), (    0, 1)]],
    "t":   [[(    1, 0), (   0, 0)], [(   0, 0), (math.cos(math.pi/4), math.sin(math.pi/4))]],
    "sdg": [[(    1, 0), (   0, 0)], [(   0, 0), (   0, -1)]],
    "tdg": [[(    1, 0), (   0, 0)], [(   0, 0), (math.cos(math.pi/4), -math.sin(math.pi/4))]],
    "sx":  [[(0.5, 0.5), (0.5,-0.5)], [(0.5,-0.5), (0.5, 0.5)]],
}


def _rx(theta):
    c, s = math.cos(theta/2), math.sin(theta/2)
    return [[(c, 0), (0, -s)], [(0, -s), (c, 0)]]

def _ry(theta):
    c, s = math.cos(theta/2), math.sin(theta/2)
    return [[(c, 0), (-s, 0)], [(s, 0), (c, 0)]]

def _rz(theta):
    c, s = math.cos(theta/2), math.sin(theta/2)
    return [[(c, -s), (0, 0)], [(0, 0), (c, s)]]


# ─── State-vector simulation core ────────────────────────────────

def _apply_single(state, n, qubit, mat):
    dim = 1 << n
    bit = 1 << (n - 1 - qubit)
    for i in range(dim):
        if i & bit:
            continue
        j = i | bit
        a, b = state[i], state[j]
        state[i] = _cadd(_cmul(mat[0][0], a), _cmul(mat[0][1], b))
        state[j] = _cadd(_cmul(mat[1][0], a), _cmul(mat[1][1], b))


def _apply_controlled(state, n, ctrl, tgt, mat):
    dim = 1 << n
    cb = 1 << (n - 1 - ctrl)
    tb = 1 << (n - 1 - tgt)
    for i in range(dim):
        if not (i & cb):
            continue
        if i & tb:
            continue
        j = i | tb
        a, b = state[i], state[j]
        state[i] = _cadd(_cmul(mat[0][0], a), _cmul(mat[0][1], b))
        state[j] = _cadd(_cmul(mat[1][0], a), _cmul(mat[1][1], b))


def _apply_swap(state, n, q1, q2):
    dim = 1 << n
    b1 = 1 << (n - 1 - q1)
    b2 = 1 << (n - 1 - q2)
    for i in range(dim):
        v1 = 1 if (i & b1) else 0
        v2 = 1 if (i & b2) else 0
        if v1 == v2 or v1 < v2:
            continue
        j = i ^ b1 ^ b2
        state[i], state[j] = state[j], state[i]


def _apply_ccx(state, n, c1, c2, tgt):
    dim = 1 << n
    c1b = 1 << (n - 1 - c1)
    c2b = 1 << (n - 1 - c2)
    tb  = 1 << (n - 1 - tgt)
    for i in range(dim):
        if not (i & c1b) or not (i & c2b):
            continue
        if i & tb:
            continue
        j = i | tb
        state[i], state[j] = state[j], state[i]


def _sample(state, n, shots):
    dim = len(state)
    probs = [_cnorm2(s) for s in state]
    total = sum(probs)
    if total > 0:
        probs = [p / total for p in probs]
    # Cumulative distribution
    cum = []
    acc = 0
    for p in probs:
        acc += p
        cum.append(acc)
    counts = Counter()
    for _ in range(shots):
        r = random.random()
        lo, hi = 0, dim - 1
        while lo < hi:
            mid = (lo + hi) // 2
            if cum[mid] < r:
                lo = mid + 1
            else:
                hi = mid
        bs = format(lo, f"0{n}b")
        counts[bs] += 1
    return dict(counts)


# ─── Circuit diagram ─────────────────────────────────────────────

def _draw_circuit(n, ops):
    wires = [f"q{q}: ──" for q in range(n)]
    for op in ops:
        kind = op[0]
        if kind == "barrier":
            continue
        if kind == "measure":
            for q in range(n):
                wires[q] += "M──"
        elif kind == "single":
            _, gate, qubit = op[:3]
            label = gate.upper()
            for q in range(n):
                if q == qubit:
                    wires[q] += f"[{label}]──"
                else:
                    wires[q] += "─" * (len(label) + 2) + "──"
        elif kind == "controlled":
            _, gate, ctrl, tgt = op[:4]
            label = gate.upper()
            for q in range(n):
                if q == ctrl:
                    wires[q] += f"●{'─' * (len(label)+1)}──"
                elif q == tgt:
                    wires[q] += f"[{label}]──"
                elif min(ctrl, tgt) < q < max(ctrl, tgt):
                    wires[q] += f"│{'─' * (len(label)+1)}──"
                else:
                    wires[q] += "─" * (len(label) + 2) + "──"
        elif kind == "swap":
            _, q1, q2 = op
            for q in range(n):
                if q in (q1, q2):
                    wires[q] += "✕────"
                else:
                    wires[q] += "─────"
        elif kind == "ccx":
            _, c1, c2, tgt = op
            for q in range(n):
                if q in (c1, c2):
                    wires[q] += "●────"
                elif q == tgt:
                    wires[q] += "[X]──"
                else:
                    wires[q] += "─────"
    return "\n".join(wires)


# ─── Public API ──────────────────────────────────────────────────

class Result:
    """Execution result from a quantum circuit run."""
    def __init__(self, counts, shots, n_qubits, diagram, gate_count, depth, exec_time):
        self.counts = counts
        self.shots = shots
        total = sum(counts.values())
        self.probabilities = {k: round(v / total, 4) for k, v in counts.items()}
        sorted_states = sorted(counts.items(), key=lambda x: -x[1])
        self.most_likely = sorted_states[0][0] if sorted_states else "0" * n_qubits
        self.num_qubits = n_qubits
        self.circuit_diagram = diagram
        self.gate_count = gate_count
        self.circuit_depth = depth
        self.execution_time = exec_time
        self.backend = "browser_pyodide"
        self.metadata = {
            "num_qubits": n_qubits,
            "circuit_depth": depth,
            "gate_count": gate_count,
            "simulator": "pyodide-statevector",
        }

    def __repr__(self):
        top = sorted(self.counts.items(), key=lambda x: -x[1])[:8]
        lines = [f"Result(shots={self.shots}, states={len(self.counts)})"]
        for state, count in top:
            pct = count / self.shots * 100
            lines.append(f"  |{state}⟩ : {count:>5}  ({pct:.1f}%)")
        if len(self.counts) > 8:
            lines.append(f"  ... and {len(self.counts) - 8} more states")
        return "\n".join(lines)


class Circuit:
    """Quantum circuit for QuantSDK."""

    def __init__(self, n_qubits=2, name="circuit"):
        if n_qubits > 20:
            raise ValueError(f"Browser simulator supports up to 20 qubits (got {n_qubits})")
        self.n_qubits = n_qubits
        self.name = name
        self._ops = []       # list of tuples describing operations
        self._gate_count = 0
        self._qubit_layers = [0] * n_qubits

    def _track(self, qubits):
        layer = max(self._qubit_layers[q] for q in qubits) + 1
        for q in qubits:
            self._qubit_layers[q] = layer
        self._gate_count += 1

    # Single-qubit gates
    def h(self, q):   self._ops.append(("single", "h", q)); self._track([q])
    def x(self, q):   self._ops.append(("single", "x", q)); self._track([q])
    def y(self, q):   self._ops.append(("single", "y", q)); self._track([q])
    def z(self, q):   self._ops.append(("single", "z", q)); self._track([q])
    def s(self, q):   self._ops.append(("single", "s", q)); self._track([q])
    def t(self, q):   self._ops.append(("single", "t", q)); self._track([q])
    def sdg(self, q): self._ops.append(("single", "sdg", q)); self._track([q])
    def tdg(self, q): self._ops.append(("single", "tdg", q)); self._track([q])
    def sx(self, q):  self._ops.append(("single", "sx", q)); self._track([q])
    def id(self, q):  pass  # identity no-op

    # Parameterized single-qubit
    def rx(self, theta, q): self._ops.append(("single", "rx", q, theta)); self._track([q])
    def ry(self, theta, q): self._ops.append(("single", "ry", q, theta)); self._track([q])
    def rz(self, theta, q): self._ops.append(("single", "rz", q, theta)); self._track([q])
    def p(self, theta, q):  self._ops.append(("single", "rz", q, theta)); self._track([q])
    def phase(self, theta, q): self.p(theta, q)
    def u1(self, theta, q): self.p(theta, q)

    # Two-qubit gates
    def cx(self, ctrl, tgt):  self._ops.append(("controlled", "x", ctrl, tgt)); self._track([ctrl, tgt])
    def cnot(self, ctrl, tgt): self.cx(ctrl, tgt)
    def cz(self, ctrl, tgt):  self._ops.append(("controlled", "z", ctrl, tgt)); self._track([ctrl, tgt])
    def cy(self, ctrl, tgt):  self._ops.append(("controlled", "y", ctrl, tgt)); self._track([ctrl, tgt])
    def ch(self, ctrl, tgt):  self._ops.append(("controlled", "h", ctrl, tgt)); self._track([ctrl, tgt])
    def crx(self, theta, ctrl, tgt): self._ops.append(("controlled", "rx", ctrl, tgt, theta)); self._track([ctrl, tgt])
    def cry(self, theta, ctrl, tgt): self._ops.append(("controlled", "ry", ctrl, tgt, theta)); self._track([ctrl, tgt])
    def crz(self, theta, ctrl, tgt): self._ops.append(("controlled", "rz", ctrl, tgt, theta)); self._track([ctrl, tgt])
    def swap(self, q1, q2): self._ops.append(("swap", q1, q2)); self._track([q1, q2])

    # Three-qubit gates
    def ccx(self, c1, c2, tgt): self._ops.append(("ccx", c1, c2, tgt)); self._track([c1, c2, tgt])
    def toffoli(self, c1, c2, tgt): self.ccx(c1, c2, tgt)

    # Measurement
    def measure_all(self): self._ops.append(("measure",))
    def measure(self, q): self._ops.append(("measure",))

    # Barriers (cosmetic)
    def barrier(self, *qubits): self._ops.append(("barrier",))

    def draw(self):
        """Return ASCII circuit diagram."""
        return _draw_circuit(self.n_qubits, self._ops)

    @property
    def depth(self):
        return max(self._qubit_layers) if self._qubit_layers else 0

    @property
    def gate_count(self):
        return self._gate_count

    def __repr__(self):
        return f"Circuit(n_qubits={self.n_qubits}, name='{self.name}', gates={self._gate_count}, depth={self.depth})"


def run(circuit, shots=1024, backend="simulator"):
    """Execute a quantum circuit and return results."""
    import time
    t0 = time.time()

    n = circuit.n_qubits
    dim = 1 << n
    state = [(0, 0)] * dim
    state[0] = (1, 0)

    for op in circuit._ops:
        kind = op[0]
        if kind in ("barrier", "measure"):
            continue
        if kind == "single":
            gate = op[1]
            qubit = op[2]
            theta = op[3] if len(op) > 3 else None
            if gate in ("rx", "ry", "rz") and theta is not None:
                mat = {"rx": _rx, "ry": _ry, "rz": _rz}[gate](theta)
            elif gate in GATES:
                mat = GATES[gate]
            else:
                continue
            _apply_single(state, n, qubit, mat)
        elif kind == "controlled":
            gate = op[1]
            ctrl, tgt = op[2], op[3]
            theta = op[4] if len(op) > 4 else None
            if gate in ("rx", "ry", "rz") and theta is not None:
                mat = {"rx": _rx, "ry": _ry, "rz": _rz}[gate](theta)
            elif gate in GATES:
                mat = GATES[gate]
            else:
                continue
            _apply_controlled(state, n, ctrl, tgt, mat)
        elif kind == "swap":
            _apply_swap(state, n, op[1], op[2])
        elif kind == "ccx":
            _apply_ccx(state, n, op[1], op[2], op[3])

    counts = _sample(state, n, shots)
    elapsed = time.time() - t0
    diagram = _draw_circuit(n, circuit._ops)

    return Result(counts, shots, n, diagram, circuit.gate_count, circuit.depth, elapsed)
