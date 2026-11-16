// Copyright 2026 TheQuantAI
// STUDIO-021: workspace event builders — exact key sets + no-PII guard (AC7).

import { describe, expect, it } from "vitest";
import {
  buildCreateEvent,
  buildDeleteEvent,
  buildSaveEvent,
  buildScriptRunEvent,
  buildUploadEvent,
} from "./workspace-events";

const SECRET_NAME = "secret-name.py";
const SECRET_CONTENT = "TOP_SECRET = 'do-not-send'";

const keys = (o: object) => Object.keys(o).sort();

describe("buildUploadEvent", () => {
  const ev = buildUploadEvent({
    files: [
      { name: SECRET_NAME, size: 100 },
      { name: "data.CSV", size: 50 },
      { name: "b.py", size: 10 },
      { name: "README", size: 5 },
    ],
    replaced: 1,
    keptBoth: 1,
    skipped: 1,
    failed: 0,
    via: "drop",
  });

  it("has exactly the documented keys", () => {
    expect(keys(ev)).toEqual(
      ["count", "failed", "file_types", "kept_both", "replaced", "skipped", "total_bytes", "via"],
    );
  });

  it("aggregates types and bytes", () => {
    expect(ev.count).toBe(4);
    expect(ev.file_types).toEqual({ py: 2, csv: 1, other: 1 });
    expect(ev.total_bytes).toBe(165);
  });
});

describe("buildSaveEvent", () => {
  it("has exactly the documented keys and counts UTF-8 bytes", () => {
    const ev = buildSaveEvent({ isNew: true, fileType: "py", trigger: "shortcut", content: "é✓" });
    expect(keys(ev)).toEqual(["bytes", "file_type", "is_new", "trigger"]);
    expect(ev.bytes).toBe(5); // é = 2 bytes, ✓ = 3 bytes
  });
});

describe("buildScriptRunEvent", () => {
  it("maps outcome and rounds duration", () => {
    const ev = buildScriptRunEvent({ success: false, durationMs: 12.6, fallback: true, fileType: "py" });
    expect(keys(ev)).toEqual(["duration_ms", "fallback", "file_type", "outcome"]);
    expect(ev).toMatchObject({ outcome: "error", duration_ms: 13, fallback: true });
  });
});

describe("buildCreateEvent", () => {
  it("reports folder placement as a flag only", () => {
    expect(buildCreateEvent({ fileType: "md", folderId: "f-123" })).toEqual({
      file_type: "md",
      in_folder: true,
    });
    expect(buildCreateEvent({ fileType: "md", folderId: null }).in_folder).toBe(false);
  });
});

describe("buildDeleteEvent", () => {
  it("sends kind for item actions and count only for empty_trash", () => {
    expect(buildDeleteEvent({ action: "trash", kind: "folder" })).toEqual({
      action: "trash",
      kind: "folder",
    });
    expect(buildDeleteEvent({ action: "empty_trash", kind: "file", count: 7 })).toEqual({
      action: "empty_trash",
      count: 7,
    });
  });
});

describe("no PII in any event", () => {
  it("never includes a file name or content", () => {
    const all = JSON.stringify([
      buildUploadEvent({
        files: [
          { name: SECRET_NAME, size: 1 },
          { name: "q3-plan.secretclient", size: 1 }, // arbitrary extension = name text
        ],
        replaced: 0,
        keptBoth: 0,
        skipped: 0,
        failed: 0,
        via: "picker",
      }),
      buildSaveEvent({ isNew: false, fileType: "py", trigger: "button", content: SECRET_CONTENT }),
      buildScriptRunEvent({ success: true, durationMs: 1, fallback: false, fileType: "py" }),
      buildCreateEvent({ fileType: "py", folderId: "secret-folder-id" }),
      buildDeleteEvent({ action: "restore", kind: "file" }),
    ]);
    expect(all).not.toContain("secret");
    expect(all).not.toContain("TOP_SECRET");
  });
});
