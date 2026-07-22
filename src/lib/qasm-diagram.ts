// Copyright 2026 TheQuantAI
// STUDIO-019: OpenQASM 2.0 → draw-text converter. Jobs store the QASM that was
// submitted (emitted exclusively by the quantsdk stub's to_openqasm), and
// CircuitDiagramSVG consumes the stub draw() text format — this module bridges
// the two so a stored job can render its circuit diagram without the original
// Python. The emission below mirrors the stub's _draw_circuit exactly; the
// parser accepts only the stub's closed dialect and returns null for anything
// else (caller hides the Circuit tab). Never throws.

type Op =
  | { kind: "single"; gate: string; qubit: number }
  | { kind: "controlled"; gate: string; ctrl: number; tgt: number }
  | { kind: "swap"; q1: number; q2: number }
  | { kind: "ccx"; c1: number; c2: number; tgt: number }
  | { kind: "measure" };

const SINGLE_FIXED = new Set(["h", "x", "y", "z", "s", "t", "sdg", "tdg", "sx"]);
const SINGLE_PARAM = new Set(["rx", "ry", "rz", "p"]);
// controlled QASM name -> base gate label
const CTRL_FIXED: Record<string, string> = { cx: "x", cz: "z", cy: "y", ch: "h" };
const CTRL_PARAM: Record<string, string> = { crx: "rx", cry: "ry", crz: "rz", cp: "p" };

const RE_QREG = /^qreg\s+q\[(\d+)\]\s*;$/;
const RE_GATE = /^([a-z]+)(?:\(([^)]*)\))?\s+(q\[\d+\](?:\s*,\s*q\[\d+\])*)\s*;$/;
const RE_MEASURE = /^measure\s+q\[(\d+)\]\s*->\s*c\[(\d+)\]\s*;$/;

function qubitArgs(argText: string): number[] {
  return [...argText.matchAll(/q\[(\d+)\]/g)].map((m) => parseInt(m[1], 10));
}

/** Parse stub-dialect QASM into ops; null if any line falls outside the dialect. */
function parseQasm(qasm: string): { n: number; ops: Op[] } | null {
  let n: number | null = null;
  const ops: Op[] = [];
  let measured = false; // to_openqasm expands one measure op into n lines — collapse back

  for (const raw of qasm.split("\n")) {
    const line = raw.trim();
    if (
      line === "" ||
      line.startsWith("OPENQASM") ||
      line.startsWith("include") ||
      /^creg\s/.test(line)
    ) {
      continue;
    }
    const qreg = line.match(RE_QREG);
    if (qreg) {
      n = parseInt(qreg[1], 10);
      continue;
    }
    const meas = line.match(RE_MEASURE);
    if (meas) {
      if (!measured) {
        ops.push({ kind: "measure" });
        measured = true;
      }
      continue;
    }
    if (/^barrier\s/.test(line)) continue; // draw() skips barriers
    const g = line.match(RE_GATE);
    if (!g) return null;
    const [, name, , argText] = g;
    const args = qubitArgs(argText);
    if (SINGLE_FIXED.has(name) || SINGLE_PARAM.has(name)) {
      if (args.length !== 1) return null;
      ops.push({ kind: "single", gate: name, qubit: args[0] });
    } else if (name in CTRL_FIXED || name in CTRL_PARAM) {
      if (args.length !== 2) return null;
      const gate = CTRL_FIXED[name] ?? CTRL_PARAM[name];
      ops.push({ kind: "controlled", gate, ctrl: args[0], tgt: args[1] });
    } else if (name === "swap") {
      if (args.length !== 2) return null;
      ops.push({ kind: "swap", q1: args[0], q2: args[1] });
    } else if (name === "ccx") {
      if (args.length !== 3) return null;
      ops.push({ kind: "ccx", c1: args[0], c2: args[1], tgt: args[2] });
    } else {
      return null; // outside the dialect (hand-written QASM) — no diagram
    }
  }
  if (n === null || n <= 0) return null;
  // Reject out-of-range qubit references rather than rendering a wrong wire.
  for (const op of ops) {
    const qs =
      op.kind === "single"
        ? [op.qubit]
        : op.kind === "controlled"
          ? [op.ctrl, op.tgt]
          : op.kind === "swap"
            ? [op.q1, op.q2]
            : op.kind === "ccx"
              ? [op.c1, op.c2, op.tgt]
              : [];
    if (qs.some((q) => q < 0 || q >= n)) return null;
  }
  return { n, ops };
}

/** Faithful TS port of the stub's _draw_circuit (quantsdk-stub.py). */
function drawOps(n: number, ops: Op[]): string {
  const wires = Array.from({ length: n }, (_, q) => `q${q}: ──`);
  for (const op of ops) {
    if (op.kind === "measure") {
      for (let q = 0; q < n; q++) wires[q] += "M──";
    } else if (op.kind === "single") {
      const label = op.gate.toUpperCase();
      for (let q = 0; q < n; q++) {
        wires[q] += q === op.qubit ? `[${label}]──` : "─".repeat(label.length + 2) + "──";
      }
    } else if (op.kind === "controlled") {
      const label = op.gate.toUpperCase();
      const lo = Math.min(op.ctrl, op.tgt);
      const hi = Math.max(op.ctrl, op.tgt);
      for (let q = 0; q < n; q++) {
        if (q === op.ctrl) wires[q] += `●${"─".repeat(label.length + 1)}──`;
        else if (q === op.tgt) wires[q] += `[${label}]──`;
        else if (lo < q && q < hi) wires[q] += `│${"─".repeat(label.length + 1)}──`;
        else wires[q] += "─".repeat(label.length + 2) + "──";
      }
    } else if (op.kind === "swap") {
      for (let q = 0; q < n; q++) {
        wires[q] += q === op.q1 || q === op.q2 ? "✕────" : "─────";
      }
    } else if (op.kind === "ccx") {
      for (let q = 0; q < n; q++) {
        if (q === op.c1 || q === op.c2) wires[q] += "●────";
        else if (q === op.tgt) wires[q] += "[X]──";
        else wires[q] += "─────";
      }
    }
  }
  return wires.join("\n");
}

/** QASM → circuit draw-text for CircuitDiagramSVG; null when not renderable. */
export function diagramFromQasm(qasm: string | null | undefined): string | null {
  if (!qasm || typeof qasm !== "string") return null;
  try {
    const parsed = parseQasm(qasm);
    return parsed ? drawOps(parsed.n, parsed.ops) : null;
  } catch {
    return null;
  }
}
