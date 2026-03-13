"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Code2,
  ArrowRight,
  Atom,
  Zap,
  BookOpen,
  Search,
  Layers,
  Brain,
  Shuffle,
  Cpu,
  Sparkles,
  FlaskConical,
  Wrench,
} from "lucide-react";
import { useCircuitStore, CircuitTemplate } from "@/store";
import { CIRCUIT_TEMPLATES } from "@/lib/templates";

/* ── Category metadata ─────────────────────────────────────────── */
const CATEGORIES = [
  { key: "all", label: "All", icon: Layers, color: "text-foreground" },
  { key: "entanglement", label: "Entanglement", icon: Atom, color: "text-violet-400" },
  { key: "algorithm", label: "Algorithms", icon: Brain, color: "text-blue-400" },
  { key: "transform", label: "Transforms", icon: Shuffle, color: "text-cyan-400" },
  { key: "protocol", label: "Protocols", icon: Sparkles, color: "text-amber-400" },
  { key: "variational", label: "Variational", icon: FlaskConical, color: "text-emerald-400" },
  { key: "utility", label: "Utility", icon: Wrench, color: "text-orange-400" },
  { key: "qml", label: "Quantum ML", icon: Cpu, color: "text-pink-400" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

const CATEGORY_COLORS: Record<string, string> = {
  entanglement: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  algorithm: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  transform: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  protocol: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  variational: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  utility: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  qml: "bg-pink-500/15 text-pink-300 border-pink-500/30",
};

/* ── Difficulty estimation from code length + qubit count ─────── */
function getDifficulty(template: CircuitTemplate): { label: string; color: string } {
  const lines = template.code.split("\n").length;
  if (lines <= 20) return { label: "Beginner", color: "text-green-400" };
  if (lines <= 35) return { label: "Intermediate", color: "text-yellow-400" };
  return { label: "Advanced", color: "text-red-400" };
}

/* ── Extract qubit count from code ────────────────────────────── */
function getQubitCount(template: CircuitTemplate): number {
  const match = template.code.match(/Circuit\((\d+)/);
  return match ? parseInt(match[1], 10) : 2;
}

export default function ExplorePage() {
  const router = useRouter();
  const loadTemplate = useCircuitStore((s) => s.loadTemplate);
  const [activeCategory, setActiveCategory] = useState<CategoryKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Filtered templates ──────────────────────────────────────── */
  const filteredTemplates = useMemo(() => {
    let list = CIRCUIT_TEMPLATES;
    if (activeCategory !== "all") {
      list = list.filter((t) => t.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }
    return list;
  }, [activeCategory, searchQuery]);

  /* ── Category counts ─────────────────────────────────────────── */
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: CIRCUIT_TEMPLATES.length };
    for (const t of CIRCUIT_TEMPLATES) {
      counts[t.category] = (counts[t.category] || 0) + 1;
    }
    return counts;
  }, []);

  const handleOpen = (template: CircuitTemplate) => {
    loadTemplate(template);
    router.push("/studio");
  };

  return (
    <div className="container mx-auto px-4 md:px-6 py-8 max-w-7xl">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-1">Template Gallery</h1>
          <p className="text-muted-foreground text-sm">
            {CIRCUIT_TEMPLATES.length} ready-to-run quantum circuits across{" "}
            {CATEGORIES.length - 1} categories — click any card to open in Studio.
          </p>
        </div>
        <Link href="/studio">
          <Button variant="quantum" className="gap-2">
            <Code2 className="h-4 w-4" />
            Blank Circuit
          </Button>
        </Link>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card
          className="bg-quantum/5 border-quantum/20 hover:border-quantum/40 transition-colors cursor-pointer"
          onClick={() => {
            const bell = CIRCUIT_TEMPLATES.find((t) => t.id === "bell_state");
            if (bell) handleOpen(bell);
          }}
        >
          <CardContent className="pt-6 flex items-center gap-4">
            <Zap className="h-8 w-8 text-quantum flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Quick Start</h3>
              <p className="text-xs text-muted-foreground">
                Open Studio with a Bell State template
              </p>
            </div>
          </CardContent>
        </Card>
        <Card className="hover:border-quantum/40 transition-colors cursor-pointer">
          <CardContent className="pt-6 flex items-center gap-4">
            <BookOpen className="h-8 w-8 text-quantum flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-sm">Tutorials</h3>
              <p className="text-xs text-muted-foreground">
                Step-by-step guides for quantum algorithms
              </p>
            </div>
          </CardContent>
        </Card>
        <a href="https://sdk.thequantai.in" target="_blank" rel="noopener noreferrer">
          <Card className="hover:border-quantum/40 transition-colors cursor-pointer h-full">
            <CardContent className="pt-6 flex items-center gap-4">
              <Atom className="h-8 w-8 text-quantum flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">QuantSDK Docs</h3>
                <p className="text-xs text-muted-foreground">
                  Full API reference and examples
                </p>
              </div>
            </CardContent>
          </Card>
        </a>
      </div>

      {/* ── Search + Filter Bar ────────────────────────────────── */}
      <div className="flex flex-col gap-4 mb-6">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-muted/50 border border-border text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-quantum/40 focus:border-quantum/50 transition-colors"
          />
        </div>

        {/* Category pills */}
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            const isActive = activeCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                  isActive
                    ? "bg-quantum/20 border-quantum/50 text-quantum"
                    : "bg-muted/30 border-border text-muted-foreground hover:border-quantum/30 hover:text-foreground"
                }`}
              >
                <Icon className="h-3 w-3" />
                {cat.label}
                <span
                  className={`ml-0.5 text-[10px] ${
                    isActive ? "text-quantum/80" : "text-muted-foreground/60"
                  }`}
                >
                  {categoryCounts[cat.key] || 0}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Template Grid ──────────────────────────────────────── */}
      {filteredTemplates.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Search className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No templates found</p>
          <p className="text-sm">Try a different search term or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredTemplates.map((template) => {
            const difficulty = getDifficulty(template);
            const qubits = getQubitCount(template);
            const catStyle =
              CATEGORY_COLORS[template.category] ||
              "bg-muted text-muted-foreground border-border";

            return (
              <div
                key={template.id}
                onClick={() => handleOpen(template)}
                className="cursor-pointer"
              >
                <Card className="h-full hover:border-quantum/50 transition-all hover:shadow-md hover:shadow-quantum/5 cursor-pointer group">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between mb-1">
                      <Badge
                        className={`text-[10px] border ${catStyle}`}
                      >
                        {template.category}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <CardTitle className="text-base group-hover:text-quantum transition-colors">
                      {template.name}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {template.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Atom className="h-3 w-3" />
                        {qubits}q
                      </span>
                      <span className={`${difficulty.color}`}>
                        {difficulty.label}
                      </span>
                      <span className="ml-auto text-quantum/70 text-[10px]">
                        TheQuantAI
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Footer stats ───────────────────────────────────────── */}
      <div className="mt-8 text-center text-xs text-muted-foreground/60">
        Showing {filteredTemplates.length} of {CIRCUIT_TEMPLATES.length} templates
        {activeCategory !== "all" && (
          <button
            onClick={() => {
              setActiveCategory("all");
              setSearchQuery("");
            }}
            className="ml-2 text-quantum hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
