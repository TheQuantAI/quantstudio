// Copyright 2026 TheQuantAI
// STUDIO-018 T2: binary-content rejection for uploads (AC7).

import { describe, expect, it } from "vitest";
import { decodeTextFile, isProbablyBinary } from "./text-validation";

const buf = (bytes: number[]): ArrayBuffer => new Uint8Array(bytes).buffer;
const text = (s: string): ArrayBuffer => new TextEncoder().encode(s).buffer as ArrayBuffer;

describe("isProbablyBinary", () => {
  it("rejects PNG magic bytes", () => {
    expect(isProbablyBinary(buf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  });

  it("rejects NUL bytes even in otherwise-valid text", () => {
    expect(isProbablyBinary(buf([0x61, 0x00, 0x62]))).toBe(true);
  });

  it("rejects invalid UTF-8 sequences", () => {
    expect(isProbablyBinary(buf([0xff, 0xfe, 0x61]))).toBe(true);
  });

  it("accepts ASCII, unicode and emoji", () => {
    expect(isProbablyBinary(text("qubits,shots\n2,1024\n"))).toBe(false);
    expect(isProbablyBinary(text("état |ψ⟩ → 🎉"))).toBe(false);
  });
});

describe("decodeTextFile", () => {
  it("decodes text and throws for binary", () => {
    expect(decodeTextFile(text("hello"))).toBe("hello");
    expect(() => decodeTextFile(buf([0x00]))).toThrow(/not a text file/i);
  });
});
