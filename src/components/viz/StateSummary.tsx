// Copyright 2026 TheQuantAI
// Statistical summary panel for circuit execution results

"use client";

import { useMemo } from "react";
import type { CircuitMetadata } from "@/store";
import {
  Zap,
  Layers,
  Hash,
  Cpu,
  Timer,
  Activity,
} from "lucide-react";

interface StateSummaryProps {
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  shots: number;
  executionTime: number;
  backend: string;
  mostLikely: string;
  metadata?: CircuitMetadata;
  className?: string;
}

/** Compute Shannon entropy H = -Σ p log2(p) */
function shannonEntropy(probs: Record<string, number>): number {
  let h = 0;
  for (const p of Object.values(probs)) {
    if (p > 0) h -= p * Math.log2(p);
  }
  return h;
}

/** Compute statistical uniformity (entropy / max possible entropy) */
function uniformity(probs: Record<string, number>): number {
  const n = Object.keys(probs).length;
  if (n <= 1) return 1;
  const maxEntropy = Math.log2(n);
  const entropy = shannonEntropy(probs);
  return maxEntropy > 0 ? entropy / maxEntropy : 1;
}

export function StateSummary({
  counts,
  probabilities,
  shots,
  executionTime,
  backend,
  mostLikely,
  metadata,
  className = "",
}: StateSummaryProps) {
  const stats = useMemo(() => {
    const entropy = shannonEntropy(probabilities);
    const uni = uniformity(probabilities);
    const numStates = Object.keys(probabilities).length;
    const numQubits = metadata?.numQubits || mostLikely.length;
    const totalPossibleStates = Math.pow(2, numQubits);
    const occupiedRatio = numStates / totalPossibleStates;

    // Top 3 states
    const topStates = Object.entries(probabilities)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Concentration: how much probability is in top state
    const topConcentration = topStates[0]?.[1] || 0;

    return {
      entropy,
      uniformity: uni,
      numStates,
      totalPossibleStates,
      occupiedRatio,
      topStates,
      topConcentration,
      numQubits,
    };
  }, [probabilities, metadata, mostLikely]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Circuit Metrics */}
      {metadata && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Circuit Metrics
          </h4>
          <div className="grid grid-cols-3 gap-2">
            <MetricCard
              icon={<Hash className="h-3.5 w-3.5" />}
              label="Qubits"
              value={String(metadata.numQubits)}
            />
            <MetricCard
              icon={<Layers className="h-3.5 w-3.5" />}
              label="Depth"
              value={String(metadata.circuitDepth)}
            />
            <MetricCard
              icon={<Zap className="h-3.5 w-3.5" />}
              label="Gates"
              value={String(metadata.gateCount)}
            />
          </div>
        </div>
      )}

      {/* Execution Metrics */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Execution
        </h4>
        <div className="grid grid-cols-3 gap-2">
          <MetricCard
            icon={<Cpu className="h-3.5 w-3.5" />}
            label="Shots"
            value={shots.toLocaleString()}
          />
          <MetricCard
            icon={<Timer className="h-3.5 w-3.5" />}
            label="Time"
            value={`${executionTime.toFixed(2)}s`}
          />
          <MetricCard
            icon={<Activity className="h-3.5 w-3.5" />}
            label="States"
            value={`${stats.numStates}/${stats.totalPossibleStates}`}
          />
        </div>
      </div>

      {/* Statistical Analysis */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Analysis
        </h4>
        <div className="space-y-2.5">
          {/* Most likely state */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Most likely state</span>
            <code className="text-sm font-mono font-bold text-purple-400">
              |{mostLikely}⟩
            </code>
          </div>

          {/* Concentration */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Top state probability</span>
            <span className="text-sm font-semibold text-foreground">
              {(stats.topConcentration * 100).toFixed(1)}%
            </span>
          </div>

          {/* Shannon Entropy */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                Shannon entropy
              </span>
              <span className="text-xs font-mono text-foreground">
                {stats.entropy.toFixed(3)} bits
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-600 to-purple-400 transition-all duration-500"
                style={{
                  width: `${stats.uniformity * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[9px] text-muted-foreground">Concentrated</span>
              <span className="text-[9px] text-muted-foreground">Uniform</span>
            </div>
          </div>

          {/* State space occupation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-muted-foreground">
                State space coverage
              </span>
              <span className="text-xs font-mono text-foreground">
                {(stats.occupiedRatio * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-800/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400 transition-all duration-500"
                style={{
                  width: `${Math.min(stats.occupiedRatio * 100, 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top States */}
      <div>
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Top States
        </h4>
        <div className="space-y-1.5">
          {stats.topStates.map(([bitstring, prob], idx) => (
            <div
              key={bitstring}
              className="flex items-center gap-2 text-xs"
            >
              <span className="text-muted-foreground w-4">
                {idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉"}
              </span>
              <code className="font-mono text-purple-400 w-20">
                |{bitstring}⟩
              </code>
              <div className="flex-1 h-3 rounded-full bg-slate-800/50 overflow-hidden">
                <div
                  className="h-full rounded-full bg-purple-500/60 transition-all duration-500"
                  style={{ width: `${prob * 100}%` }}
                />
              </div>
              <span className="text-muted-foreground w-12 text-right font-mono">
                {(prob * 100).toFixed(1)}%
              </span>
              <span className="text-muted-foreground w-10 text-right font-mono">
                {counts[bitstring]?.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Backend info */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Backend: {backend}</span>
          <span>
            {shots.toLocaleString()} shots · {executionTime.toFixed(3)}s
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ───

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-2 text-center">
      <div className="flex items-center justify-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
