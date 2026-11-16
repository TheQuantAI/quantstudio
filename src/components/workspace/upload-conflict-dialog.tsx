// Copyright 2026 TheQuantAI
// STUDIO-021: upload name-clash dialog — Replace (overwrite in place) / Keep both
// (numbered copy) / Skip, with "apply to all" for multi-file uploads.
// Render with a `key` per conflict so the checkbox state resets.

"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ConflictChoice, UploadConflict } from "@/lib/api";

export type ConflictAnswer = { choice: ConflictChoice; applyToAll: boolean } | null;

export function UploadConflictDialog({
  conflict,
  onResolve,
}: {
  /** null = closed. */
  conflict: (UploadConflict & { dirtyOpen: boolean }) | null;
  /** null = cancelled (skip this and the remaining conflicts). */
  onResolve: (answer: ConflictAnswer) => void;
}) {
  const [applyToAll, setApplyToAll] = useState(false);
  const replaceRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!conflict) return;
    replaceRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onResolve(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [conflict, onResolve]);

  if (!conflict) return null;

  const pick = (choice: ConflictChoice) => onResolve({ choice, applyToAll });

  return (
    // No backdrop-click dismiss: cancelling skips every remaining conflict, so it
    // takes an explicit Cancel / Esc.
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-conflict-title"
    >
      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl">
        <h3 id="upload-conflict-title" className="mb-2 text-sm font-semibold">
          File already exists
        </h3>
        <p className="mb-3 text-sm text-muted-foreground">
          <span className="font-mono text-foreground">{conflict.name}</span> already exists in
          this folder.
        </p>

        {conflict.dirtyOpen && (
          <p className="mb-3 flex items-start gap-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs text-amber-500">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This file is open with unsaved changes — Replace will discard them.
          </p>
        )}

        <div className="mb-3 grid gap-1 text-xs text-muted-foreground">
          <span>
            <strong className="text-foreground">Replace</strong> — overwrite the existing file
          </span>
          <span>
            <strong className="text-foreground">Keep both</strong> — save a numbered copy
          </span>
        </div>

        {conflict.remaining > 0 && (
          <label className="mb-4 flex cursor-pointer items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={applyToAll}
              onChange={(e) => setApplyToAll(e.target.checked)}
            />
            Apply to all remaining conflicts
          </label>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onResolve(null)}>
            Cancel
          </Button>
          <Button variant="outline" size="sm" onClick={() => pick("skip")}>
            Skip
          </Button>
          <Button variant="outline" size="sm" onClick={() => pick("keep_both")}>
            Keep both
          </Button>
          <Button ref={replaceRef} variant="quantum" size="sm" onClick={() => pick("replace")}>
            Replace
          </Button>
        </div>
      </div>
    </div>
  );
}
