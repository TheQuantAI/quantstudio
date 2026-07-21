// Copyright 2026 TheQuantAI
// STUDIO-018: editable spreadsheet grid for .csv tabs. Hand-rolled — the
// 100 KB/file cap bounds table size, so no grid library is needed. All edits
// serialize back through onChange (→ store setCode), keeping the tab's content
// string the single source of truth for dirty state and Save.

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { csvGridViable, parseCsv, serializeCsv, type CsvTable } from "@/lib/csv";

export default function CsvGrid({
  value,
  onChange,
  onFallbackToRaw,
}: {
  value: string;
  onChange: (csv: string) => void;
  /** Called when the content is too large for the grid — parent shows raw view. */
  onFallbackToRaw: () => void;
}) {
  // Parse once per mount; the parent remounts us (key) on tab switch or
  // raw→grid toggle, so `rows` always starts from the current content.
  const initial = useMemo(() => parseCsv(value), [value]);
  // Controlled cells: index-keyed inputs must re-render on row/col removal.
  // Typing updates local state only; the serialized CSV is committed on blur
  // (per keystroke would churn the store + Monaco model needlessly).
  const [rows, setRows] = useState<CsvTable>(initial.rows);
  // Commit handlers (blur/click — always later events than the render that
  // produced `rows`) read the ref; effects flush before the next event fires.
  const rowsRef = useRef(rows);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);
  // Guard: blur fires on mere focus loss — only propagate real changes,
  // otherwise clicking a cell would mark the tab dirty without any edit.
  const lastCommittedRef = useRef(serializeCsv(initial.rows));

  if (!csvGridViable(initial)) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background p-6 text-sm text-muted-foreground">
        <p>This CSV is too large for the table view.</p>
        <button
          onClick={onFallbackToRaw}
          className="rounded border border-border px-3 py-1 text-xs hover:bg-accent"
        >
          Open as raw text
        </button>
      </div>
    );
  }

  const propagate = (csv: string) => {
    if (csv === lastCommittedRef.current) return;
    lastCommittedRef.current = csv;
    onChange(csv);
  };

  /** Structure ops commit immediately; cell typing commits on blur. */
  const commit = (next: CsvTable) => {
    setRows(next);
    propagate(serializeCsv(next));
  };

  const typeCell = (r: number, c: number, v: string) =>
    setRows((cur) => cur.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? v : cell)) : row)));

  const commitCurrent = () => propagate(serializeCsv(rowsRef.current));

  const addRow = (at: number) => {
    const width = rowsRef.current[0]?.length ?? 1;
    const cur = rowsRef.current;
    commit([...cur.slice(0, at), Array(width).fill(""), ...cur.slice(at)]);
  };

  const removeRow = (at: number) => {
    const cur = rowsRef.current;
    if (cur.length <= 1) return commit([Array(cur[0]?.length ?? 1).fill("")]);
    commit(cur.filter((_, i) => i !== at));
  };

  const addCol = (at: number) =>
    commit(rowsRef.current.map((row) => [...row.slice(0, at), "", ...row.slice(at)]));

  const removeCol = (at: number) => {
    const cur = rowsRef.current;
    if ((cur[0]?.length ?? 1) <= 1) return commit(cur.map(() => [""]));
    commit(cur.map((row) => row.filter((_, j) => j !== at)));
  };

  const width = rows[0]?.length ?? 0;

  return (
    <div
      className="h-full overflow-auto bg-background p-3"
      // Ctrl/Cmd+S: commit the focused cell before the global save handler
      // reads the store (its blur won't have fired yet).
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") commitCurrent();
      }}
    >
      {initial.ragged && (
        <p className="mb-2 text-[11px] text-amber-500">
          Rows had uneven lengths — shorter rows were padded with empty cells.
        </p>
      )}
      <table className="border-collapse font-mono text-xs">
        <thead>
          <tr>
            <th className="w-8" />
            {Array.from({ length: width }, (_, c) => (
              <th key={c} className="min-w-24 px-1 pb-1 text-center font-normal text-muted-foreground">
                <span className="mr-1 select-none">{colLabel(c)}</span>
                <GridBtn title="Add column after" onClick={() => addCol(c + 1)}>
                  <Plus className="h-3 w-3" />
                </GridBtn>
                <GridBtn title="Delete column" onClick={() => removeCol(c)}>
                  <Minus className="h-3 w-3" />
                </GridBtn>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="group">
              <td className="pr-1 text-right align-middle text-muted-foreground">
                <span className="mr-0.5 select-none">{r + 1}</span>
                <span className="inline-flex opacity-0 group-hover:opacity-100">
                  <GridBtn title="Add row below" onClick={() => addRow(r + 1)}>
                    <Plus className="h-3 w-3" />
                  </GridBtn>
                  <GridBtn title="Delete row" onClick={() => removeRow(r)}>
                    <Minus className="h-3 w-3" />
                  </GridBtn>
                </span>
              </td>
              {row.map((cell, c) => (
                <td key={c} className="border border-border p-0">
                  <input
                    value={cell}
                    onChange={(e) => typeCell(r, c, e.target.value)}
                    onBlur={commitCurrent}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className={`w-full min-w-24 bg-transparent px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-quantum ${
                      r === 0 ? "font-semibold" : ""
                    }`}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Spreadsheet-style column label: A…Z, AA…  */
function colLabel(index: number): string {
  let label = "";
  let n = index;
  do {
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return label;
}

function GridBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
    >
      {children}
    </button>
  );
}
