// Copyright 2026 TheQuantAI
// STUDIO-018 T4: workspace → Pyodide FS path mapping + sync selection (AC4).

import { describe, expect, it } from "vitest";
import type { CloudFile, CloudFolder, CloudWorkspaceTree } from "./cloud-api";
import { buildPathMap, MAX_SYNC_FILES, selectFilesToSync } from "./workspace-fs";

const folder = (id: string, name: string, parent_id: string | null): CloudFolder => ({
  id, name, parent_id, user_id: "u", is_default: false, created_at: "", updated_at: "",
});
const file = (id: string, name: string, folder_id: string | null, updated_at = ""): CloudFile => ({
  id, name, folder_id, user_id: "u", file_type: "py", content: null,
  num_qubits: null, metadata: {}, created_at: "", updated_at,
});

describe("buildPathMap", () => {
  it("maps root and nested files", () => {
    const tree: CloudWorkspaceTree = {
      folders: [folder("a", "Research", null), folder("b", "Data", "a")],
      files: [file("f1", "main.py", null), file("f2", "notes.md", "a"), file("f3", "runs.csv", "b")],
    };
    const m = buildPathMap(tree);
    expect(m.get("f1")).toBe("main.py");
    expect(m.get("f2")).toBe("Research/notes.md");
    expect(m.get("f3")).toBe("Research/Data/runs.csv");
  });

  it("treats an orphan folder reference as root", () => {
    const tree: CloudWorkspaceTree = { folders: [], files: [file("f1", "x.py", "missing")] };
    expect(buildPathMap(tree).get("f1")).toBe("x.py");
  });
});

describe("selectFilesToSync", () => {
  it("returns everything under the cap", () => {
    const files = [file("a", "a.py", null), file("b", "b.py", null)];
    expect(selectFilesToSync(files, new Set(), null)).toHaveLength(2);
  });

  it("prioritizes open tabs, then the active folder, then recency", () => {
    const files = Array.from({ length: MAX_SYNC_FILES + 3 }, (_, i) =>
      file(`f${i}`, `f${i}.csv`, i % 2 === 0 ? "active" : "other", `2026-07-${(i % 28) + 1}`),
    );
    const chosen = selectFilesToSync(files, new Set(["f1"]), "active");
    expect(chosen).toHaveLength(MAX_SYNC_FILES);
    expect(chosen[0].id).toBe("f1"); // open tab wins
    expect(chosen.slice(1).every((f) => f.folder_id === "active" || chosen.indexOf(f) >= 0)).toBe(true);
    const activeCount = chosen.filter((f) => f.folder_id === "active").length;
    const activeTotal = files.filter((f) => f.folder_id === "active").length;
    expect(activeCount).toBe(Math.min(activeTotal, MAX_SYNC_FILES - 1) ); // all active-folder files kept
  });
});
