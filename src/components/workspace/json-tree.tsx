// Copyright 2026 TheQuantAI
// STUDIO-018: read-only collapsible tree view for .json tabs. Editing stays in
// the Code view; this is for exploring nested structure.

"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export default function JsonTree({ value }: { value: string }) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (e) {
    return (
      <div className="h-full overflow-auto bg-background p-4 font-mono text-xs text-amber-500">
        Invalid JSON — fix it in the Code view.
        <div className="mt-1 text-muted-foreground">{e instanceof Error ? e.message : String(e)}</div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-auto bg-background p-3 font-mono text-xs">
      <TreeNode name={null} value={parsed} depth={0} isLast />
    </div>
  );
}

function TreeNode({
  name,
  value,
  depth,
  isLast,
}: {
  name: string | null;
  value: unknown;
  depth: number;
  isLast: boolean;
}) {
  const [open, setOpen] = useState(depth < 2); // expand the first couple of levels
  const isArray = Array.isArray(value);
  const isObject = value !== null && typeof value === "object";
  const pad = { paddingLeft: depth * 14 };
  const keyLabel = name !== null ? <span className="text-sky-400">{name}</span> : null;
  const sep = name !== null ? <span className="text-muted-foreground">: </span> : null;
  const comma = !isLast ? <span className="text-muted-foreground">,</span> : null;

  if (!isObject) {
    return (
      <div style={pad} className="whitespace-pre">
        {keyLabel}
        {sep}
        <ValueLeaf value={value} />
        {comma}
      </div>
    );
  }

  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>);
  const open_b = isArray ? "[" : "{";
  const close_b = isArray ? "]" : "}";

  return (
    <div>
      <div
        style={pad}
        className="flex cursor-pointer items-center gap-1 hover:bg-accent/40"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        {keyLabel}
        {sep}
        <span className="text-muted-foreground">
          {open_b}
          {!open && (
            <span className="opacity-60">
              {entries.length} {entries.length === 1 ? "item" : "items"}
              {close_b}
              {!isLast ? "," : ""}
            </span>
          )}
        </span>
      </div>
      {open && (
        <>
          {entries.map(([k, v], i) => (
            <TreeNode
              key={k}
              name={isArray ? null : k}
              value={v}
              depth={depth + 1}
              isLast={i === entries.length - 1}
            />
          ))}
          <div style={pad} className="text-muted-foreground">
            {close_b}
            {comma}
          </div>
        </>
      )}
    </div>
  );
}

function ValueLeaf({ value }: { value: unknown }) {
  if (value === null) return <span className="text-purple-400">null</span>;
  if (typeof value === "string") return <span className="text-emerald-400">&quot;{value}&quot;</span>;
  if (typeof value === "number") return <span className="text-amber-400">{value}</span>;
  if (typeof value === "boolean")
    return <span className="text-purple-400">{String(value)}</span>;
  return <span>{String(value)}</span>;
}
