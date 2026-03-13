// Copyright 2026 TheQuantAI
// Horizontal probability bar chart with gradient fills

"use client";

import { useMemo } from "react";

interface ProbabilityBarsProps {
  probabilities: Record<string, number>;
  maxBars?: number;
  className?: string;
}

export function ProbabilityBars({
  probabilities,
  maxBars = 16,
  className = "",
}: ProbabilityBarsProps) {
  const entries = useMemo(() => {
    const sorted = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
    return sorted.slice(0, maxBars);
  }, [probabilities, maxBars]);

  const totalStates = Object.keys(probabilities).length;
  const shownStates = entries.length;
  const maxProb = entries[0]?.[1] || 1;

  return (
    <div className={`space-y-1.5 ${className}`}>
      {entries.map(([bitstring, prob], idx) => {
        const widthPct = (prob / maxProb) * 100;
        // Color gradient: brightest for highest probability
        const opacity = 0.4 + (prob / maxProb) * 0.55;
        const isTop = idx === 0;

        return (
          <div key={bitstring} className="group flex items-center gap-2">
            {/* Bitstring label */}
            <code
              className={`text-xs font-mono w-20 text-right shrink-0 ${
                isTop ? "text-purple-400 font-bold" : "text-slate-400"
              }`}
            >
              |{bitstring}⟩
            </code>

            {/* Bar container */}
            <div className="flex-1 h-5 rounded-md bg-slate-800/50 relative overflow-hidden">
              {/* Filled bar */}
              <div
                className="h-full rounded-md transition-all duration-500 ease-out"
                style={{
                  width: `${widthPct}%`,
                  background: isTop
                    ? `linear-gradient(90deg, rgba(139,92,246,${opacity}) 0%, rgba(168,85,247,${opacity + 0.1}) 100%)`
                    : `linear-gradient(90deg, rgba(100,116,139,${opacity * 0.7}) 0%, rgba(139,92,246,${opacity}) 100%)`,
                  boxShadow: isTop
                    ? "0 0 12px rgba(139,92,246,0.3)"
                    : "none",
                }}
              />
              {/* Probability text overlay */}
              <span
                className={`absolute right-2 top-0 h-full flex items-center text-[10px] font-medium ${
                  widthPct > 30
                    ? "text-white/90"
                    : "text-slate-400"
                }`}
              >
                {(prob * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        );
      })}

      {/* Show count of hidden states */}
      {totalStates > shownStates && (
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          + {totalStates - shownStates} more states with lower probability
        </p>
      )}
    </div>
  );
}
