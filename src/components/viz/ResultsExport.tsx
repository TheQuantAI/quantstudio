// Copyright 2026 TheQuantAI
// Export results as JSON or download as file

"use client";

import { useCallback, useState } from "react";
import { Download, Copy, Check, FileJson, Image } from "lucide-react";
import type { ExecutionResult } from "@/store";

interface ResultsExportProps {
  result: ExecutionResult;
  circuitDiagram: string | null;
  circuitName: string;
  className?: string;
}

export function ResultsExport({
  result,
  circuitDiagram,
  circuitName,
  className = "",
}: ResultsExportProps) {
  const [copied, setCopied] = useState(false);

  const exportData = useCallback(() => {
    return {
      circuit_name: circuitName,
      execution: {
        backend: result.backend,
        shots: result.shots,
        execution_time: result.executionTime,
        job_id: result.jobId,
      },
      results: {
        counts: result.counts,
        probabilities: result.probabilities,
        most_likely: result.mostLikely,
      },
      metadata: result.metadata,
      circuit_diagram: circuitDiagram,
      exported_at: new Date().toISOString(),
      platform: "TheQuantCloud",
    };
  }, [result, circuitDiagram, circuitName]);

  const handleCopyJSON = useCallback(() => {
    const data = exportData();
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [exportData]);

  const handleDownloadJSON = useCallback(() => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${circuitName.replace(/\s+/g, "_").toLowerCase()}_results.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportData, circuitName]);

  const handleDownloadCSV = useCallback(() => {
    const rows = [
      ["bitstring", "counts", "probability"],
      ...Object.entries(result.counts)
        .sort((a, b) => b[1] - a[1])
        .map(([bs, count]) => [
          bs,
          String(count),
          String(result.probabilities[bs]?.toFixed(6) || "0"),
        ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${circuitName.replace(/\s+/g, "_").toLowerCase()}_results.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result, circuitName]);

  const handleExportSVG = useCallback(() => {
    // Find the SVG element in the circuit diagram panel
    const svgEl = document.querySelector(
      '[aria-label="Quantum circuit diagram"]'
    );
    if (!svgEl) return;
    const svgData = new XMLSerializer().serializeToString(svgEl);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${circuitName.replace(/\s+/g, "_").toLowerCase()}_circuit.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }, [circuitName]);

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      <button
        onClick={handleCopyJSON}
        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
        title="Copy results as JSON"
      >
        {copied ? (
          <Check className="h-3 w-3 text-green-500" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
        {copied ? "Copied!" : "JSON"}
      </button>
      <button
        onClick={handleDownloadJSON}
        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
        title="Download results as JSON"
      >
        <FileJson className="h-3 w-3" />
        .json
      </button>
      <button
        onClick={handleDownloadCSV}
        className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
        title="Download results as CSV"
      >
        <Download className="h-3 w-3" />
        .csv
      </button>
      {circuitDiagram && (
        <button
          onClick={handleExportSVG}
          className="flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-md bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border"
          title="Download circuit diagram as SVG"
        >
          <Image className="h-3 w-3" />
          .svg
        </button>
      )}
    </div>
  );
}
