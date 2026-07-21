// Copyright 2026 TheQuantAI
// STUDIO-018 T1: CSV parse/serialize round-trip (AC3).

import { describe, expect, it } from "vitest";
import { CSV_GRID_MAX_ROWS, csvGridViable, parseCsv, serializeCsv } from "./csv";

describe("parseCsv", () => {
  it("parses plain rows", () => {
    expect(parseCsv("a,b,c\n1,2,3\n").rows).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted commas, newlines and escaped quotes", () => {
    const text = 'name,note\n"Doe, J","said ""hi""\nbye"\n';
    expect(parseCsv(text).rows).toEqual([
      ["name", "note"],
      ["Doe, J", 'said "hi"\nbye'],
    ]);
  });

  it("normalizes CRLF and tolerates a missing trailing newline", () => {
    expect(parseCsv("a,b\r\n1,2").rows).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("pads ragged rows and reports them", () => {
    const r = parseCsv("a,b,c\n1\n");
    expect(r.ragged).toBe(true);
    expect(r.rows[1]).toEqual(["1", "", ""]);
  });

  it("returns a single empty cell for an empty file", () => {
    expect(parseCsv("").rows).toEqual([[""]]);
  });
});

describe("serializeCsv round-trip", () => {
  const fixtures = [
    "a,b,c\n1,2,3\n",
    'name,note\n"Doe, J","said ""hi""\nbye"\n',
    'x\n"multi\nline"\n',
    "sole\n",
  ];
  it.each(fixtures)("round-trips %j byte-identically", (text) => {
    expect(serializeCsv(parseCsv(text).rows)).toBe(text);
  });

  it("re-parses to identical rows for arbitrary cells", () => {
    const rows = [
      ["plain", 'quo"te', "com,ma"],
      ["new\nline", "", "  spaced  "],
    ];
    expect(parseCsv(serializeCsv(rows)).rows).toEqual(rows);
  });

  it("quotes only when needed", () => {
    expect(serializeCsv([["a", "b,c", 'd"e']])).toBe('a,"b,c","d""e"\n');
  });
});

describe("csvGridViable", () => {
  it("accepts normal tables and rejects oversized ones", () => {
    expect(csvGridViable(parseCsv("a,b\n1,2\n"))).toBe(true);
    const big = { rows: Array.from({ length: CSV_GRID_MAX_ROWS + 1 }, () => ["x"]), ragged: false };
    expect(csvGridViable(big)).toBe(false);
  });
});
