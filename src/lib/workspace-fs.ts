// Copyright 2026 TheQuantAI
// STUDIO-018: mirror the user's workspace into Pyodide's virtual FS so local
// Python runs can open("data.csv") their own files. Read-only: nothing written
// inside Pyodide is persisted back to the cloud workspace.
//
// The mount lives under /home/pyodide/workspace (NOT /home/pyodide) so a user
// file named quantsdk.py can never shadow the SDK stub on sys.path. After a
// successful sync the Pyodide cwd is the mount root, so relative paths resolve
// against the workspace for every later execution (scripts, QASM compile, REPL).

import type { CloudWorkspaceTree } from "./cloud-api";
import type { OpenTab } from "@/store";

export const WORKSPACE_MOUNT = "/home/pyodide/workspace";
/** Sync at most this many files (rate-limit + memory guard). */
export const MAX_SYNC_FILES = 200;
const FETCH_CONCURRENCY = 5;

export interface SyncReport {
  synced: number;
  skipped: number;
  warnings: string[];
}

// Content cache keyed by file id; `updatedAt` mismatch = stale = refetch.
// Steady-state syncs therefore cost ~0 API requests (60/min rate limit).
const contentCache = new Map<string, { updatedAt: string; content: string }>();

/** Map every live file id → its workspace-relative path ("folder/sub/name"). */
export function buildPathMap(tree: CloudWorkspaceTree): Map<string, string> {
  const byId = new Map(tree.folders.map((f) => [f.id, f]));
  const memo = new Map<string, string>();
  const pathOf = (id: string | null, depth = 0): string => {
    if (id === null || depth > 20) return ""; // depth: cycle guard (server prevents cycles)
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    const folder = byId.get(id);
    if (!folder) return ""; // orphan reference — treat as root
    const parent = pathOf(folder.parent_id, depth + 1);
    const p = parent ? `${parent}/${folder.name}` : folder.name;
    memo.set(id, p);
    return p;
  };
  const map = new Map<string, string>();
  for (const file of tree.files) {
    const dir = pathOf(file.folder_id);
    map.set(file.id, dir ? `${dir}/${file.name}` : file.name);
  }
  return map;
}

/** Pick which files to sync when over the cap: open tabs → active folder → most recent. */
export function selectFilesToSync<T extends { id: string; folder_id: string | null; updated_at: string }>(
  files: T[],
  openFileIds: Set<string>,
  activeFolderId: string | null,
): T[] {
  if (files.length <= MAX_SYNC_FILES) return files;
  const score = (f: T): number =>
    openFileIds.has(f.id) ? 2 : f.folder_id === activeFolderId ? 1 : 0;
  return [...files]
    .sort((a, b) => score(b) - score(a) || b.updated_at.localeCompare(a.updated_at))
    .slice(0, MAX_SYNC_FILES);
}

/**
 * Sync the workspace into Pyodide's FS. Dirty open tabs override server
 * content (the editor is the source of truth). Individual fetch/write failures
 * become warnings; the run proceeds with whatever synced.
 */
export async function syncWorkspaceFS(input: {
  tree: CloudWorkspaceTree;
  openTabs: OpenTab[];
  activeFolderId?: string | null;
}): Promise<SyncReport> {
  const { tree, openTabs } = input;
  const warnings: string[] = [];
  const pathMap = buildPathMap(tree);

  const openFileIds = new Set(
    openTabs.filter((t) => t.fileId !== null).map((t) => t.fileId as string),
  );
  const files = selectFilesToSync(tree.files, openFileIds, input.activeFolderId ?? null);
  let skipped = tree.files.length - files.length;
  if (skipped > 0) {
    warnings.push(
      `Workspace has ${tree.files.length} files — synced the ${MAX_SYNC_FILES} most relevant.`,
    );
  }

  // Editor content wins for dirty tabs.
  const dirtyByFile = new Map<string, string>();
  for (const t of openTabs) {
    if (t.fileId && t.isDirty) dirtyByFile.set(t.fileId, t.content);
  }

  // Fetch only missing/stale content, few at a time.
  const toFetch = files.filter(
    (f) => !dirtyByFile.has(f.id) && contentCache.get(f.id)?.updatedAt !== f.updated_at,
  );
  const { openFile } = await import("./api");
  let cursor = 0;
  const worker = async () => {
    while (cursor < toFetch.length) {
      const f = toFetch[cursor++];
      try {
        const full = await openFile(f.id);
        contentCache.set(f.id, { updatedAt: f.updated_at, content: full.content ?? "" });
      } catch {
        warnings.push(`Could not load "${f.name}" — it won't be readable in this run.`);
      }
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(FETCH_CONCURRENCY, toFetch.length) }, worker),
  );

  // Rebuild the mount. chdir out first: rmtree under our own cwd would leave a
  // dangling cwd and break subsequent relative opens.
  const { loadPyodide } = await import("./python-runtime");
  const pyodide = await loadPyodide();
  pyodide.runPython(
    `import os, shutil\n` +
      `os.chdir("/home/pyodide")\n` +
      `shutil.rmtree(${JSON.stringify(WORKSPACE_MOUNT)}, ignore_errors=True)\n` +
      `os.makedirs(${JSON.stringify(WORKSPACE_MOUNT)}, exist_ok=True)`,
  );

  let synced = 0;
  for (const f of files) {
    const rel = pathMap.get(f.id);
    const content = dirtyByFile.get(f.id) ?? contentCache.get(f.id)?.content;
    if (rel === undefined || content === undefined) {
      skipped++;
      continue;
    }
    const abs = `${WORKSPACE_MOUNT}/${rel}`;
    try {
      const dir = abs.slice(0, abs.lastIndexOf("/"));
      pyodide.FS.mkdirTree(dir);
      pyodide.FS.writeFile(abs, content);
      synced++;
    } catch {
      warnings.push(`Could not mount "${rel}".`);
      skipped++;
    }
  }

  // Relative paths now resolve against the workspace root.
  pyodide.runPython(`import os; os.chdir(${JSON.stringify(WORKSPACE_MOUNT)})`);
  return { synced, skipped, warnings };
}
