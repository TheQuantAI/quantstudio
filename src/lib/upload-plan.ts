// Copyright 2026 TheQuantAI
// STUDIO-021: pure helpers for conflict-aware upload (replace / keep both / skip).
// No React, store, or network imports — unit-tested in upload-plan.test.ts.

export type ConflictChoice = "replace" | "keep_both" | "skip";

export interface SiblingFile {
  id: string;
  name: string;
  folder_id: string | null;
}

/** Live files of one folder, keyed by exact (case-sensitive) name → file id.
 *  Mirrors the DB's live-only unique index on (user, folder, name). */
export function siblingsByName(
  files: readonly SiblingFile[],
  folderId: string | null,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const f of files) {
    if (f.folder_id === folderId) m.set(f.name, f.id);
  }
  return m;
}

/** First "<base> (N)<ext>" (N = 1, 2, …) not in `taken`; `name` itself if free.
 *  The extension is the text after the last dot, unless that dot is the first
 *  character (dotfiles like ".env" have no extension). */
export function nextFreeName(name: string, taken: ReadonlySet<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  let i = 1;
  while (taken.has(`${base} (${i})${ext}`)) i += 1;
  return `${base} (${i})${ext}`;
}

/** True only for the duplicate-name 409 — the storage-quota 409 shares the
 *  status code and differs only in its detail text (routers/files.py). */
export function isDuplicateNameError(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const e = err as { status?: unknown; message?: unknown; detail?: unknown };
  if (e.status !== 409) return false;
  const text = `${typeof e.message === "string" ? e.message : ""} ${
    typeof e.detail === "string" ? e.detail : ""
  }`;
  return /already exists/i.test(text);
}
