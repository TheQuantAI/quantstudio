// Copyright 2026 TheQuantAI
// Client-side quantum circuit simulator for QuantStudio
// Parses QuantSDK Python code and simulates in the browser

// ─── Complex number helpers ─────────────────────────────────────

type Complex = [number, number]; // [real, imag]

function cmul(a: Complex, b: Complex): Complex {
  return [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
}

function cadd(a: Complex, b: Complex): Complex {
  return [a[0] + b[0], a[1] + b[1]];
}

function cnorm2(a: Complex): number {
  return a[0] * a[0] + a[1] * a[1];
}

// ─── Gate matrices (2x2 and controlled) ─────────────────────────

const SQRT2_INV = 1 / Math.sqrt(2);

const GATES: Record<string, Complex[][]> = {
  h: [
    [[SQRT2_INV, 0], [SQRT2_INV, 0]],
    [[SQRT2_INV, 0], [-SQRT2_INV, 0]],
  ],
  x: [
    [[0, 0], [1, 0]],
    [[1, 0], [0, 0]],
  ],
  y: [
    [[0, 0], [0, -1]],
    [[0, 1], [0, 0]],
  ],
  z: [
    [[1, 0], [0, 0]],
    [[0, 0], [-1, 0]],
  ],
  s: [
    [[1, 0], [0, 0]],
    [[0, 0], [0, 1]],
  ],
  t: [
    [[1, 0], [0, 0]],
    [[0, 0], [Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)]],
  ],
  sdg: [
    [[1, 0], [0, 0]],
    [[0, 0], [0, -1]],
  ],
  tdg: [
    [[1, 0], [0, 0]],
    [[0, 0], [Math.cos(Math.PI / 4), -Math.sin(Math.PI / 4)]],
  ],
  sx: [
    [[0.5, 0.5], [0.5, -0.5]],
    [[0.5, -0.5], [0.5, 0.5]],
  ],
};

function rxMatrix(theta: number): Complex[][] {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [[c, 0], [0, -s]],
    [[0, -s], [c, 0]],
  ];
}

function ryMatrix(theta: number): Complex[][] {
  const c = Math.cos(theta / 2);
  const s = Math.sin(theta / 2);
  return [
    [[c, 0], [-s, 0]],
    [[s, 0], [c, 0]],
  ];
}

function rzMatrix(theta: number): Complex[][] {
  return [
    [[Math.cos(theta / 2), -Math.sin(theta / 2)], [0, 0]],
    [[0, 0], [Math.cos(theta / 2), Math.sin(theta / 2)]],
  ];
}

// ─── Statevector simulation ─────────────────────────────────────

interface GateOp {
  type: "single" | "controlled" | "swap" | "ccx" | "measure" | "barrier";
  gate?: string;
  qubit?: number;
  control?: number;
  control2?: number;
  target?: number;
  q1?: number;
  q2?: number;
  param?: number;
}

function applySingleQubitGate(
  state: Complex[],
  nQubits: number,
  qubit: number,
  matrix: Complex[][]
): void {
  const dim = 1 << nQubits;
  const bit = 1 << (nQubits - 1 - qubit);

  for (let i = 0; i < dim; i++) {
    if (i & bit) continue; // process pairs once
    const j = i | bit;
    const a = state[i];
    const b = state[j];
    state[i] = cadd(cmul(matrix[0][0], a), cmul(matrix[0][1], b));
    state[j] = cadd(cmul(matrix[1][0], a), cmul(matrix[1][1], b));
  }
}

function applyControlledGate(
  state: Complex[],
  nQubits: number,
  control: number,
  target: number,
  matrix: Complex[][]
): void {
  const dim = 1 << nQubits;
  const controlBit = 1 << (nQubits - 1 - control);
  const targetBit = 1 << (nQubits - 1 - target);

  for (let i = 0; i < dim; i++) {
    if (!(i & controlBit)) continue; // control must be 1
    if (i & targetBit) continue; // process pairs once
    const j = i | targetBit;
    const a = state[i];
    const b = state[j];
    state[i] = cadd(cmul(matrix[0][0], a), cmul(matrix[0][1], b));
    state[j] = cadd(cmul(matrix[1][0], a), cmul(matrix[1][1], b));
  }
}

function applySwap(
  state: Complex[],
  nQubits: number,
  q1: number,
  q2: number
): void {
  const dim = 1 << nQubits;
  const bit1 = 1 << (nQubits - 1 - q1);
  const bit2 = 1 << (nQubits - 1 - q2);

  for (let i = 0; i < dim; i++) {
    const b1 = (i & bit1) ? 1 : 0;
    const b2 = (i & bit2) ? 1 : 0;
    if (b1 === b2) continue;
    if (b1 > b2) continue; // process each pair once
    const j = i ^ bit1 ^ bit2;
    const tmp = state[i];
    state[i] = state[j];
    state[j] = tmp;
  }
}

function applyCCX(
  state: Complex[],
  nQubits: number,
  c1: number,
  c2: number,
  target: number
): void {
  const dim = 1 << nQubits;
  const c1Bit = 1 << (nQubits - 1 - c1);
  const c2Bit = 1 << (nQubits - 1 - c2);
  const tBit = 1 << (nQubits - 1 - target);

  for (let i = 0; i < dim; i++) {
    if (!(i & c1Bit) || !(i & c2Bit)) continue;
    if (i & tBit) continue;
    const j = i | tBit;
    const tmp = state[i];
    state[i] = state[j];
    state[j] = tmp;
  }
}

// ─── Python code parser ─────────────────────────────────────────

function parsePythonCode(code: string): { nQubits: number; ops: GateOp[]; circuitName: string } {
  let nQubits = 2;
  let circuitName = "circuit";
  const ops: GateOp[] = [];

  // Find circuit variable name and qubit count
  // Patterns: qs.Circuit(2), qs.Circuit(n_qubits=3), Circuit(4, name="x")
  const circuitDeclRegex = /(\w+)\s*=\s*(?:qs|quantsdk)\.Circuit\(\s*(?:n_qubits\s*=\s*)?(\d+)/g;
  let match: RegExpExecArray | null;
  let circuitVar = "circuit";

  while ((match = circuitDeclRegex.exec(code)) !== null) {
    circuitVar = match[1];
    nQubits = parseInt(match[2], 10);
  }

  // Extract circuit name if present
  const nameMatch = code.match(/Circuit\([^)]*name\s*=\s*["']([^"']+)["']/);
  if (nameMatch) circuitName = nameMatch[1];

  // Parse gate operations line by line
  const lines = code.split("\n");
  const varPattern = new RegExp(`^\\s*${circuitVar}\\.(\\w+)\\(([^)]*)\\)`, "");

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#") || trimmed === "") continue;

    const gateMatch = trimmed.match(new RegExp(`${circuitVar}\\.(\\w+)\\(([^)]*)\\)`));
    if (!gateMatch) continue;

    const gateName = gateMatch[1].toLowerCase();
    const argsStr = gateMatch[2].trim();
    const args = argsStr
      ? argsStr.split(",").map((a) => {
          const stripped = a.trim();
          // Evaluate simple math expressions like math.pi/4
          const mathResolved = stripped
            .replace(/math\.pi/g, String(Math.PI))
            .replace(/np\.pi/g, String(Math.PI))
            .replace(/pi/g, String(Math.PI));
          try {
            return Function(`"use strict"; return (${mathResolved})`)() as number;
          } catch {
            return parseFloat(stripped) || 0;
          }
        })
      : [];

    // Single-qubit gates
    if (["h", "x", "y", "z", "s", "t", "sdg", "tdg", "sx", "id"].includes(gateName)) {
      if (gateName === "id") continue; // identity — no-op
      ops.push({ type: "single", gate: gateName, qubit: args[0] });
    }
    // Parameterized single-qubit gates
    else if (["rx", "ry", "rz", "p", "phase", "u1"].includes(gateName)) {
      const normalizedGate = gateName === "p" || gateName === "phase" || gateName === "u1" ? "rz" : gateName;
      ops.push({ type: "single", gate: normalizedGate, qubit: args[1] !== undefined ? args[1] : args[0], param: args[0] });
    }
    // Two-qubit gates
    else if (["cx", "cnot"].includes(gateName)) {
      ops.push({ type: "controlled", gate: "x", control: args[0], target: args[1] });
    } else if (gateName === "cz") {
      ops.push({ type: "controlled", gate: "z", control: args[0], target: args[1] });
    } else if (gateName === "cy") {
      ops.push({ type: "controlled", gate: "y", control: args[0], target: args[1] });
    } else if (gateName === "ch") {
      ops.push({ type: "controlled", gate: "h", control: args[0], target: args[1] });
    } else if (gateName === "crx") {
      ops.push({ type: "controlled", gate: "rx", control: args[1], target: args[2], param: args[0] });
    } else if (gateName === "cry") {
      ops.push({ type: "controlled", gate: "ry", control: args[1], target: args[2], param: args[0] });
    } else if (gateName === "crz") {
      ops.push({ type: "controlled", gate: "rz", control: args[1], target: args[2], param: args[0] });
    }
    // SWAP
    else if (gateName === "swap") {
      ops.push({ type: "swap", q1: args[0], q2: args[1] });
    }
    // Toffoli
    else if (["ccx", "toffoli"].includes(gateName)) {
      ops.push({ type: "ccx", control: args[0], control2: args[1], target: args[2] });
    }
    // Measure
    else if (gateName === "measure_all" || gateName === "measure") {
      ops.push({ type: "measure" });
    }
    // Barrier — cosmetic, skip
    else if (gateName === "barrier") {
      ops.push({ type: "barrier" });
    }
  }

  return { nQubits, ops, circuitName };
}

// ─── Generate circuit diagram (text) ────────────────────────────

function generateCircuitDiagram(nQubits: number, ops: GateOp[]): string {
  const wires: string[] = [];
  for (let q = 0; q < nQubits; q++) {
    wires.push(`q${q}: ──`);
  }

  for (const op of ops) {
    if (op.type === "barrier") continue;
    if (op.type === "measure") {
      for (let q = 0; q < nQubits; q++) wires[q] += "M──";
      continue;
    }
    if (op.type === "single" && op.qubit !== undefined) {
      const label = (op.gate || "U").toUpperCase();
      for (let q = 0; q < nQubits; q++) {
        if (q === op.qubit) {
          wires[q] += `[${label}]──`;
        } else {
          wires[q] += "─".repeat(label.length + 2) + "──";
        }
      }
    } else if (op.type === "controlled" && op.control !== undefined && op.target !== undefined) {
      const label = (op.gate || "X").toUpperCase();
      for (let q = 0; q < nQubits; q++) {
        if (q === op.control) {
          wires[q] += `●${"─".repeat(label.length + 1)}──`;
        } else if (q === op.target) {
          wires[q] += `[${label}]──`;
        } else if (
          (q > Math.min(op.control, op.target)) &&
          (q < Math.max(op.control, op.target))
        ) {
          wires[q] += `│${"─".repeat(label.length + 1)}──`;
        } else {
          wires[q] += "─".repeat(label.length + 2) + "──";
        }
      }
    } else if (op.type === "swap" && op.q1 !== undefined && op.q2 !== undefined) {
      for (let q = 0; q < nQubits; q++) {
        if (q === op.q1 || q === op.q2) wires[q] += "✕────";
        else wires[q] += "─────";
      }
    } else if (op.type === "ccx" && op.control !== undefined && op.control2 !== undefined && op.target !== undefined) {
      for (let q = 0; q < nQubits; q++) {
        if (q === op.control || q === op.control2) wires[q] += "●────";
        else if (q === op.target) wires[q] += "[X]──";
        else wires[q] += "─────";
      }
    }
  }

  return wires.join("\n");
}

// ─── Measurement sampling ───────────────────────────────────────

function sampleMeasurements(
  state: Complex[],
  nQubits: number,
  shots: number
): Record<string, number> {
  const dim = state.length;
  const probs = new Float64Array(dim);
  for (let i = 0; i < dim; i++) {
    probs[i] = cnorm2(state[i]);
  }

  // Build cumulative distribution
  const cumulative = new Float64Array(dim);
  cumulative[0] = probs[0];
  for (let i = 1; i < dim; i++) {
    cumulative[i] = cumulative[i - 1] + probs[i];
  }
  // Normalize for numerical stability
  const total = cumulative[dim - 1];
  if (total > 0) {
    for (let i = 0; i < dim; i++) cumulative[i] /= total;
  }

  const counts: Record<string, number> = {};
  for (let s = 0; s < shots; s++) {
    const r = Math.random();
    let idx = 0;
    // Binary search
    let lo = 0, hi = dim - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cumulative[mid] < r) lo = mid + 1;
      else hi = mid;
    }
    idx = lo;

    const bitstring = idx.toString(2).padStart(nQubits, "0");
    counts[bitstring] = (counts[bitstring] || 0) + 1;
  }

  return counts;
}

// ─── Public API ─────────────────────────────────────────────────

export interface SimulationResult {
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  most_likely: string;
  shots: number;
  backend: string;
  execution_time: number;
  job_id: string;
  circuit_diagram: string;
  metadata: {
    num_qubits: number;
    circuit_depth: number;
    gate_count: number;
    simulator: string;
    seed: null;
  };
}

export function simulateCircuit(code: string, shots: number = 1024): SimulationResult {
  const startTime = performance.now();
  const { nQubits, ops, circuitName } = parsePythonCode(code);

  if (nQubits > 20) {
    throw new Error(`Circuit has ${nQubits} qubits. Browser simulator supports up to 20 qubits.`);
  }
  if (nQubits < 1) {
    throw new Error("Circuit must have at least 1 qubit.");
  }

  // Initialize |00...0⟩ state
  const dim = 1 << nQubits;
  const state: Complex[] = new Array(dim);
  for (let i = 0; i < dim; i++) state[i] = [0, 0];
  state[0] = [1, 0];

  let gateCount = 0;
  let depth = 0;
  const qubitLastLayer = new Array(nQubits).fill(0);

  for (const op of ops) {
    if (op.type === "barrier" || op.type === "measure") continue;

    if (op.type === "single" && op.gate && op.qubit !== undefined) {
      let matrix: Complex[][];
      if (op.gate === "rx") matrix = rxMatrix(op.param || 0);
      else if (op.gate === "ry") matrix = ryMatrix(op.param || 0);
      else if (op.gate === "rz") matrix = rzMatrix(op.param || 0);
      else matrix = GATES[op.gate];

      if (!matrix) continue;
      applySingleQubitGate(state, nQubits, op.qubit, matrix);

      qubitLastLayer[op.qubit]++;
      depth = Math.max(depth, qubitLastLayer[op.qubit]);
      gateCount++;
    } else if (op.type === "controlled" && op.gate && op.control !== undefined && op.target !== undefined) {
      let matrix: Complex[][];
      if (op.gate === "rx") matrix = rxMatrix(op.param || 0);
      else if (op.gate === "ry") matrix = ryMatrix(op.param || 0);
      else if (op.gate === "rz") matrix = rzMatrix(op.param || 0);
      else matrix = GATES[op.gate];

      if (!matrix) continue;
      applyControlledGate(state, nQubits, op.control, op.target, matrix);

      const layer = Math.max(qubitLastLayer[op.control], qubitLastLayer[op.target]) + 1;
      qubitLastLayer[op.control] = layer;
      qubitLastLayer[op.target] = layer;
      depth = Math.max(depth, layer);
      gateCount++;
    } else if (op.type === "swap" && op.q1 !== undefined && op.q2 !== undefined) {
      applySwap(state, nQubits, op.q1, op.q2);

      const layer = Math.max(qubitLastLayer[op.q1], qubitLastLayer[op.q2]) + 1;
      qubitLastLayer[op.q1] = layer;
      qubitLastLayer[op.q2] = layer;
      depth = Math.max(depth, layer);
      gateCount++;
    } else if (op.type === "ccx" && op.control !== undefined && op.control2 !== undefined && op.target !== undefined) {
      applyCCX(state, nQubits, op.control, op.control2, op.target);

      const layer = Math.max(
        qubitLastLayer[op.control],
        qubitLastLayer[op.control2],
        qubitLastLayer[op.target]
      ) + 1;
      qubitLastLayer[op.control] = layer;
      qubitLastLayer[op.control2] = layer;
      qubitLastLayer[op.target] = layer;
      depth = Math.max(depth, layer);
      gateCount++;
    }
  }

  // Sample measurements
  const counts = sampleMeasurements(state, nQubits, shots);

  // Compute probabilities
  const probabilities: Record<string, number> = {};
  for (const [key, count] of Object.entries(counts)) {
    probabilities[key] = Math.round((count / shots) * 10000) / 10000;
  }

  // Sort by count descending
  const sortedEntries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const most_likely = sortedEntries.length > 0 ? sortedEntries[0][0] : "0".repeat(nQubits);

  const sortedCounts: Record<string, number> = {};
  const sortedProbs: Record<string, number> = {};
  for (const [key] of sortedEntries) {
    sortedCounts[key] = counts[key];
    sortedProbs[key] = probabilities[key];
  }

  const executionTime = (performance.now() - startTime) / 1000;
  const circuitDiagram = generateCircuitDiagram(nQubits, ops);
  const jobId = `browser-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  return {
    counts: sortedCounts,
    probabilities: sortedProbs,
    most_likely,
    shots,
    backend: "browser_simulator",
    execution_time: Math.round(executionTime * 10000) / 10000,
    job_id: jobId,
    circuit_diagram: circuitDiagram,
    metadata: {
      num_qubits: nQubits,
      circuit_depth: depth,
      gate_count: gateCount,
      simulator: "browser-statevector",
      seed: null,
    },
  };
}
