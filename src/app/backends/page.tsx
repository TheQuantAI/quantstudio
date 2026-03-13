"use client";

import { useBackendStore } from "@/store";
import type { BackendInfo } from "@/store";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Server,
  Cpu,
  Activity,
  Gauge,
  Clock,
  DollarSign,
  Wifi,
  WifiOff,
  Zap,
  Globe,
  ChevronDown,
  ArrowUpDown,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type SortKey = "name" | "qubits" | "fidelity" | "cost" | "queue";
type FilterType = "all" | "simulator" | "hardware";

export default function BackendsPage() {
  const { backends, isLoading, fetchBackends } = useBackendStore();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [filterType, setFilterType] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);

  // Fetch backends from API on mount
  useEffect(() => {
    fetchBackends();
  }, [fetchBackends]);

  // Filter and sort
  const filteredBackends = useMemo(() => {
    let list = [...backends];

    if (filterType !== "all") {
      list = list.filter((b) => b.type === filterType);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (b) =>
          b.name.toLowerCase().includes(q) ||
          b.provider.toLowerCase().includes(q) ||
          b.technology.toLowerCase().includes(q) ||
          b.description.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      switch (sortKey) {
        case "qubits": return b.qubits - a.qubits;
        case "fidelity": return b.avgFidelity - a.avgFidelity;
        case "cost": return a.costPerShot - b.costPerShot;
        case "queue": return a.queueDepth - b.queueDepth;
        default: return a.name.localeCompare(b.name);
      }
    });

    return list;
  }, [backends, filterType, searchQuery, sortKey]);

  const onlineCount = backends.filter((b) => b.status === "online").length;
  const hwCount = backends.filter((b) => b.type === "hardware").length;
  const maxQubits = backends.length > 0 ? Math.max(...backends.map((b) => b.qubits)) : 0;

  const statusBadge = (status: string) => {
    switch (status) {
      case "online": return <Badge variant="success">Online</Badge>;
      case "offline": return <Badge variant="destructive">Offline</Badge>;
      case "busy": return <Badge variant="warning">Busy</Badge>;
      default: return <Badge variant="secondary">Maintenance</Badge>;
    }
  };

  const techBadge = (tech: string) => {
    const colors: Record<string, string> = {
      "superconducting": "bg-blue-500/10 text-blue-400 border-blue-500/20",
      "trapped-ion": "bg-purple-500/10 text-purple-400 border-purple-500/20",
      "cpu": "bg-slate-500/10 text-slate-400 border-slate-500/20",
      "gpu": "bg-green-500/10 text-green-400 border-green-500/20",
      "photonic": "bg-amber-500/10 text-amber-400 border-amber-500/20",
    };
    return (
      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${colors[tech] || colors.cpu}`}>
        {tech}
      </span>
    );
  };

  const toggleCompare = (id: string) => {
    setCompareIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 3 ? [...prev, id] : prev
    );
  };

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Backend Status</h1>
        <p className="text-muted-foreground">
          Real-time status of quantum backends available on TheQuantCloud.
          QuantRouter automatically selects the optimal backend for your circuit.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card><CardContent className="pt-6 text-center">
          <Server className="h-7 w-7 mx-auto mb-2 text-quantum" />
          <p className="text-2xl font-bold">{backends.length}</p>
          <p className="text-xs text-muted-foreground">Total Backends</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Wifi className="h-7 w-7 mx-auto mb-2 text-emerald-400" />
          <p className="text-2xl font-bold">{onlineCount}</p>
          <p className="text-xs text-muted-foreground">Online</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Cpu className="h-7 w-7 mx-auto mb-2 text-blue-400" />
          <p className="text-2xl font-bold">{hwCount}</p>
          <p className="text-xs text-muted-foreground">Hardware QPUs</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Gauge className="h-7 w-7 mx-auto mb-2 text-purple-400" />
          <p className="text-2xl font-bold">{maxQubits}</p>
          <p className="text-xs text-muted-foreground">Max Qubits</p>
        </CardContent></Card>
        <Card><CardContent className="pt-6 text-center">
          <Globe className="h-7 w-7 mx-auto mb-2 text-cyan-400" />
          <p className="text-2xl font-bold">{new Set(backends.map((b) => b.provider)).size}</p>
          <p className="text-xs text-muted-foreground">Providers</p>
        </CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search backends..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-quantum"
          />
        </div>
        <div className="flex gap-1">
          {(["all", "simulator", "hardware"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilterType(f)}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                filterType === f
                  ? "bg-quantum/20 border-quantum/40 text-quantum"
                  : "border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {f === "all" ? "All" : f === "simulator" ? "Simulators" : "QPUs"}
            </button>
          ))}
        </div>
        <button
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => {
            const keys: SortKey[] = ["name", "qubits", "fidelity", "cost", "queue"];
            setSortKey(keys[(keys.indexOf(sortKey) + 1) % keys.length]);
          }}
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          Sort: {sortKey}
        </button>
        <button
          onClick={() => { setShowComparison(!showComparison); if (showComparison) setCompareIds([]); }}
          className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
            showComparison
              ? "bg-quantum/20 border-quantum/40 text-quantum"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          {showComparison ? "Exit Compare" : "Compare"}
        </button>
      </div>

      {/* Comparison Table */}
      {showComparison && compareIds.length >= 2 && (
        <ComparisonTable backends={backends.filter((b) => compareIds.includes(b.id))} />
      )}
      {showComparison && compareIds.length < 2 && (
        <div className="mb-6 p-4 rounded-lg border border-dashed border-quantum/30 bg-quantum/5 text-center">
          <p className="text-sm text-muted-foreground">Select 2-3 backends below to compare side-by-side</p>
        </div>
      )}

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-8 w-8 mx-auto mb-2 animate-spin" />
          <p className="text-sm">Loading backends...</p>
        </div>
      )}

      {/* Backend list */}
      <div className="space-y-4">
        {filteredBackends.map((backend) => (
          <Card
            key={backend.id}
            className={`transition-all ${
              backend.status === "online" ? "hover:border-quantum/50" : "opacity-80"
            } ${compareIds.includes(backend.id) ? "ring-2 ring-quantum/50" : ""}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-2.5 w-2.5 rounded-full ${
                    backend.status === "online" ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" :
                    backend.status === "busy" ? "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.4)]" :
                    backend.status === "offline" ? "bg-red-400" : "bg-slate-400"
                  }`} />
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {backend.name}
                      {techBadge(backend.technology)}
                    </CardTitle>
                    <CardDescription className="flex items-center gap-2">
                      {backend.provider}
                      {backend.region && (
                        <span className="text-[10px] text-muted-foreground/60">· {backend.region}</span>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {showComparison && (
                    <button
                      onClick={() => toggleCompare(backend.id)}
                      className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                        compareIds.includes(backend.id)
                          ? "bg-quantum/20 border-quantum/40 text-quantum"
                          : "border-border text-muted-foreground"
                      }`}
                    >
                      {compareIds.includes(backend.id) ? "Selected" : "Select"}
                    </button>
                  )}
                  {statusBadge(backend.status)}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
                {backend.description}
              </p>
              <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-3">
                <MetricCell icon={<Cpu className="h-3.5 w-3.5" />} label="Qubits" value={String(backend.qubits)} />
                <MetricCell icon={<Gauge className="h-3.5 w-3.5" />} label="Fidelity" value={`${(backend.avgFidelity * 100).toFixed(1)}%`} highlight={backend.avgFidelity >= 0.99} />
                <MetricCell icon={<Clock className="h-3.5 w-3.5" />} label="Queue" value={`${backend.queueDepth} jobs`} />
                <MetricCell icon={<DollarSign className="h-3.5 w-3.5" />} label="Cost/Shot" value={backend.costPerShot === 0 ? "Free" : `$${backend.costPerShot}`} highlight={backend.costPerShot === 0} />
                <MetricCell icon={<Zap className="h-3.5 w-3.5" />} label="Connectivity" value={backend.connectivity || "—"} />
                <MetricCell icon={<Clock className="h-3.5 w-3.5" />} label="Avg Wait" value={backend.avgQueueTimeSec === 0 ? "Instant" : `~${Math.round(backend.avgQueueTimeSec)}s`} />
              </div>

              <button
                onClick={() => setExpandedId(expandedId === backend.id ? null : backend.id)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronDown className={`h-3 w-3 transition-transform ${expandedId === backend.id ? "rotate-180" : ""}`} />
                {expandedId === backend.id ? "Less details" : "More details"}
              </button>

              {expandedId === backend.id && (
                <div className="mt-3 pt-3 border-t border-border space-y-3">
                  {backend.nativeGates.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Native Gate Set</p>
                      <div className="flex flex-wrap gap-1">
                        {backend.nativeGates.map((g) => (
                          <code key={g} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted border border-border">{g}</code>
                        ))}
                      </div>
                    </div>
                  )}
                  {backend.features.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Features</p>
                      <div className="flex flex-wrap gap-1">
                        {backend.features.map((f) => (
                          <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-muted-foreground">Max Shots:</span> <span className="font-medium">{backend.maxShots.toLocaleString()}</span></div>
                    <div><span className="text-muted-foreground">Technology:</span> <span className="font-medium capitalize">{backend.technology}</span></div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBackends.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <WifiOff className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No backends match your filters.</p>
        </div>
      )}
    </div>
  );
}

function MetricCell({ icon, label, value, highlight = false }: { icon: React.ReactNode; label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">{icon}<span className="text-[10px]">{label}</span></div>
      <p className={`text-sm font-semibold ${highlight ? "text-quantum" : ""}`}>{value}</p>
    </div>
  );
}

function ComparisonTable({ backends }: { backends: BackendInfo[] }) {
  if (backends.length < 2) return null;
  const rows: { label: string; render: (b: BackendInfo) => React.ReactNode }[] = [
    { label: "Provider", render: (b) => b.provider },
    { label: "Type", render: (b) => <Badge variant="outline" className="text-[10px]">{b.type === "hardware" ? "QPU" : "Simulator"}</Badge> },
    { label: "Technology", render: (b) => <span className="capitalize">{b.technology}</span> },
    { label: "Qubits", render: (b) => <span className="font-bold">{b.qubits}</span> },
    { label: "Fidelity", render: (b) => <span className={b.avgFidelity >= 0.99 ? "text-emerald-400 font-bold" : ""}>{(b.avgFidelity * 100).toFixed(1)}%</span> },
    { label: "Cost/Shot", render: (b) => b.costPerShot === 0 ? <span className="text-quantum font-bold">Free</span> : `$${b.costPerShot}` },
    { label: "Queue", render: (b) => `${b.queueDepth} jobs` },
    { label: "Avg Wait", render: (b) => b.avgQueueTimeSec === 0 ? "Instant" : `~${Math.round(b.avgQueueTimeSec)}s` },
    { label: "Connectivity", render: (b) => b.connectivity || "—" },
    { label: "Max Shots", render: (b) => b.maxShots.toLocaleString() },
    { label: "Status", render: (b) => <Badge variant={b.status === "online" ? "success" : b.status === "busy" ? "warning" : "secondary"}>{b.status}</Badge> },
    { label: "Native Gates", render: (b) => <span className="font-mono text-[10px]">{b.nativeGates.slice(0, 5).join(", ")}{b.nativeGates.length > 5 ? "..." : ""}</span> },
  ];
  return (
    <div className="mb-6 overflow-x-auto">
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Backend Comparison</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b border-border">
              <th className="text-left py-2 pr-4 text-xs text-muted-foreground font-medium w-28">Metric</th>
              {backends.map((b) => (<th key={b.id} className="text-left py-2 px-2 text-xs font-semibold">{b.name}</th>))}
            </tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label} className="border-b border-border/50">
                  <td className="py-2 pr-4 text-xs text-muted-foreground">{row.label}</td>
                  {backends.map((b) => (<td key={b.id} className="py-2 px-2 text-xs">{row.render(b)}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
