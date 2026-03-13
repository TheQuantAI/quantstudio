// Copyright 2026 TheQuantAI
// Enhanced Result Histogram with quantum styling, tooltips, and probabilities

"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface ResultHistogramProps {
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  shots: number;
  mode?: "counts" | "probabilities";
  className?: string;
}

// Quantum-themed gradient colors
const PURPLE_COLORS = [
  "rgba(139, 92, 246, 0.85)", // primary
  "rgba(168, 85, 247, 0.8)",
  "rgba(124, 58, 237, 0.8)",
  "rgba(109, 40, 217, 0.75)",
  "rgba(147, 51, 234, 0.7)",
  "rgba(192, 132, 252, 0.65)",
];

function getBarColor(index: number, total: number): string {
  if (total <= 1) return PURPLE_COLORS[0];
  // Gradient from bright to dim
  const t = index / (total - 1);
  const alpha = 0.85 - t * 0.4;
  return `rgba(139, 92, 246, ${alpha})`;
}

export function ResultHistogram({
  counts,
  probabilities,
  shots,
  mode = "counts",
  className = "",
}: ResultHistogramProps) {
  const entries = useMemo(() => {
    const e = Object.entries(mode === "counts" ? counts : probabilities);
    return e.sort((a, b) => b[1] - a[1]);
  }, [counts, probabilities, mode]);

  const data = useMemo(() => {
    const colors = entries.map((_, i) => getBarColor(i, entries.length));
    const borderColors = entries.map(
      (_, i) => getBarColor(i, entries.length).replace(/[\d.]+\)$/, "1)")
    );

    return {
      labels: entries.map(([bitstring]) => `|${bitstring}⟩`),
      datasets: [
        {
          label: mode === "counts" ? "Counts" : "Probability",
          data: entries.map(([, val]) =>
            mode === "probabilities" ? Number((val * 100).toFixed(2)) : val
          ),
          backgroundColor: colors,
          borderColor: borderColors,
          borderWidth: 1.5,
          borderRadius: 6,
          borderSkipped: false,
          hoverBackgroundColor: "rgba(167, 139, 250, 0.95)",
          hoverBorderColor: "rgba(167, 139, 250, 1)",
          hoverBorderWidth: 2,
        },
      ],
    };
  }, [entries, mode]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 600,
        easing: "easeOutQuart" as const,
      },
      interaction: {
        intersect: false,
        mode: "index" as const,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(15, 15, 35, 0.95)",
          titleColor: "#a78bfa",
          bodyColor: "#e2e8f0",
          borderColor: "rgba(139, 92, 246, 0.4)",
          borderWidth: 1,
          cornerRadius: 8,
          padding: 12,
          titleFont: { family: "monospace", size: 13, weight: "bold" as const },
          bodyFont: { size: 12 },
          callbacks: {
            title: (items: Array<{ label: string }>) => items[0]?.label || "",
            label: (item: { raw: unknown; dataIndex: number }) => {
              const rawVal = Number(item.raw);
              if (mode === "counts") {
                const prob = probabilities[entries[item.dataIndex][0]];
                return [
                  `Counts: ${rawVal.toLocaleString()} / ${shots.toLocaleString()}`,
                  `Probability: ${(prob * 100).toFixed(2)}%`,
                ];
              }
              const count = counts[entries[item.dataIndex][0]];
              return [
                `Probability: ${rawVal}%`,
                `Counts: ${count?.toLocaleString() || 0} / ${shots.toLocaleString()}`,
              ];
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            color: "#94a3b8",
            font: { family: "monospace", size: entries.length > 8 ? 9 : 11 },
            maxRotation: entries.length > 8 ? 45 : 0,
          },
          grid: { display: false },
          border: { color: "rgba(148, 163, 184, 0.15)" },
        },
        y: {
          ticks: {
            color: "#94a3b8",
            font: { size: 11 },
            callback: (value: number | string) =>
              mode === "probabilities" ? `${value}%` : value,
          },
          grid: { color: "rgba(148, 163, 184, 0.08)" },
          border: { display: false },
          beginAtZero: true,
        },
      },
    }),
    [entries, mode, shots, counts, probabilities]
  );

  return (
    <div className={`${className}`}>
      <div className="h-52">
        <Bar data={data} options={options} />
      </div>
    </div>
  );
}
