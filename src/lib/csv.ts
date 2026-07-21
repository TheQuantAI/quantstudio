// Copyright 2026 TheQuantAI
// STUDIO-018: RFC 4180 CSV parse/serialize for the workspace CSV grid.
// Pure module — no React, no I/O — so it is unit-testable in isolation.

/** Rows × cells. No header semantics — row 0 is just the first row. */
export type CsvTable = string[][];

export interface CsvParseResult {
  rows: CsvTable;
  /** True when input rows had differing lengths (grid pads to the widest). */
  ragged: boolean;
}

/** Beyond these the grid falls back to the raw text editor. */
export const CSV_GRID_MAX_ROWS = 5000;
export const CSV_GRID_MAX_COLS = 200;

/**
 * Parse CSV text (RFC 4180): quoted fields with `""` escapes, commas and
 * newlines inside quotes, CRLF or LF line endings, tolerated trailing newline.
 * Never throws — any text is structurally CSV. Ragged rows are padded to the
 * widest row so the grid is rectangular; `ragged` reports that this happened.
 */
export function parseCsv(text: string): CsvParseResult {
  const rows: CsvTable = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;

  const endCell = () => {
    row.push(cell);
    cell = "";
  };
  const endRow = () => {
    endCell();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        cell += ch;
        i += 1;
      }
    } else if (ch === '"' && cell === "") {
      inQuotes = true;
      i += 1;
    } else if (ch === ",") {
      endCell();
      i += 1;
    } else if (ch === "\r" && text[i + 1] === "\n") {
      endRow();
      i += 2;
    } else if (ch === "\n" || ch === "\r") {
      endRow();
      i += 1;
    } else {
      cell += ch;
      i += 1;
    }
  }
  // Final cell/row unless the text ended exactly on a row break (or was empty).
  if (cell !== "" || row.length > 0 || inQuotes) endRow();

  if (rows.length === 0) return { rows: [[""]], ragged: false };

  const width = Math.max(...rows.map((r) => r.length));
  let ragged = false;
  for (const r of rows) {
    if (r.length !== width) {
      ragged = true;
      while (r.length < width) r.push("");
    }
  }
  return { rows, ragged };
}

/**
 * Serialize rows back to CSV. A cell is quoted iff it contains a comma, quote,
 * or newline. Output uses LF and ends with a trailing newline (normalization:
 * CRLF input round-trips as LF — the raw view shows the normalized form).
 */
export function serializeCsv(rows: CsvTable): string {
  if (rows.length === 0) return "";
  return (
    rows
      .map((r) =>
        r
          .map((cell) =>
            /[",\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell,
          )
          .join(","),
      )
      .join("\n") + "\n"
  );
}

/** Whether the parsed table is small enough for the editable grid. */
export function csvGridViable(result: CsvParseResult): boolean {
  return (
    result.rows.length <= CSV_GRID_MAX_ROWS &&
    (result.rows[0]?.length ?? 0) <= CSV_GRID_MAX_COLS
  );
}
