// Copyright 2026 TheQuantAI
// STUDIO-021: PostHog property builders for workspace events. Pure — does NOT
// import analytics/posthog; call sites do `track(event, build…(…))`.
//
// PRIVACY: outputs must never carry file names, paths, or content — only
// types, sizes, counts, and flags. Enforced by workspace-events.test.ts.

export type UploadVia = "picker" | "drop";
export type SaveTrigger = "button" | "shortcut" | "pending_restore";
export type DeleteAction = "trash" | "purge" | "empty_trash" | "restore";

// Only known workspace types are reported; any other extension is user-chosen
// text (part of the file name) and collapses to "other".
const KNOWN_TYPES = new Set(["py", "qasm", "md", "json", "csv"]);

function extOf(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot <= 0) return "other";
  const ext = name.slice(dot + 1).toLowerCase();
  return KNOWN_TYPES.has(ext) ? ext : "other";
}

function utf8Bytes(s: string): number {
  return new TextEncoder().encode(s).length;
}

export function buildUploadEvent(i: {
  files: readonly { name: string; size: number }[];
  replaced: number;
  keptBoth: number;
  skipped: number;
  failed: number;
  via: UploadVia;
}) {
  const file_types: Record<string, number> = {};
  let total_bytes = 0;
  for (const f of i.files) {
    const ext = extOf(f.name);
    file_types[ext] = (file_types[ext] ?? 0) + 1;
    total_bytes += f.size;
  }
  return {
    count: i.files.length,
    file_types,
    total_bytes,
    replaced: i.replaced,
    kept_both: i.keptBoth,
    skipped: i.skipped,
    failed: i.failed,
    via: i.via,
  };
}

export function buildSaveEvent(i: {
  isNew: boolean;
  fileType: string;
  trigger: SaveTrigger;
  content: string;
}) {
  return {
    is_new: i.isNew,
    file_type: i.fileType,
    trigger: i.trigger,
    bytes: utf8Bytes(i.content),
  };
}

export function buildScriptRunEvent(i: {
  success: boolean;
  durationMs: number;
  fallback: boolean;
  fileType: string;
}) {
  return {
    outcome: i.success ? ("success" as const) : ("error" as const),
    duration_ms: Math.max(0, Math.round(i.durationMs)),
    fallback: i.fallback,
    file_type: i.fileType,
  };
}

export function buildCreateEvent(i: { fileType: string; folderId: string | null }) {
  return { file_type: i.fileType, in_folder: i.folderId !== null };
}

/** `kind` is omitted for empty_trash (a mix of files and folders); `count` is
 *  sent only for empty_trash. */
export function buildDeleteEvent(i: {
  action: DeleteAction;
  kind?: "file" | "folder";
  count?: number;
}): { action: DeleteAction; kind?: "file" | "folder"; count?: number } {
  if (i.action === "empty_trash") return { action: i.action, count: i.count ?? 0 };
  return { action: i.action, kind: i.kind };
}
