// Copyright 2026 TheQuantAI
// STUDIO-019 T1: QASM → draw-text conversion (AC1, AC6).

import { describe, expect, it } from "vitest";
import { diagramFromQasm } from "./qasm-diagram";

const BELL = `OPENQASM 2.0;
include "qelib1.inc";

qreg q[2];
creg c[2];

h q[0];
cx q[0],q[1];
measure q[0] -> c[0];
measure q[1] -> c[1];
`;

describe("diagramFromQasm", () => {
  it("renders the bell circuit exactly like the stub's draw()", () => {
    expect(diagramFromQasm(BELL)).toBe("q0: ──[H]──●────M──\n" + "q1: ───────[X]──M──");
  });

  it("handles parametrized singles (θ dropped, like draw())", () => {
    const qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\n\nqreg q[1];\n\nrx(1.5707) q[0];\np(0.25) q[0];\n';
    expect(diagramFromQasm(qasm)).toBe("q0: ──[RX]──[P]──");
  });

  it("handles controlled-param gates and wire-through (│) between ctrl and target", () => {
    const qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\n\nqreg q[3];\n\ncrz(0.5) q[0],q[2];\n';
    // label "RZ" (2 chars) → ctrl/│ pad = 1+2 dashes + "──" (mirrors _draw_circuit)
    expect(diagramFromQasm(qasm)).toBe(
      "q0: ──●─────\n" + "q1: ──│─────\n" + "q2: ──[RZ]──",
    );
  });

  it("handles swap, ccx and barrier (barrier skipped)", () => {
    const qasm =
      'OPENQASM 2.0;\ninclude "qelib1.inc";\n\nqreg q[3];\n\nswap q[0],q[1];\nbarrier q[0],q[1],q[2];\nccx q[0],q[1],q[2];\n';
    expect(diagramFromQasm(qasm)).toBe(
      "q0: ──✕────●────\n" + "q1: ──✕────●────\n" + "q2: ───────[X]──",
    );
  });

  it("collapses the expanded measure block into one M column", () => {
    const out = diagramFromQasm(BELL)!;
    expect(out.split("\n")[0].match(/M/g)).toHaveLength(1);
  });

  it("tolerates no-space measure arrows", () => {
    const qasm = 'OPENQASM 2.0;\ninclude "qelib1.inc";\n\nqreg q[1];\ncreg c[1];\n\nh q[0];\nmeasure q[0]->c[0];\n';
    expect(diagramFromQasm(qasm)).toBe("q0: ──[H]──M──");
  });

  it("returns null outside the dialect, on garbage, and on bad refs", () => {
    expect(diagramFromQasm('OPENQASM 2.0;\nqreg q[2];\nu3(1,2,3) q[0];')).toBeNull(); // unknown gate
    expect(diagramFromQasm("not qasm at all")).toBeNull();
    expect(diagramFromQasm("")).toBeNull();
    expect(diagramFromQasm(null)).toBeNull();
    expect(diagramFromQasm(undefined)).toBeNull();
    expect(diagramFromQasm('OPENQASM 2.0;\nqreg q[1];\nh q[5];')).toBeNull(); // out of range
    expect(diagramFromQasm('OPENQASM 2.0;\nh q[0];')).toBeNull(); // no qreg
  });
});
