// Copyright 2026 TheQuantAI
// API-018: Trash view — restore or permanently delete soft-deleted items.
// Items are auto-purged 30 days after deletion.

"use client";

import { useCallback, useEffect, useState } from "react";
import {
  File as FileIcon,
  Folder,
  Loader2,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  deleteFile,
  deleteFolder,
  emptyTrash,
  listTrash,
  restoreFile,
  restoreFolder,
  type TrashItem,
} from "@/lib/api";
import { track } from "@/lib/analytics";
import { buildDeleteEvent } from "@/lib/workspace-events";

export function TrashView({
  open,
  onClose,
  onChanged,
}: {
  open: boolean;
  onClose: () => void;
  /** Called after any restore/delete so the caller can refresh the tree + usage. */
  onChanged: () => void;
}) {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await listTrash());
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  if (!open) return null;

  const act = async (fn: () => Promise<unknown>, id: string) => {
    setBusyId(id);
    try {
      await fn();
      await refresh();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusyId(null);
    }
  };

  // STUDIO-021: telemetry fires only after the call succeeds (inside `fn`).
  const restore = (it: TrashItem) =>
    act(async () => {
      await (it.kind === "folder" ? restoreFolder(it.id) : restoreFile(it.id));
      track("file_deleted", buildDeleteEvent({ action: "restore", kind: it.kind }));
    }, it.id);
  const purge = (it: TrashItem) => {
    if (!window.confirm(`Permanently delete "${it.name}"? This can't be undone.`)) return;
    void act(async () => {
      await (it.kind === "folder" ? deleteFolder(it.id, true) : deleteFile(it.id, true));
      track("file_deleted", buildDeleteEvent({ action: "purge", kind: it.kind }));
    }, it.id);
  };
  const purgeAll = () => {
    if (!window.confirm("Permanently delete everything in the trash? This can't be undone.")) return;
    void act(async () => {
      const count = await emptyTrash();
      track("file_deleted", buildDeleteEvent({ action: "empty_trash", count }));
    }, "__all__");
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[70vh] w-full max-w-lg flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Trash</h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="px-4 pt-2 text-xs text-muted-foreground">
          Deleted items are kept for 30 days, then permanently removed.
        </p>

        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Trash is empty.</p>
          ) : (
            items.map((it) => {
              const Icon = it.kind === "folder" ? Folder : FileIcon;
              return (
                <div
                  key={`${it.kind}-${it.id}`}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent/50"
                >
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{it.name}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {new Date(it.deleted_at).toLocaleDateString()}
                  </span>
                  {busyId === it.id ? (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <button
                        title="Restore"
                        onClick={() => void restore(it)}
                        className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title="Delete forever"
                        onClick={() => purge(it)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end border-t border-border px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={purgeAll}
            disabled={items.length === 0 || busyId === "__all__"}
            className="text-destructive hover:text-destructive"
          >
            {busyId === "__all__" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Empty trash"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
