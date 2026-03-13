// Copyright 2026 TheQuantAI
// SVG Circuit Diagram Renderer — converts circuit.draw() text to SVG

"use client";

import { useMemo } from "react";

// ─── Parsing ───

interface ParsedGate {
  symbol: string;
  qubit: number;
  col: number;
  isControl: boolean;
  isTarget: boolean;
  isMeasure: boolean;
  isBarrier: boolean;
  isWire: boolean;
  connectedTo?: number; // qubit index of the other end of a 2-qubit gate
}

/**
 * Parse the text output of circuit.draw() into structured gate data.
 *
 * Example input:
 *   q0: ──H──●──M──
 *   q1: ─────X──M──
 */
function parseCircuitText(text: string): {
  numQubits: number;
  columns: ParsedGate[][];
  rawLines: string[];
} {
  const rawLines = text.split("\n").filter((l) => l.trim().length > 0);
  const numQubits = rawLines.length;

  if (numQubits === 0) return { numQubits: 0, columns: [], rawLines: [] };

  // Extract gate tokens from each line.
  // Format: "q0: ──TOKEN──TOKEN──TOKEN──"
  const qubitTokens: string[][] = rawLines.map((line) => {
    // Strip "qN: ──" prefix and trailing "──"
    const match = line.match(/^q\d+:\s*──(.*)──$/);
    if (!match) return [];
    const body = match[1];
    // Split by "──" separator
    return body.split("──").map((t) => t.trim()).filter((t) => t.length > 0);
  });

  // Determine max columns
  const maxCols = Math.max(...qubitTokens.map((t) => t.length), 0);

  // Build column-based gate structure
  const columns: ParsedGate[][] = [];

  for (let col = 0; col < maxCols; col++) {
    const column: ParsedGate[] = [];

    for (let q = 0; q < numQubits; q++) {
      const token = qubitTokens[q]?.[col] || "─";
      const isWire = /^─+$/.test(token) || token === "";
      const isControl = token.trim() === "●";
      const isTarget = token.trim() === "X" || token.trim() === "Y";
      const isMeasure = token.trim() === "M";
      const isBarrier = token.trim() === "|";

      column.push({
        symbol: token.trim() || "─",
        qubit: q,
        col,
        isControl,
        isTarget,
        isMeasure,
        isBarrier,
        isWire,
      });
    }

    // Detect 2-qubit gate connections (control ● connected to target)
    const controlIdx = column.findIndex((g) => g.isControl);
    const targetIdx = column.findIndex(
      (g) => g.isTarget || (g.symbol === "X" && controlIdx >= 0)
    );
    if (controlIdx >= 0 && targetIdx >= 0) {
      column[controlIdx].connectedTo = targetIdx;
      column[targetIdx].connectedTo = controlIdx;
    }

    // Detect SWAP connections (two "x" symbols)
    const swapIndices = column
      .map((g, i) => (g.symbol.toLowerCase() === "x" && !g.isTarget ? i : -1))
      .filter((i) => i >= 0);
    if (swapIndices.length === 2) {
      column[swapIndices[0]].connectedTo = swapIndices[1];
      column[swapIndices[1]].connectedTo = swapIndices[0];
    }

    columns.push(column);
  }

  return { numQubits, columns, rawLines };
}

// ─── SVG Rendering Constants ───

const QUBIT_SPACING = 48; // vertical distance between qubit wires
const GATE_WIDTH = 40; // width of a gate box
const GATE_SPACING = 56; // horizontal distance between gates
const WIRE_START = 64; // where the wire starts (after label)
const PADDING_TOP = 24;
const PADDING_LEFT = 12;
const PADDING_RIGHT = 24;
const PADDING_BOTTOM = 16;
const GATE_HEIGHT = 32;

// Colors
const WIRE_COLOR = "#64748b";
const GATE_BG = "#7c3aed"; // quantum purple
const GATE_STROKE = "#a78bfa";
const GATE_TEXT = "#ffffff";
const CONTROL_COLOR = "#a78bfa";
const MEASURE_BG = "#f59e0b";
const MEASURE_STROKE = "#fbbf24";
const BARRIER_COLOR = "#475569";
const LABEL_COLOR = "#94a3b8";

// ─── Component ───

interface CircuitDiagramSVGProps {
  diagramText: string;
  className?: string;
}

export function CircuitDiagramSVG({ diagramText, className = "" }: CircuitDiagramSVGProps) {
  const { numQubits, columns } = useMemo(
    () => parseCircuitText(diagramText),
    [diagramText]
  );

  if (numQubits === 0) {
    return (
      <div className={`text-center py-8 text-muted-foreground text-sm ${className}`}>
        No circuit to display
      </div>
    );
  }

  const totalWidth =
    PADDING_LEFT + WIRE_START + columns.length * GATE_SPACING + PADDING_RIGHT;
  const totalHeight =
    PADDING_TOP + numQubits * QUBIT_SPACING + PADDING_BOTTOM;

  return (
    <div className={`overflow-x-auto ${className}`}>
      <svg
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        width={totalWidth}
        height={totalHeight}
        className="min-w-fit"
        role="img"
        aria-label="Quantum circuit diagram"
      >
        {/* Background */}
        <rect
          width={totalWidth}
          height={totalHeight}
          fill="transparent"
          rx={8}
        />

        {/* Qubit labels and wires */}
        {Array.from({ length: numQubits }).map((_, q) => {
          const y = PADDING_TOP + q * QUBIT_SPACING + QUBIT_SPACING / 2;
          const wireEnd =
            PADDING_LEFT + WIRE_START + columns.length * GATE_SPACING;
          return (
            <g key={`wire-${q}`}>
              {/* Label */}
              <text
                x={PADDING_LEFT + 4}
                y={y + 4}
                fill={LABEL_COLOR}
                fontSize={13}
                fontFamily="monospace"
                fontWeight={600}
              >
                q{q}
              </text>
              {/* Wire line */}
              <line
                x1={PADDING_LEFT + WIRE_START - 8}
                y1={y}
                x2={wireEnd}
                y2={y}
                stroke={WIRE_COLOR}
                strokeWidth={1.5}
                strokeLinecap="round"
              />
              {/* Ket label on right end */}
              <text
                x={wireEnd + 6}
                y={y + 4}
                fill={LABEL_COLOR}
                fontSize={11}
                fontFamily="monospace"
                opacity={0.6}
              >
                |0⟩
              </text>
            </g>
          );
        })}

        {/* Gates */}
        {columns.map((column, colIdx) =>
          column.map((gate) => {
            const cx =
              PADDING_LEFT +
              WIRE_START +
              colIdx * GATE_SPACING +
              GATE_SPACING / 2;
            const cy =
              PADDING_TOP +
              gate.qubit * QUBIT_SPACING +
              QUBIT_SPACING / 2;

            if (gate.isWire) return null;

            // Barrier
            if (gate.isBarrier) {
              return (
                <line
                  key={`barrier-${colIdx}-${gate.qubit}`}
                  x1={cx}
                  y1={cy - QUBIT_SPACING / 2 + 4}
                  x2={cx}
                  y2={cy + QUBIT_SPACING / 2 - 4}
                  stroke={BARRIER_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              );
            }

            // Connection line for 2-qubit gates
            const connectionLine =
              gate.connectedTo !== undefined &&
              gate.connectedTo > gate.qubit ? (
                <line
                  key={`conn-${colIdx}-${gate.qubit}`}
                  x1={cx}
                  y1={cy}
                  x2={cx}
                  y2={
                    PADDING_TOP +
                    gate.connectedTo * QUBIT_SPACING +
                    QUBIT_SPACING / 2
                  }
                  stroke={CONTROL_COLOR}
                  strokeWidth={2}
                />
              ) : null;

            // Measure gate (meter icon)
            if (gate.isMeasure) {
              return (
                <g key={`gate-${colIdx}-${gate.qubit}`}>
                  {connectionLine}
                  <rect
                    x={cx - GATE_WIDTH / 2}
                    y={cy - GATE_HEIGHT / 2}
                    width={GATE_WIDTH}
                    height={GATE_HEIGHT}
                    rx={4}
                    fill={MEASURE_BG}
                    fillOpacity={0.15}
                    stroke={MEASURE_STROKE}
                    strokeWidth={1.5}
                  />
                  {/* Meter arc */}
                  <path
                    d={`M ${cx - 8} ${cy + 6} A 10 10 0 0 1 ${cx + 8} ${cy + 6}`}
                    fill="none"
                    stroke={MEASURE_STROKE}
                    strokeWidth={1.5}
                  />
                  {/* Meter needle */}
                  <line
                    x1={cx}
                    y1={cy + 6}
                    x2={cx + 6}
                    y2={cy - 6}
                    stroke={MEASURE_STROKE}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                  />
                </g>
              );
            }

            // Control dot
            if (gate.isControl) {
              return (
                <g key={`gate-${colIdx}-${gate.qubit}`}>
                  {connectionLine}
                  <circle
                    cx={cx}
                    cy={cy}
                    r={6}
                    fill={CONTROL_COLOR}
                  />
                </g>
              );
            }

            // Regular gate box
            const label = gate.symbol;
            const boxWidth = Math.max(GATE_WIDTH, label.length * 10 + 12);

            return (
              <g key={`gate-${colIdx}-${gate.qubit}`}>
                {connectionLine}
                {/* Gate box with glow */}
                <rect
                  x={cx - boxWidth / 2 - 2}
                  y={cy - GATE_HEIGHT / 2 - 2}
                  width={boxWidth + 4}
                  height={GATE_HEIGHT + 4}
                  rx={6}
                  fill={GATE_BG}
                  fillOpacity={0.1}
                  filter="blur(4px)"
                />
                <rect
                  x={cx - boxWidth / 2}
                  y={cy - GATE_HEIGHT / 2}
                  width={boxWidth}
                  height={GATE_HEIGHT}
                  rx={6}
                  fill={GATE_BG}
                  fillOpacity={0.2}
                  stroke={GATE_STROKE}
                  strokeWidth={1.5}
                />
                {/* Gate label */}
                <text
                  x={cx}
                  y={cy + 5}
                  fill={GATE_TEXT}
                  fontSize={label.length > 3 ? 11 : 14}
                  fontFamily="monospace"
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {label}
                </text>
              </g>
            );
          })
        )}
      </svg>
    </div>
  );
}
