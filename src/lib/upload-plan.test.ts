// Copyright 2026 TheQuantAI
// STUDIO-021: conflict-planning helpers (AC1, AC2, AC3, AC6).

import { describe, expect, it } from "vitest";
import { isDuplicateNameError, nextFreeName, siblingsByName } from "./upload-plan";

describe("siblingsByName", () => {
  const files = [
    { id: "a", name: "x.py", folder_id: null },
    { id: "b", name: "x.py", folder_id: "f1" },
    { id: "c", name: "X.py", folder_id: null },
  ];

  it("scopes to one folder (root vs folder)", () => {
    expect(siblingsByName(files, null).get("x.py")).toBe("a");
    expect(siblingsByName(files, "f1").get("x.py")).toBe("b");
    expect(siblingsByName(files, "f2").size).toBe(0);
  });

  it("is case-sensitive like the DB index", () => {
    const root = siblingsByName(files, null);
    expect(root.get("X.py")).toBe("c");
    expect(root.has("x.PY")).toBe(false);
  });
});

describe("nextFreeName", () => {
  it("returns the name when free", () => {
    expect(nextFreeName("x.py", new Set())).toBe("x.py");
  });

  it("numbers from (1), then the next free", () => {
    expect(nextFreeName("x.py", new Set(["x.py"]))).toBe("x (1).py");
    expect(nextFreeName("x.py", new Set(["x.py", "x (1).py"]))).toBe("x (2).py");
  });

  it("handles no extension and dotfiles", () => {
    expect(nextFreeName("Makefile", new Set(["Makefile"]))).toBe("Makefile (1)");
    expect(nextFreeName(".env", new Set([".env"]))).toBe(".env (1)");
  });

  it("does not parse existing suffixes", () => {
    expect(nextFreeName("x (1).py", new Set(["x (1).py"]))).toBe("x (1) (1).py");
  });
});

describe("isDuplicateNameError", () => {
  const err = (status: number, message: string) => Object.assign(new Error(message), { status });

  it("matches the duplicate-name 409", () => {
    expect(isDuplicateNameError(err(409, "A file with that name already exists here."))).toBe(true);
  });

  it("does not match the quota 409", () => {
    expect(isDuplicateNameError(err(409, "File limit reached (50 files). Delete files or upgrade your plan."))).toBe(false);
    expect(isDuplicateNameError(err(409, "Storage limit reached (25 MB)."))).toBe(false);
  });

  it("does not match other statuses or non-errors", () => {
    expect(isDuplicateNameError(err(500, "already exists"))).toBe(false);
    expect(isDuplicateNameError("already exists")).toBe(false);
    expect(isDuplicateNameError(null)).toBe(false);
  });
});
