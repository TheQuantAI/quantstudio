"use client";

import dynamic from "next/dynamic";
import { useCircuitStore, useBackendStore } from "@/store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CIRCUIT_TEMPLATES } from "@/lib/templates";
import { QUANTSDK_COMPLETIONS, QUANTSDK_TYPE_DEFS } from "@/lib/quantsdk-types";
import {
  CircuitDiagramSVG,
  ResultHistogram,
  ProbabilityBars,
  StateSummary,
  ResultsExport,
} from "@/components/viz";
import {
  Play,
  RotateCcw,
  Download,
  Copy,
  FileCode2,
  ChevronDown,
  Server,
  Loader2,
  BarChart3,
  Terminal,
  Save,
  FolderOpen,
  Trash2,
  Check,
  PieChart,
  Info,
} from "lucide-react";
import { useCallback, useRef, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { runCircuit, saveCircuit, updateCircuit, listCircuits, deleteCircuit, type CircuitResponse } from "@/lib/api";

// Dynamically import Monaco to avoid SSR issues
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full bg-card">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading editor...</span>
      </div>
    </div>
  ),
});

// Right panel tab types
type RightPanelTab = "results" | "probabilities" | "circuit" | "stats";

export default function StudioPage() {
  const {
    code,
    circuitName,
    isExecuting,
    result,
    error,
    selectedBackend,
    circuitDiagram,
    setCode,
    setCircuitName,
    setExecuting,
    setResult,
    setError,
    setSelectedBackend,
    setCircuitDiagram,
    resetCircuit,
    loadTemplate,
  } = useCircuitStore();

  const { backends } = useBackendStore();
  const { data: session } = useSession();
  const editorRef = useRef<unknown>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBackendSelect, setShowBackendSelect] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("results");
  const [histogramMode, setHistogramMode] = useState<"counts" | "probabilities">("counts");

  // Save/Load state
  const [showMyCircuits, setShowMyCircuits] = useState(false);
  const [savedCircuits, setSavedCircuits] = useState<CircuitResponse[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingCircuits, setLoadingCircuits] = useState(false);

  const userId = session?.user?.id || "anonymous";
  const currentBackend = backends.find((b) => b.id === selectedBackend);

  // Load user's circuits when My Circuits dropdown opens
  const handleOpenMyCircuits = useCallback(async () => {
    if (showMyCircuits) {
      setShowMyCircuits(false);
      return;
    }
    setShowMyCircuits(true);
    setLoadingCircuits(true);
    try {
      const circuits = await listCircuits(userId);
      setSavedCircuits(circuits);
    } catch {
      setSavedCircuits([]);
    } finally {
      setLoadingCircuits(false);
    }
  }, [showMyCircuits, userId]);

  // Save current circuit
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const { circuitId } = useCircuitStore.getState();
      if (circuitId) {
        // Update existing
        await updateCircuit(circuitId, { name: circuitName, code });
      } else {
        // Create new
        const saved = await saveCircuit(circuitName, code, "", userId);
        useCircuitStore.getState().setCircuitId(saved.id);
      }
      setSaveSuccess(true);
      useCircuitStore.setState({ isDirty: false });
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch {
      setError("Failed to save circuit");
    } finally {
      setIsSaving(false);
    }
  }, [circuitName, code, userId, setError]);

  // Load a saved circuit
  const handleLoadCircuit = useCallback(
    (circuit: CircuitResponse) => {
      setCode(circuit.code);
      setCircuitName(circuit.name);
      useCircuitStore.getState().setCircuitId(circuit.id);
      useCircuitStore.setState({ isDirty: false });
      setResult(null);
      setError(null);
      setCircuitDiagram(null);
      setShowMyCircuits(false);
    },
    [setCode, setCircuitName, setResult, setError, setCircuitDiagram]
  );

  // Delete a saved circuit
  const handleDeleteCircuit = useCallback(
    async (e: React.MouseEvent, circuitId: string) => {
      e.stopPropagation();
      try {
        await deleteCircuit(circuitId);
        setSavedCircuits((prev) => prev.filter((c) => c.id !== circuitId));
        // If we deleted the active circuit, clear circuitId
        if (useCircuitStore.getState().circuitId === circuitId) {
          useCircuitStore.getState().setCircuitId(null);
        }
      } catch {
        // silently fail
      }
    },
    []
  );

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = () => {
      setShowTemplates(false);
      setShowBackendSelect(false);
      setShowMyCircuits(false);
    };
    const anyOpen = showTemplates || showBackendSelect || showMyCircuits;
    if (anyOpen) {
      // Delay to avoid closing on the button click itself
      const id = setTimeout(() => {
        document.addEventListener("click", handleClick, { once: true });
      }, 0);
      return () => {
        clearTimeout(id);
        document.removeEventListener("click", handleClick);
      };
    }
  }, [showTemplates, showBackendSelect, showMyCircuits]);

  // Configure Monaco editor
  const handleEditorDidMount = useCallback(
    (editor: unknown, monaco: unknown) => {
      editorRef.current = editor;

      const m = monaco as {
        languages: {
          typescript?: {
            pythonDefaults?: {
              addExtraLib: (content: string, filePath?: string) => void;
            };
          };
          registerCompletionItemProvider: (
            lang: string,
            provider: {
              provideCompletionItems: (
                model: unknown,
                position: unknown
              ) => {
                suggestions: Array<{
                  label: string;
                  kind: number;
                  insertText: string;
                  detail: string;
                  insertTextRules: number;
                }>;
              };
            }
          ) => void;
          CompletionItemKind: Record<string, number>;
          CompletionItemInsertTextRule: Record<string, number>;
        };
        editor: {
          setModelMarkers: unknown;
        };
      };

      // Register QuantSDK type definitions for richer IntelliSense
      // (Type defs provide hover info and parameter hints)
      try {
        if (m.languages.typescript?.pythonDefaults) {
          m.languages.typescript.pythonDefaults.addExtraLib(
            QUANTSDK_TYPE_DEFS,
            "quantsdk.d.ts"
          );
        }
      } catch {
        // Python mode doesn't support addExtraLib natively — this is
        // best-effort. The completion provider below is the primary mechanism.
      }

      // Register QuantSDK autocomplete provider
      m.languages.registerCompletionItemProvider("python", {
        provideCompletionItems: (model: unknown, position: unknown) => {
          const suggestions = QUANTSDK_COMPLETIONS.map((item) => ({
            label: item.label,
            kind:
              item.kind === "Class"
                ? m.languages.CompletionItemKind.Class
                : item.kind === "Function"
                  ? m.languages.CompletionItemKind.Function
                  : item.kind === "Property"
                    ? m.languages.CompletionItemKind.Property
                    : m.languages.CompletionItemKind.Method,
            insertText: item.insertText,
            detail: item.detail,
            documentation: item.detail,
            insertTextRules:
              m.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          }));
          void model;
          void position;
          return { suggestions };
        },
      });
    },
    []
  );

  // Execute circuit via FastAPI backend
  const handleRun = useCallback(async () => {
    setExecuting(true);
    setError(null);

    try {
      const data = await runCircuit(code, 1024, selectedBackend);

      setResult({
        counts: data.counts,
        probabilities: data.probabilities,
        mostLikely: data.most_likely,
        shots: data.shots,
        backend: data.backend,
        executionTime: data.execution_time,
        jobId: data.job_id,
        metadata: {
          numQubits: data.metadata?.num_qubits ?? 0,
          circuitDepth: data.metadata?.circuit_depth ?? 0,
          gateCount: data.metadata?.gate_count ?? 0,
          simulator: data.metadata?.simulator,
          seed: data.metadata?.seed,
        },
      });

      if (data.circuit_diagram) {
        setCircuitDiagram(data.circuit_diagram);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Execution failed. Please check your circuit code."
      );
    } finally {
      setExecuting(false);
    }
  }, [code, selectedBackend, setExecuting, setResult, setError, setCircuitDiagram]);

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(code);
  }, [code]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: "text/python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${circuitName.replace(/\s+/g, "_").toLowerCase()}.py`;
    a.click();
    URL.revokeObjectURL(url);
  }, [code, circuitName]);

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-card">
        {/* Circuit name */}
        <input
          type="text"
          value={circuitName}
          onChange={(e) => setCircuitName(e.target.value)}
          className="bg-transparent border-none text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring rounded px-2 py-1 w-48"
        />

        {/* Templates dropdown */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setShowTemplates(!showTemplates)}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            Templates
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showTemplates && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-card border border-border rounded-lg shadow-lg z-50 py-1 max-h-80 overflow-y-auto">
              {CIRCUIT_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  className="w-full text-left px-3 py-2 hover:bg-accent transition-colors"
                  onClick={() => {
                    loadTemplate(template);
                    setShowTemplates(false);
                  }}
                >
                  <div className="text-sm font-medium">{template.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {template.description}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Backend selector */}
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowBackendSelect(!showBackendSelect)}
          >
            <Server className="h-3.5 w-3.5" />
            {currentBackend?.name || "Select Backend"}
            <Badge
              variant={
                currentBackend?.status === "online" ? "success" : "warning"
              }
              className="ml-1 text-[10px] px-1.5"
            >
              {currentBackend?.status}
            </Badge>
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showBackendSelect && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-card border border-border rounded-lg shadow-lg z-50 py-1">
              {backends.map((backend) => (
                <button
                  key={backend.id}
                  className={`w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between ${
                    backend.id === selectedBackend ? "bg-accent" : ""
                  }`}
                  onClick={() => {
                    setSelectedBackend(backend.id);
                    setShowBackendSelect(false);
                  }}
                >
                  <div>
                    <div className="text-sm font-medium">{backend.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {backend.provider} · {backend.qubits} qubits
                    </div>
                  </div>
                  <Badge
                    variant={
                      backend.status === "online" ? "success" : "warning"
                    }
                    className="text-[10px]"
                  >
                    {backend.status}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Save / My Circuits / Action buttons */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          disabled={isSaving}
          title="Save circuit"
        >
          {isSaving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : saveSuccess ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <Save className="h-3.5 w-3.5" />
          )}
          <span className="hidden sm:inline">{saveSuccess ? "Saved!" : "Save"}</span>
        </Button>

        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={handleOpenMyCircuits}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">My Circuits</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
          {showMyCircuits && (
            <div
              className="absolute top-full right-0 mt-1 w-80 bg-card border border-border rounded-lg shadow-lg z-50 py-1"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-3 py-2 border-b border-border">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Saved Circuits
                  {session?.user ? "" : " (sign in to persist)"}
                </p>
              </div>
              {loadingCircuits ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : savedCircuits.length === 0 ? (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No saved circuits yet.
                  <br />
                  Click <strong>Save</strong> to store your work.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto">
                  {savedCircuits.map((circuit) => (
                    <button
                      key={circuit.id}
                      className="w-full text-left px-3 py-2 hover:bg-accent transition-colors flex items-center justify-between group"
                      onClick={() => handleLoadCircuit(circuit)}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">
                          {circuit.name}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(circuit.updated_at).toLocaleDateString()} ·{" "}
                          {circuit.code.split("\n").length} lines
                        </div>
                      </div>
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        onClick={(e) => handleDeleteCircuit(e, circuit.id)}
                        title="Delete circuit"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="w-px h-6 bg-border mx-1" />

        <Button variant="ghost" size="icon" onClick={handleCopyCode} title="Copy code">
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDownload} title="Download .py">
          <Download className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={resetCircuit} title="New circuit">
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="quantum"
          size="sm"
          className="gap-1.5 ml-2"
          onClick={handleRun}
          disabled={isExecuting}
        >
          {isExecuting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Run Circuit
            </>
          )}
        </Button>
      </div>

      {/* Main content: Editor + Results */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor pane */}
        <div className="flex-1 min-w-0">
          <MonacoEditor
            height="100%"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(value) => setCode(value || "")}
            onMount={handleEditorDidMount}
            options={{
              fontSize: 14,
              fontFamily: "var(--font-geist-mono), monospace",
              fontLigatures: true,
              minimap: { enabled: false },
              padding: { top: 16 },
              scrollBeyondLastLine: false,
              wordWrap: "on",
              tabSize: 4,
              insertSpaces: true,
              automaticLayout: true,
              suggestOnTriggerCharacters: true,
              quickSuggestions: true,
              lineNumbers: "on",
              renderLineHighlight: "all",
              bracketPairColorization: { enabled: true },
            }}
          />
        </div>

        {/* Right panel with tabs: Results / Probabilities / Circuit / Stats */}
        <div className="w-[420px] border-l border-border bg-card overflow-y-auto flex flex-col">
          {/* Tab bar */}
          <div className="flex border-b border-border">
            {(
              [
                { id: "results" as RightPanelTab, label: "Histogram", icon: <BarChart3 className="h-3.5 w-3.5" /> },
                { id: "probabilities" as RightPanelTab, label: "Probabilities", icon: <PieChart className="h-3.5 w-3.5" /> },
                { id: "circuit" as RightPanelTab, label: "Circuit", icon: <Terminal className="h-3.5 w-3.5" /> },
                { id: "stats" as RightPanelTab, label: "Stats", icon: <Info className="h-3.5 w-3.5" /> },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                className={`flex-1 flex items-center justify-center gap-1 px-1 py-2 text-[11px] font-medium transition-colors ${
                  rightPanelTab === tab.id
                    ? "text-quantum border-b-2 border-quantum"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setRightPanelTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">

            {/* ── Histogram Tab ── */}
            {rightPanelTab === "results" && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Measurement Results
                  </h3>
                  {result && (
                    <div className="flex gap-1">
                      <button
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                          histogramMode === "counts"
                            ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setHistogramMode("counts")}
                      >
                        Counts
                      </button>
                      <button
                        className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                          histogramMode === "probabilities"
                            ? "bg-purple-500/20 border-purple-500/40 text-purple-400"
                            : "border-border text-muted-foreground hover:text-foreground"
                        }`}
                        onClick={() => setHistogramMode("probabilities")}
                      >
                        Probability
                      </button>
                    </div>
                  )}
                </div>

                {!result && !error && !isExecuting && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Play className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                      Click <strong>Run Circuit</strong> to execute
                    </p>
                    <p className="text-xs mt-1">
                      Results will appear here
                    </p>
                  </div>
                )}

                {isExecuting && (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 text-quantum animate-spin" />
                    <p className="text-sm text-muted-foreground">
                      Executing on {currentBackend?.name}...
                    </p>
                  </div>
                )}

                {error && (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {result && (
                  <div className="space-y-4">
                    {/* Summary row */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="rounded-lg border border-border p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Shots</p>
                        <p className="text-sm font-bold">{result.shots.toLocaleString()}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Time</p>
                        <p className="text-sm font-bold">{result.executionTime.toFixed(2)}s</p>
                      </div>
                      <div className="rounded-lg border border-border p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">States</p>
                        <p className="text-sm font-bold">{Object.keys(result.counts).length}</p>
                      </div>
                      <div className="rounded-lg border border-border p-2 text-center">
                        <p className="text-[10px] text-muted-foreground">Top</p>
                        <p className="text-sm font-bold font-mono text-quantum">|{result.mostLikely}⟩</p>
                      </div>
                    </div>

                    {/* Histogram */}
                    <ResultHistogram
                      counts={result.counts}
                      probabilities={result.probabilities}
                      shots={result.shots}
                      mode={histogramMode}
                    />

                    {/* Export buttons */}
                    <ResultsExport
                      result={result}
                      circuitDiagram={circuitDiagram}
                      circuitName={circuitName}
                    />

                    {/* Job info */}
                    <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                      Job: <code className="font-mono">{result.jobId}</code>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Probabilities Tab ── */}
            {rightPanelTab === "probabilities" && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Probability Distribution
                </h3>

                {!result && !isExecuting && (
                  <div className="text-center py-12 text-muted-foreground">
                    <PieChart className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Run a circuit to see probabilities</p>
                  </div>
                )}

                {isExecuting && (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 text-quantum animate-spin" />
                    <p className="text-sm text-muted-foreground">Executing...</p>
                  </div>
                )}

                {result && (
                  <ProbabilityBars probabilities={result.probabilities} />
                )}
              </div>
            )}

            {/* ── Circuit Diagram Tab ── */}
            {rightPanelTab === "circuit" && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Circuit Diagram
                </h3>
                {circuitDiagram ? (
                  <div className="space-y-4">
                    {/* SVG rendering */}
                    <div className="rounded-lg border border-border bg-muted/30 p-3">
                      <CircuitDiagramSVG diagramText={circuitDiagram} />
                    </div>

                    {/* Text fallback (collapsible) */}
                    <details className="group">
                      <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground transition-colors flex items-center gap-1">
                        <ChevronDown className="h-3 w-3 transition-transform group-open:rotate-180" />
                        Text representation
                      </summary>
                      <div className="mt-2 rounded-lg border border-border bg-muted/50 p-3 overflow-x-auto">
                        <pre className="text-xs font-mono whitespace-pre text-foreground leading-5">
                          {circuitDiagram}
                        </pre>
                      </div>
                    </details>

                    {/* Circuit metrics from metadata */}
                    {result?.metadata && (
                      <div className="grid grid-cols-3 gap-2 pt-2">
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Qubits</p>
                          <p className="text-sm font-bold">{result.metadata.numQubits}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Depth</p>
                          <p className="text-sm font-bold">{result.metadata.circuitDepth}</p>
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] text-muted-foreground">Gates</p>
                          <p className="text-sm font-bold">{result.metadata.gateCount}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Terminal className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">
                      Run your circuit to see the diagram
                    </p>
                    <p className="text-xs mt-1">
                      SVG rendering of <code className="font-mono">circuit.draw()</code>
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* ── Stats Tab ── */}
            {rightPanelTab === "stats" && (
              <div>
                <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                  Statistical Analysis
                </h3>

                {!result && !isExecuting && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Info className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">Run a circuit to see statistics</p>
                  </div>
                )}

                {isExecuting && (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 text-quantum animate-spin" />
                    <p className="text-sm text-muted-foreground">Executing...</p>
                  </div>
                )}

                {result && (
                  <StateSummary
                    counts={result.counts}
                    probabilities={result.probabilities}
                    shots={result.shots}
                    executionTime={result.executionTime}
                    backend={
                      backends.find((b) => b.id === result.backend)?.name ||
                      result.backend
                    }
                    mostLikely={result.mostLikely}
                    metadata={result.metadata}
                  />
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
