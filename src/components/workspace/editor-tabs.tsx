// Copyright 2026 TheQuantAI
// API-017: open-file tab strip above the editor. Dirty dot + close.

"use client";

import { FileCode2, File as FileIcon, X } from "lucide-react";
import { useCircuitStore } from "@/store";
import { cn } from "@/lib/utils";

export function EditorTabs() {
  const openTabs = useCircuitStore((s) => s.openTabs);
  const activeKey = useCircuitStore((s) => s.activeKey);
  const setActiveTab = useCircuitStore((s) => s.setActiveTab);
  const closeTab = useCircuitStore((s) => s.closeTab);

  if (openTabs.length === 0) return null;

  return (
    <div className="flex items-stretch overflow-x-auto border-b border-border bg-card">
      {openTabs.map((tab) => {
        const active = tab.key === activeKey;
        const Icon = tab.fileType === "py" ? FileCode2 : FileIcon;
        return (
          <div
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "group flex items-center gap-1.5 px-3 py-1.5 text-xs border-r border-border cursor-pointer whitespace-nowrap select-none",
              active
                ? "bg-background text-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
            title={tab.name}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[10rem] truncate">{tab.name}</span>
            {tab.isDirty && (
              <span
                className="h-1.5 w-1.5 rounded-full bg-quantum shrink-0"
                aria-label="Unsaved changes"
                title="Unsaved changes"
              />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (
                  tab.isDirty &&
                  !window.confirm(`Discard unsaved changes to "${tab.name}"?`)
                ) {
                  return;
                }
                closeTab(tab.key);
              }}
              className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
              aria-label={`Close ${tab.name}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
