// Copyright 2026 TheQuantAI
// STUDIO-019: shared result panels — Histogram / Probabilities / Circuit /
// Stats over the existing viz components. Used by the Dashboard's expanded job
// rows now; the editor's right panel can migrate here later.

"use client";

import { useState } from "react";
import { BarChart3, Info, PieChart, Terminal } from "lucide-react";
import { CircuitDiagramSVG } from "./CircuitDiagramSVG";
import { ProbabilityBars } from "./ProbabilityBars";
import { ResultHistogram } from "./ResultHistogram";
import { StateSummary } from "./StateSummary";

export interface ResultPanelsData {
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  shots: number;
  backend: string;
  executionTimeSec: number | null;
  numQubits: number;
  depth: number | null;
  gateCount: number | null;
  mostLikely: string;
  /** Draw-text for CircuitDiagramSVG; null hides the Circuit tab. */
  diagramText: string | null;
}

type PanelTab = "histogram" | "probabilities" | "circuit" | "stats";

export function ResultPanels({ data }: { data: ResultPanelsData }) {
  const [tab, setTab] = useState<PanelTab>("histogram");
  // On real hardware the stored depth/gates are post-transpilation numbers.
  const transpiled = data.backend.startsWith("ibm_");

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: "histogram", label: "Histogram", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "probabilities", label: "Probabilities", icon: <PieChart className="h-3.5 w-3.5" /> },
    ...(data.diagramText
      ? [{ id: "circuit" as const, label: "Circuit", icon: <Terminal className="h-3.5 w-3.5" /> }]
      : []),
    { id: "stats", label: "Stats", icon: <Info className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="rounded-md border border-border bg-background">
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors ${
              tab === t.id
                ? "border-b-2 border-quantum text-quantum"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="max-h-96 overflow-y-auto p-3">
        {tab === "histogram" && (
          <ResultHistogram counts={data.counts} probabilities={data.probabilities} shots={data.shots} />
        )}
        {tab === "probabilities" && <ProbabilityBars probabilities={data.probabilities} />}
        {tab === "circuit" && data.diagramText && (
          <CircuitDiagramSVG diagramText={data.diagramText} />
        )}
        {tab === "stats" && (
          <div className="space-y-2">
            <StateSummary
              counts={data.counts}
              probabilities={data.probabilities}
              shots={data.shots}
              executionTime={data.executionTimeSec ?? 0}
              backend={data.backend}
              mostLikely={data.mostLikely}
              metadata={{
                numQubits: data.numQubits,
                circuitDepth: data.depth ?? 0,
                gateCount: data.gateCount ?? 0,
              }}
            />
            {transpiled && (
              <p className="text-[11px] text-muted-foreground">
                Depth and gate count are post-transpilation (as executed on the device).
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
