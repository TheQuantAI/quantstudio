// Copyright 2026 TheQuantAI
// STUDIO-018: minimal OpenQASM 2.0 language for Monaco (Monarch tokenizer).
// Data-only module — registered once in the studio page's onMount handler.

export const QASM_LANGUAGE_ID = "qasm";

/** Monarch tokenizer definition for OpenQASM 2.0. */
export const QASM_MONARCH = {
  defaultToken: "",
  ignoreCase: false,
  keywords: [
    "OPENQASM",
    "include",
    "qreg",
    "creg",
    "gate",
    "measure",
    "reset",
    "barrier",
    "if",
    "opaque",
    "pi",
  ],
  gates: [
    "U", "CX", "u1", "u2", "u3", "id", "x", "y", "z", "h", "s", "sdg",
    "t", "tdg", "rx", "ry", "rz", "cz", "cy", "ch", "ccx", "crz", "cu1",
    "cu3", "swap", "cswap",
  ],
  tokenizer: {
    root: [
      [/\/\/.*$/, "comment"],
      [/"[^"]*"/, "string"],
      [/\d+(\.\d+)?([eE][+-]?\d+)?/, "number"],
      [
        /[a-zA-Z_][a-zA-Z0-9_]*/,
        {
          cases: {
            "@keywords": "keyword",
            "@gates": "type.identifier",
            "@default": "identifier",
          },
        },
      ],
      [/->/, "operator"],
      [/[[\](){};,]/, "delimiter"],
    ],
  },
} as const;
