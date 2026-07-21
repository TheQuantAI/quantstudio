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
import type { PythonTerminalHandle } from "@/components/python-terminal";
import {
  Play,
  RotateCcw,
  Download,
  Copy,
  FileCode2,
  ChevronDown,
  ChevronUp,
  PanelLeft,
  Server,
  Loader2,
  BarChart3,
  Terminal,
  Save,
  Check,
  PieChart,
  Info,
} from "lucide-react";
import { useCallback, useRef, useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { runCircuit, submitCircuitToQPU, pollQPUResult, saveFile } from "@/lib/api";
import { WorkspaceExplorer } from "@/components/workspace/explorer";
import { EditorTabs } from "@/components/workspace/editor-tabs";
import { isQPUBackend } from "@/lib/cloud-api";
import { AuthGateModal } from "@/components/auth-gate-modal";
import { track } from "@/lib/analytics";
import { stashPendingCircuit, popPendingCircuit } from "@/lib/pending-circuit";
import { supabase } from "@/lib/supabase";

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

// Dynamically import Python terminal
const PythonTerminal = dynamic(() => import("@/components/python-terminal"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full" style={{ background: "#0d1117" }}>
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Loading terminal...</span>
      </div>
    </div>
  ),
});

// Right panel tab types
type RightPanelTab = "results" | "probabilities" | "circuit" | "stats";

// Bottom panel tab types
type BottomPanelTab = "terminal" | "output";

// Console log entry
interface ConsoleEntry {
  id: number;
  timestamp: string;
  type: "info" | "success" | "error" | "warn";
  message: string;
}

export default function StudioPage() {
  const {
    code,
    circuitName,
    isDirty,
    forkedFrom,
    isExecuting,
    result,
    error,
    selectedBackend,
    circuitDiagram,
    activeFileType,
    openTabs,
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

  const { backends, fetchBackends, ibmLoading } = useBackendStore();
  const { user } = useAuth();
  const [gateOpen, setGateOpen] = useState(false);
  // STUDIO-016: a logged-in but unconfirmed user may browse + use the browser
  // simulator, but cloud save/run is blocked until they confirm their email.
  const blockedUnconfirmed = !!user && !user.emailConfirmed;
  const [confirmResendMsg, setConfirmResendMsg] = useState<string | null>(null);
  const resendConfirmation = useCallback(async () => {
    if (!user?.email) return;
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: user.email });
    setConfirmResendMsg(resendError ? resendError.message : "Confirmation email sent.");
  }, [user]);

  // STUDIO-014: gate anonymous users on their first edit (isDirty flips true
  // after loadTemplate/reset sets it false). Fires the STUDIO-015 edit_attempt
  // funnel event. Authenticated users are exempt.
  useEffect(() => {
    if (isDirty && !user) {
      setGateOpen(true);
      track("edit_attempt", { template: forkedFrom?.name });
    }
  }, [isDirty, user, forkedFrom]);

  // Stash the in-progress edit before any Supabase redirect so it survives login.
  const stashNow = useCallback(() => {
    stashPendingCircuit({
      code: useCircuitStore.getState().code,
      name: useCircuitStore.getState().circuitName,
      forkedFrom: useCircuitStore.getState().forkedFrom,
    });
  }, []);

  // On return authenticated, restore the stashed edit and save it as a NEW
  // circuit (never touching the source template), recording provenance.
  useEffect(() => {
    if (!user) return;
    const pending = popPendingCircuit();
    if (!pending) return;
    setGateOpen(false);
    setCode(pending.code);
    setCircuitName(pending.name);
    // STUDIO-016: don't cloud-save for an unconfirmed session — keep the work in
    // the editor; the confirm-email banner prompts them, and Save works after.
    if (!user.emailConfirmed) {
      addLog("info", "Confirm your email to save this circuit to your account.");
      return;
    }
    const metadata = pending.forkedFrom
      ? { forked_from: pending.forkedFrom.id, forked_from_name: pending.forkedFrom.name }
      : undefined;
    const fileName = pending.name.toLowerCase().endsWith(".py")
      ? pending.name
      : `${pending.name}.py`;
    saveFile({ fileId: null, name: fileName, fileType: "py", content: pending.code, metadata })
      .then((saved) => {
        useCircuitStore.getState().markActiveSaved(saved);
        void useCircuitStore.getState().loadTree();
        addLog("success", `Saved "${saved.name}" to your workspace.`);
      })
      .catch(() => setError("Could not save your circuit — it's still in the editor."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Fetch backends from the cloud API on mount
  useEffect(() => {
    fetchBackends();
  }, [fetchBackends]);

  // API-017 (AC6): warn before leaving if any open tab has unsaved changes.
  const hasUnsavedTabs = openTabs.some((t) => t.isDirty);
  useEffect(() => {
    if (!hasUnsavedTabs) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [hasUnsavedTabs]);

  // Merge the user's own IBM devices once authenticated (API-016)
  const { fetchIBMBackends } = useBackendStore();
  useEffect(() => {
    if (user) fetchIBMBackends();
  }, [user, fetchIBMBackends]);
  const editorRef = useRef<unknown>(null);
  const terminalRef = useRef<PythonTerminalHandle>(null);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showBackendSelect, setShowBackendSelect] = useState(false);
  const [rightPanelTab, setRightPanelTab] = useState<RightPanelTab>("results");
  const [histogramMode, setHistogramMode] = useState<"counts" | "probabilities">("counts");
  const [terminalOpen, setTerminalOpen] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [bottomTab, setBottomTab] = useState<BottomPanelTab>("terminal");
  // Submit-only QPU runs don't use `isExecuting` (that drives the results panel);
  // this tracks the brief compile+submit so the Run button shows a spinner.
  const [submittingQPU, setSubmittingQPU] = useState(false);
  // A QPU job is submitted and we're waiting on IBM. Keeps the Run button
  // disabled (so users don't burn their monthly QPU quota with repeat clicks)
  // and drives the "queued at IBM" state in the results panel.
  const [qpuPending, setQpuPending] = useState<null | { jobId: string; backend: string }>(null);

  // Console output log
  const [consoleLog, setConsoleLog] = useState<ConsoleEntry[]>([]);
  const consoleEndRef = useRef<HTMLDivElement>(null);
  const logIdRef = useRef(0);

  const addLog = useCallback((type: ConsoleEntry["type"], message: string) => {
    const entry: ConsoleEntry = {
      id: ++logIdRef.current,
      timestamp: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      type,
      message,
    };
    setConsoleLog((prev) => [...prev, entry]);
  }, []);

  // Auto-scroll console to bottom
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [consoleLog]);

  // Save/Load state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Explorer selection: where a new file / Save lands (null = root).
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  // Collapse the workspace rail to give the editor more room.
  const [explorerCollapsed, setExplorerCollapsed] = useState(false);

  const currentBackend = backends.find((b) => b.id === selectedBackend);

  // Save the active tab into the workspace (API-017). New files land in the
  // explorer-selected folder (or the active tab's folder / root); existing files
  // update in place. The name carries a .py extension for runnable circuits.
  const handleSave = useCallback(async () => {
    // STUDIO-014: anonymous users must sign in before saving.
    if (!user) {
      setGateOpen(true);
      return;
    }
    // STUDIO-016: unconfirmed users can't persist to their account yet.
    if (blockedUnconfirmed) {
      setError("Confirm your email to save to your workspace.");
      return;
    }
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const store = useCircuitStore.getState();
      const active = store.openTabs.find((t) => t.key === store.activeKey);
      const fileType = active?.fileType ?? "py";
      let name = circuitName.trim() || "Untitled";
      if (!name.toLowerCase().endsWith(`.${fileType}`)) name = `${name}.${fileType}`;
      const defaultFolder = store.tree.folders.find((f) => f.is_default)?.id ?? null;
      const targetFolder =
        active?.fileId != null
          ? (active.folderId ?? null) // existing file: keep its folder
          : (active?.folderId ?? selectedFolderId ?? defaultFolder);
      const fork = store.forkedFrom;
      const metadata =
        active?.fileId == null && fork
          ? { forked_from: fork.id, forked_from_name: fork.name }
          : undefined;
      const saved = await saveFile({
        fileId: active?.fileId ?? null,
        name,
        fileType,
        content: code,
        folderId: targetFolder,
        metadata,
      });
      useCircuitStore.getState().markActiveSaved(saved);
      await useCircuitStore.getState().loadTree();
      void useCircuitStore.getState().loadUsage();
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save file");
    } finally {
      setIsSaving(false);
    }
  }, [circuitName, code, user, blockedUnconfirmed, selectedFolderId, setError]);

  // Ctrl/Cmd+S saves the active tab instead of triggering the browser's
  // "Save Page As" dialog. Global (not Monaco-only) so it works regardless of
  // which part of the Studio UI has focus (explorer, tabs, editor, toolbar).
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== "s") return;
      e.preventDefault();
      if (e.repeat) return;
      void handleSave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleSave]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = () => {
      setShowTemplates(false);
      setShowBackendSelect(false);
    };
    const anyOpen = showTemplates || showBackendSelect;
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
  }, [showTemplates, showBackendSelect]);

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
    // STUDIO-016: block cloud runs for unconfirmed users; browser sim stays open.
    if (blockedUnconfirmed && selectedBackend !== "browser_sim") {
      setBottomTab("terminal");
      setTerminalOpen(true);
      addLog("error", "Confirm your email to run on the cloud. You can still use the browser simulator.");
      return;
    }
    // Real hardware (API-016): submit-only — IBM queues take minutes to hours,
    // so we never block the tab waiting. Track progress on Dashboard → Jobs.
    if (isQPUBackend(selectedBackend)) {
      setError(null);
      setResult(null);
      setRightPanelTab("results");
      setTerminalOpen(true);
      // Feedback for QPU submission is console output, so show the Console tab —
      // not the empty Pyodide terminal, which made runs look like nothing
      // happened.
      setBottomTab("output");
      setSubmittingQPU(true);
      addLog("info", `Submitting "${circuitName}" to real hardware (${selectedBackend})...`);

      let jobId: string;
      try {
        const job = await submitCircuitToQPU(code, 1024, selectedBackend);
        jobId = job.job_id;
        setQpuPending({ jobId, backend: selectedBackend });
        addLog("success", `Submitted to IBM Quantum — job ${jobId}.`);
        addLog("info", "Queued at IBM — real-hardware queues range from a minute to a few hours.");
        addLog("info", "You can keep working; results appear here and on the Dashboard when ready.");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "QPU submission failed.";
        addLog("error", msg);
        setError(msg);
        return;
      } finally {
        setSubmittingQPU(false);
      }

      // Poll in the background until IBM finishes, then render the result just
      // like a simulator run. The tab stays usable; the Run button stays
      // disabled (qpuPending) so repeat clicks don't burn the monthly quota.
      try {
        const data = await pollQPUResult(jobId, code, (s) => addLog("info", `Job status: ${s}…`));
        addLog("success", `Result received from ${data.backend} in ${data.execution_time.toFixed(1)}s.`);
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
          },
        });
        if (data.circuit_diagram) setCircuitDiagram(data.circuit_diagram);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Could not fetch the QPU result.";
        // A timeout here is not a failure — the job is still queued at IBM.
        addLog("info", `${msg} The job is tracked on the Dashboard and its result is saved automatically.`);
      } finally {
        setQpuPending(null);
      }
      return;
    }

    setExecuting(true);
    setError(null);
    setRightPanelTab("results");
    setTerminalOpen(true);
    setBottomTab("terminal");
    addLog("info", `Executing circuit "${circuitName}" on ${selectedBackend}...`);
    addLog("info", `Shots: 1024`);

    // Also run in the Python terminal if open
    if (terminalRef.current && terminalOpen) {
      terminalRef.current.runCode(code);
    }

    try {
      const data = await runCircuit(code, 1024, selectedBackend);

      addLog("success", `Execution complete in ${data.execution_time.toFixed(4)}s`);
      addLog("info", `Backend: ${data.backend}`);
      addLog("info", `Qubits: ${data.metadata?.num_qubits ?? "?"} | Depth: ${data.metadata?.circuit_depth ?? "?"} | Gates: ${data.metadata?.gate_count ?? "?"}`);
      addLog("info", `Most likely state: |${data.most_likely}⟩`);

      // Log top measurement results
      const sorted = Object.entries(data.counts).sort((a, b) => b[1] - a[1]);
      const topN = sorted.slice(0, 8);
      for (const [state, count] of topN) {
        const pct = ((count / data.shots) * 100).toFixed(1);
        addLog("info", `  |${state}⟩ : ${count}  (${pct}%)`);
      }
      if (sorted.length > 8) {
        addLog("info", `  ... and ${sorted.length - 8} more states`);
      }
      addLog("success", `Job ID: ${data.job_id}`);

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
      const msg = err instanceof Error
        ? err.message
        : "Execution failed. Please check your circuit code.";
      addLog("error", msg);
      setError(msg);
    } finally {
      setExecuting(false);
    }
  }, [code, circuitName, selectedBackend, blockedUnconfirmed, setExecuting, setResult, setError, setCircuitDiagram, addLog, terminalOpen, setBottomTab, setTerminalOpen]);

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
      <AuthGateModal
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onBeforeAuth={stashNow}
      />
      {blockedUnconfirmed && (
        <div className="flex flex-wrap items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm">
          <span>⚠️ Confirm your email to save &amp; run in the cloud. The browser simulator still works.</span>
          <button onClick={resendConfirmation} className="font-medium text-quantum hover:underline">
            Resend email
          </button>
          {confirmResendMsg && <span className="text-muted-foreground">{confirmResendMsg}</span>}
        </div>
      )}
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
              {[
                { label: "Simulators", items: backends.filter((b) => !isQPUBackend(b.id)) },
                { label: "Real hardware — your IBM account", items: backends.filter((b) => isQPUBackend(b.id)) },
              ].map((group) =>
                group.items.length === 0 ? null : (
                  <div key={group.label}>
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </div>
                    {group.items.map((backend) => (
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
                          {isQPUBackend(backend.id) && backend.status === "online" ? "QPU" : backend.status}
                        </Badge>
                      </button>
                    ))}
                  </div>
                )
              )}
              {/* Loading the user's IBM devices (a few seconds — hits IBM cloud) */}
              {ibmLoading && !backends.some((b) => isQPUBackend(b.id)) && (
                <div className="flex items-center gap-2 border-t border-border mt-1 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Loading your IBM devices…
                </div>
              )}
              {/* Nudge users who haven't connected real hardware yet (API-016) */}
              {!ibmLoading && !backends.some((b) => isQPUBackend(b.id)) && (
                <a
                  href="/connect"
                  className="block border-t border-border mt-1 px-3 py-2 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  <span className="font-medium text-quantum">
                    Run on real hardware →
                  </span>
                  <br />
                  Connect your IBM Quantum account to add real QPUs here.
                </a>
              )}
            </div>
          )}
        </div>

        {/* Save (persists the active tab into the workspace explorer) */}
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleSave}
          disabled={isSaving}
          title="Save to workspace"
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

        <div className="w-px h-6 bg-border mx-1" />

        <Button variant="ghost" size="icon" onClick={handleCopyCode} title="Copy code">
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleDownload} title="Download .py">
          <Download className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (user ? resetCircuit() : setGateOpen(true))}
          title="New circuit"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          variant="quantum"
          size="sm"
          className="gap-1.5 ml-2"
          onClick={handleRun}
          disabled={
            isExecuting || submittingQPU || qpuPending !== null || activeFileType !== "py"
          }
          title={activeFileType !== "py" ? "Only .py files can be run" : "Run circuit"}
        >
          {isExecuting || submittingQPU || qpuPending ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {submittingQPU ? "Submitting..." : qpuPending ? "Queued at IBM..." : "Running..."}
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" />
              Run Circuit
            </>
          )}
        </Button>
      </div>

      {/* Main content: Explorer + Editor + Results */}
      <div className="flex flex-1 overflow-hidden">
        {/* Workspace explorer (authenticated only — API-017); collapsible for more editor room */}
        {user && !blockedUnconfirmed && (
          explorerCollapsed ? (
            <div className="flex w-8 shrink-0 flex-col items-center border-r border-border bg-card py-2">
              <button
                onClick={() => setExplorerCollapsed(false)}
                title="Show workspace"
                aria-label="Show workspace"
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <PanelLeft className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <WorkspaceExplorer
              selectedFolderId={selectedFolderId}
              onSelectFolder={setSelectedFolderId}
              onCollapse={() => setExplorerCollapsed(true)}
            />
          )
        )}
        {/* Editor + Terminal pane */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Open-file tabs (authenticated only) */}
          {user && !blockedUnconfirmed && <EditorTabs />}
          {/* Code editor */}
          <div className="flex-1 min-h-0">
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

          {/* Bottom panel: tab bar + content */}
          <div
            className="border-t border-border flex items-center px-3 py-1 bg-[#161b22] select-none shrink-0 gap-1"
          >
            <button
              className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                bottomTab === "terminal"
                  ? "text-quantum bg-quantum/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setBottomTab("terminal"); setTerminalOpen(true); }}
            >
              <Terminal className="h-3 w-3" />
              Terminal
            </button>
            <button
              className={`flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded transition-colors ${
                bottomTab === "output"
                  ? "text-quantum bg-quantum/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => { setBottomTab("output"); setTerminalOpen(true); }}
            >
              <BarChart3 className="h-3 w-3" />
              Output
            </button>
            <span className="text-[10px] text-muted-foreground/50 ml-1">
              {bottomTab === "terminal" ? "Pyodide" : "Console"}
            </span>
            <div className="flex-1" />
            <button
              className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              onClick={() => setTerminalOpen((v) => !v)}
            >
              {terminalOpen ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
          {terminalOpen && (
            <div
              style={{ height: terminalHeight }}
              className="shrink-0 relative"
            >
              {/* Resize handle */}
              <div
                className="absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-10 hover:bg-quantum/30"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startY = e.clientY;
                  const startH = terminalHeight;
                  const onMove = (ev: MouseEvent) => {
                    const delta = startY - ev.clientY;
                    setTerminalHeight(Math.max(100, Math.min(500, startH + delta)));
                  };
                  const onUp = () => {
                    document.removeEventListener("mousemove", onMove);
                    document.removeEventListener("mouseup", onUp);
                  };
                  document.addEventListener("mousemove", onMove);
                  document.addEventListener("mouseup", onUp);
                }}
              />
              {/* Terminal content */}
              <div className={`h-full ${bottomTab === "terminal" ? "" : "hidden"}`}>
                <PythonTerminal ref={terminalRef} className="h-full" />
              </div>
              {/* Output console content */}
              <div className={`h-full overflow-y-auto p-3 font-mono text-xs ${bottomTab === "output" ? "" : "hidden"}`} style={{ background: "#0d1117" }}>
                {consoleLog.length === 0 ? (
                  <div className="text-muted-foreground text-center py-8">
                    <Terminal className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    <p>Run a circuit to see output here</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-end mb-1">
                      <button
                        className="text-[10px] text-muted-foreground hover:text-foreground px-2 py-0.5 rounded border border-border/50 transition-colors"
                        onClick={() => { setConsoleLog([]); logIdRef.current = 0; }}
                      >
                        Clear
                      </button>
                    </div>
                    {consoleLog.map((entry) => (
                      <div key={entry.id} className="flex gap-2 leading-5">
                        <span className="text-muted-foreground/60 select-none shrink-0">
                          [{entry.timestamp}]
                        </span>
                        <span
                          className={
                            entry.type === "error"
                              ? "text-red-400"
                              : entry.type === "success"
                              ? "text-green-400"
                              : entry.type === "warn"
                              ? "text-yellow-400"
                              // This panel's background is a fixed dark (#0d1117)
                              // regardless of site theme, so "info" needs a fixed
                              // light color too — text-foreground is theme-aware
                              // and turns near-invisible in light mode.
                              : "text-gray-300"
                          }
                        >
                          {entry.message}
                        </span>
                      </div>
                    ))}
                    <div ref={consoleEndRef} />
                  </>
                )}
              </div>
            </div>
          )}
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

                {!result && !error && !isExecuting && !qpuPending && (
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

                {qpuPending && !result && (
                  <div className="text-center py-12">
                    <Loader2 className="h-12 w-12 mx-auto mb-3 text-quantum animate-spin" />
                    <p className="text-sm font-medium">
                      Queued on {qpuPending.backend}
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground max-w-xs mx-auto">
                      Waiting for real hardware — this can take from a minute to a
                      few hours. Results appear here automatically, and are saved
                      to your Dashboard either way.
                    </p>
                    <code className="text-[10px] font-mono text-muted-foreground mt-2 inline-block">
                      job {qpuPending.jobId.slice(0, 8)}
                    </code>
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
