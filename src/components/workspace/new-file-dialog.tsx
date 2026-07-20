// Copyright 2026 TheQuantAI
// API-017: create-file dialog — name + type picker. Only .py is runnable.

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { FileType } from "@/lib/api";

const TYPES: { value: FileType; label: string; hint: string }[] = [
  { value: "py", label: "Python (.py)", hint: "Runnable — quantum circuit" },
  { value: "qasm", label: "OpenQASM (.qasm)", hint: "Circuit source" },
  { value: "md", label: "Markdown (.md)", hint: "Notes" },
  { value: "json", label: "JSON (.json)", hint: "Data" },
  { value: "csv", label: "CSV (.csv)", hint: "Data" },
];

export function NewFileDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, fileType: FileType) => void;
}) {
  const [name, setName] = useState("");
  const [fileType, setFileType] = useState<FileType>("py");

  if (!open) return null;

  const trimmed = name.trim();
  // Ensure the name carries the chosen extension.
  const finalName =
    trimmed && !trimmed.toLowerCase().endsWith(`.${fileType}`)
      ? `${trimmed}.${fileType}`
      : trimmed;

  const submit = () => {
    if (!finalName) return;
    onCreate(finalName, fileType);
    setName("");
    setFileType("py");
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-sm font-semibold">New file</h3>

        <label className="mb-1 block text-xs text-muted-foreground">Name</label>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") onClose();
          }}
          placeholder="my_circuit"
          className="mb-3 w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />

        <label className="mb-1 block text-xs text-muted-foreground">Type</label>
        <div className="mb-4 grid gap-1">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setFileType(t.value)}
              className={`flex items-center justify-between rounded-md border px-3 py-1.5 text-left text-sm transition-colors ${
                fileType === t.value
                  ? "border-quantum bg-accent"
                  : "border-border hover:bg-accent/50"
              }`}
            >
              <span>{t.label}</span>
              <span className="text-[10px] text-muted-foreground">{t.hint}</span>
            </button>
          ))}
        </div>

        {finalName && (
          <p className="mb-3 text-xs text-muted-foreground">
            Creates <span className="font-mono text-foreground">{finalName}</span>
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="quantum" size="sm" onClick={submit} disabled={!finalName}>
            Create
          </Button>
        </div>
      </div>
    </div>
  );
}
