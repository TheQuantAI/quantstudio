// Copyright 2026 TheQuantAI
// STUDIO-018: "Getting Started" guide modal — renders the bundled guide read-only.
// Opened from a pinned (non-deletable, virtual) explorer entry.

"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, X } from "lucide-react";
import { GETTING_STARTED_MD, GETTING_STARTED_TITLE } from "@/lib/getting-started";

export function GettingStartedView({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <BookOpen className="h-4 w-4 text-quantum" />
            {GETTING_STARTED_TITLE}
          </h3>
          <button onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div
          className="flex-1 overflow-y-auto px-6 py-5 text-sm leading-6 text-foreground
            [&_h1]:mt-6 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-bold [&_h1:first-child]:mt-0
            [&_h2]:mt-5 [&_h2]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold
            [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:my-0.5
            [&_code]:rounded [&_code]:bg-accent [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]
            [&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-accent [&_pre]:p-3
            [&_pre_code]:bg-transparent [&_pre_code]:p-0
            [&_a]:text-quantum [&_a]:underline [&_strong]:font-semibold
            [&_hr]:my-5 [&_hr]:border-border"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{GETTING_STARTED_MD}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
