// Copyright 2026 TheQuantAI
// STUDIO-018 T3: circuit-vs-script static detection (AC5).

import { describe, expect, it } from "vitest";
import { looksLikeCircuit } from "./python-runtime";

describe("looksLikeCircuit", () => {
  it("detects template-style circuit code", () => {
    expect(
      looksLikeCircuit(
        'import quantsdk as qs\ncircuit = qs.Circuit(2, name="bell")\ncircuit.h(0)\n',
      ),
    ).toBe(true);
    expect(looksLikeCircuit("from quantsdk import Circuit\nc = Circuit(3)")).toBe(true);
  });

  it("treats plain scripts as non-circuits", () => {
    expect(looksLikeCircuit('import csv\nprint(open("data.csv").read())')).toBe(false);
    expect(looksLikeCircuit("for i in range(10):\n    print(i * i)")).toBe(false);
  });

  it("known false positive: Circuit( in a comment (backstopped by cloud error)", () => {
    expect(looksLikeCircuit("# build a qs.Circuit( later\nprint(1)")).toBe(true);
  });
});
