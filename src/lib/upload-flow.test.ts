// Copyright 2026 TheQuantAI
// STUDIO-021: conflict-aware uploadFiles facade (AC1, AC2, AC4, AC6 + cancel,
// intra-batch duplicates). Network layer mocked; text validation is real.

import { beforeEach, describe, expect, it, vi } from "vitest";

const cloud = vi.hoisted(() => ({
  cloudCreateFile: vi.fn(),
  cloudUpdateFile: vi.fn(),
  cloudGetWorkspaceTree: vi.fn(),
}));

vi.mock("./cloud-api", () => ({
  ...cloud,
  isCloudAuthenticated: () => true,
  getAuthToken: () => "test-token",
}));
vi.mock("./analytics", () => ({ track: vi.fn(() => false) }));

import { uploadFiles, type ConflictResolver } from "./api";
import type { CloudFile } from "./cloud-api";

const file = (name: string, body = `print("${name}")`) => new File([body], name);

const cf = (id: string, name: string, folder_id: string | null = null): CloudFile =>
  ({ id, name, folder_id, file_type: "py" }) as unknown as CloudFile;

let nextId = 0;
beforeEach(() => {
  nextId = 0;
  vi.clearAllMocks();
  cloud.cloudCreateFile.mockImplementation(async (b: { name: string; folder_id: string | null }) =>
    cf(`new-${++nextId}`, b.name, b.folder_id),
  );
  cloud.cloudUpdateFile.mockImplementation(async (id: string) => cf(id, "x.py"));
});

const always =
  (choice: "replace" | "keep_both" | "skip", applyToAll = false): ConflictResolver =>
  vi.fn(async () => ({ choice, applyToAll }));

describe("uploadFiles — conflicts", () => {
  const live = [cf("old-x", "x.py"), cf("old-y", "y.py"), cf("old-z", "z.py")];

  it("replace PATCHes the existing id, no create (AC1)", async () => {
    const r = await uploadFiles([file("x.py", "new body")], null, {
      liveFiles: live,
      resolveConflict: always("replace"),
    });
    expect(cloud.cloudCreateFile).not.toHaveBeenCalled();
    expect(cloud.cloudUpdateFile).toHaveBeenCalledWith("old-x", { content: "new body" });
    expect(r.replaced.map((f) => f.id)).toEqual(["old-x"]);
    expect(r.replacedContent).toEqual({ "old-x": "new body" });
  });

  it("keep_both creates a numbered copy; skip does nothing (AC2)", async () => {
    const kb = await uploadFiles([file("x.py")], null, { liveFiles: live, resolveConflict: always("keep_both") });
    expect(cloud.cloudCreateFile).toHaveBeenCalledWith(expect.objectContaining({ name: "x (1).py" }));
    expect(kb.keptBoth).toHaveLength(1);

    vi.clearAllMocks();
    const sk = await uploadFiles([file("x.py")], null, { liveFiles: live, resolveConflict: always("skip") });
    expect(cloud.cloudCreateFile).not.toHaveBeenCalled();
    expect(cloud.cloudUpdateFile).not.toHaveBeenCalled();
    expect(sk.skipped).toEqual(["x.py"]);
  });

  it("no conflict when the same name is in another folder (AC3 scoping)", async () => {
    const resolver = always("replace");
    await uploadFiles([file("x.py")], "f1", { liveFiles: live, resolveConflict: resolver });
    expect(resolver).not.toHaveBeenCalled();
    expect(cloud.cloudCreateFile).toHaveBeenCalledTimes(1);
  });

  it("apply-to-all asks once for three conflicts (AC4)", async () => {
    const resolver = always("replace", true);
    const r = await uploadFiles([file("x.py"), file("y.py"), file("z.py")], null, {
      liveFiles: live,
      resolveConflict: resolver,
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith({ name: "x.py", existingId: "old-x", remaining: 2 });
    expect(cloud.cloudUpdateFile).toHaveBeenCalledTimes(3);
    expect(r.replaced).toHaveLength(3);
  });

  it("cancel skips remaining conflicts but still uploads non-conflicting files", async () => {
    const resolver: ConflictResolver = vi.fn(async () => null);
    const r = await uploadFiles([file("x.py"), file("new.py"), file("y.py")], null, {
      liveFiles: live,
      resolveConflict: resolver,
    });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(r.skipped).toEqual(["x.py", "y.py"]);
    expect(r.created.map((f) => f.name)).toEqual(["new.py"]);
  });

  it("replace of a file trashed meanwhile reports a clear error", async () => {
    cloud.cloudUpdateFile.mockRejectedValueOnce(Object.assign(new Error("Not found"), { status: 404 }));
    const r = await uploadFiles([file("x.py")], null, { liveFiles: live, resolveConflict: always("replace") });
    expect(r.errors[0].reason).toMatch(/moved to Trash/);
  });
});

describe("uploadFiles — intra-batch and races", () => {
  it("a second same-named file in the batch conflicts with the first", async () => {
    const resolver = always("replace");
    const r = await uploadFiles([file("a.py", "one"), file("a.py", "two")], null, {
      liveFiles: [],
      resolveConflict: resolver,
    });
    expect(resolver).toHaveBeenCalledWith({ name: "a.py", existingId: "new-1", remaining: 0 });
    expect(cloud.cloudUpdateFile).toHaveBeenCalledWith("new-1", { content: "two" });
    expect(r.created).toHaveLength(1);
    expect(r.replaced).toHaveLength(1);
  });

  it("duplicate-name 409 on create re-fetches the tree and asks (AC6)", async () => {
    cloud.cloudCreateFile.mockRejectedValueOnce(
      Object.assign(new Error("A file with that name already exists here."), { status: 409 }),
    );
    cloud.cloudGetWorkspaceTree.mockResolvedValueOnce({ folders: [], files: [cf("srv-x", "x.py")] });
    const resolver = always("replace");
    const r = await uploadFiles([file("x.py")], null, { liveFiles: [], resolveConflict: resolver });
    expect(cloud.cloudGetWorkspaceTree).toHaveBeenCalledTimes(1);
    expect(resolver).toHaveBeenCalledWith({ name: "x.py", existingId: "srv-x", remaining: 0 });
    expect(r.replaced.map((f) => f.id)).toEqual(["srv-x"]);
  });

  it("quota 409 is an error, never a conflict", async () => {
    cloud.cloudCreateFile.mockRejectedValueOnce(
      Object.assign(new Error("File limit reached (50 files). Delete files or upgrade your plan."), {
        status: 409,
      }),
    );
    const resolver = always("replace");
    const r = await uploadFiles([file("x.py")], null, { liveFiles: [], resolveConflict: resolver });
    expect(resolver).not.toHaveBeenCalled();
    expect(cloud.cloudGetWorkspaceTree).not.toHaveBeenCalled();
    expect(r.errors[0].reason).toMatch(/File limit reached/);
  });

  it("validation still runs before conflict detection", async () => {
    const resolver = always("replace");
    const r = await uploadFiles([file("x.exe")], null, {
      liveFiles: [cf("old", "x.exe")],
      resolveConflict: resolver,
    });
    expect(resolver).not.toHaveBeenCalled();
    expect(r.errors[0].reason).toMatch(/Unsupported type/);
  });
});
