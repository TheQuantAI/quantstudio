import { create } from "zustand";
import {
  fetchWorkspaceTree,
  openFile as apiOpenFile,
  type CloudFolder,
  type CloudFile,
  type FileType,
} from "@/lib/api";

// ============================================================
// Circuit Store — manages editor state and circuit execution
// ============================================================

// Workspace (API-017): an open editor tab. The ACTIVE tab is mirrored onto the
// legacy single-circuit fields (code/circuitName/circuitId/isDirty) so Run, Save,
// and the STUDIO-014 anon-gate keep working unchanged. `isDirty` lives on the tab;
// the mirror is a projection — never set the mirror's isDirty directly.
export interface OpenTab {
  key: string; // stable internal id (dedupe is by fileId, not key)
  fileId: string | null; // null = unsaved scratch tab
  name: string;
  fileType: FileType;
  content: string;
  folderId: string | null;
  isDirty: boolean;
}

export interface WorkspaceTreeState {
  folders: CloudFolder[];
  files: CloudFile[];
}

let _tabCounter = 0;
const nextTabKey = () => `t-${++_tabCounter}-${Date.now().toString(36)}`;

export interface CircuitTemplate {
  id: string;
  name: string;
  description: string;
  code: string;
  category: "entanglement" | "algorithm" | "variational" | "transform" | "protocol" | "qml" | "utility";
}

export interface CircuitMetadata {
  numQubits: number;
  circuitDepth: number;
  gateCount: number;
  simulator?: string;
  seed?: number | null;
}

export interface ExecutionResult {
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  mostLikely: string;
  shots: number;
  backend: string;
  executionTime: number;
  jobId: string;
  metadata: CircuitMetadata;
}

export interface BackendInfo {
  id: string;
  name: string;
  provider: string;
  type: "simulator" | "hardware";
  qubits: number;
  status: "online" | "offline" | "maintenance" | "busy";
  queueDepth: number;
  avgFidelity: number;
  costPerShot: number;
  description: string;
  technology: string;
  nativeGates: string[];
  connectivity: string;
  maxShots: number;
  avgQueueTimeSec: number;
  region: string;
  features: string[];
}

interface CircuitState {
  // Editor
  code: string;
  circuitName: string;
  circuitId: string | null;
  isDirty: boolean;
  /** Template this circuit was opened from (STUDIO-014 provenance), if any. */
  forkedFrom: { id: string; name: string } | null;

  // Execution
  isExecuting: boolean;
  result: ExecutionResult | null;
  error: string | null;
  selectedBackend: string;

  // Circuit visualization
  circuitDiagram: string | null;

  // Workspace (API-017)
  tree: WorkspaceTreeState;
  treeLoading: boolean;
  openTabs: OpenTab[];
  activeKey: string | null;
  /** file_type of the active tab; only "py" enables Run. */
  activeFileType: FileType;

  // Actions
  setCode: (code: string) => void;
  setCircuitName: (name: string) => void;
  setCircuitId: (id: string | null) => void;
  setExecuting: (executing: boolean) => void;
  setResult: (result: ExecutionResult | null) => void;
  setError: (error: string | null) => void;
  setSelectedBackend: (backend: string) => void;
  setCircuitDiagram: (diagram: string | null) => void;
  resetCircuit: () => void;
  loadTemplate: (template: CircuitTemplate) => void;

  // Workspace actions (API-017)
  loadTree: () => Promise<void>;
  openFileTab: (fileId: string) => Promise<void>;
  openNewTab: (fileType: FileType, name: string, content?: string) => void;
  setActiveTab: (key: string) => void;
  closeTab: (key: string) => void;
  /** After a successful save: bind the active tab to its file id and clear dirty. */
  markActiveSaved: (file: { id: string; name: string; folder_id: string | null }) => void;
}

const DEFAULT_CODE = `import quantsdk as qs

# Create a Bell State circuit
circuit = qs.Circuit(2, name="bell_state")
circuit.h(0)
circuit.cx(0, 1)
circuit.measure_all()

# Run on simulator
result = qs.run(circuit, shots=1000)
print(result.counts)
print(result.probabilities)
`;

// Always keep one active tab so Save/Run have somewhere to live.
const SCRATCH_TAB: OpenTab = {
  key: "scratch",
  fileId: null,
  name: "Untitled Circuit",
  fileType: "py",
  content: DEFAULT_CODE,
  folderId: null,
  isDirty: false,
};

/** Project a tab onto the legacy single-circuit mirror fields. */
function projectTab(tab: OpenTab) {
  return {
    code: tab.content,
    circuitName: tab.name,
    circuitId: tab.fileId,
    isDirty: tab.isDirty,
    activeFileType: tab.fileType,
  };
}

export const useCircuitStore = create<CircuitState>((set, get) => ({
  // Editor defaults (mirror of the initial scratch tab)
  code: DEFAULT_CODE,
  circuitName: "Untitled Circuit",
  circuitId: null,
  isDirty: false,
  forkedFrom: null,

  // Execution defaults
  isExecuting: false,
  result: null,
  error: null,
  selectedBackend: "local_simulator",

  // Visualization
  circuitDiagram: null,

  // Workspace (API-017)
  tree: { folders: [], files: [] },
  treeLoading: false,
  openTabs: [SCRATCH_TAB],
  activeKey: SCRATCH_TAB.key,
  activeFileType: "py",

  // Actions — setCode/setCircuitName also write through to the active tab.
  setCode: (code) =>
    set((s) => ({
      code,
      isDirty: true,
      openTabs: s.openTabs.map((t) =>
        t.key === s.activeKey ? { ...t, content: code, isDirty: true } : t,
      ),
    })),
  setCircuitName: (circuitName) =>
    set((s) => ({
      circuitName,
      isDirty: true,
      openTabs: s.openTabs.map((t) =>
        t.key === s.activeKey ? { ...t, name: circuitName, isDirty: true } : t,
      ),
    })),
  setCircuitId: (circuitId) => set({ circuitId }),
  setExecuting: (isExecuting) => set({ isExecuting }),
  setResult: (result) => set({ result, error: null }),
  setError: (error) => set({ error, result: null }),
  setSelectedBackend: (selectedBackend) => set({ selectedBackend }),
  setCircuitDiagram: (circuitDiagram) => set({ circuitDiagram }),
  resetCircuit: () =>
    set((s) => {
      const openTabs = s.openTabs.map((t) =>
        t.key === s.activeKey
          ? { ...t, name: "Untitled Circuit", content: DEFAULT_CODE, fileId: null, folderId: null, isDirty: false }
          : t,
      );
      const active = openTabs.find((t) => t.key === s.activeKey) ?? SCRATCH_TAB;
      return {
        ...projectTab(active),
        openTabs,
        forkedFrom: null,
        result: null,
        error: null,
        circuitDiagram: null,
      };
    }),
  loadTemplate: (template) =>
    set((s) => {
      // Open the template as a fresh unsaved .py tab (first edit flips isDirty →
      // STUDIO-014 anon-gate contract preserved).
      const key = nextTabKey();
      const tab: OpenTab = {
        key,
        fileId: null,
        name: template.name,
        fileType: "py",
        content: template.code,
        folderId: null,
        isDirty: false,
      };
      return {
        ...projectTab(tab),
        openTabs: [...s.openTabs, tab],
        activeKey: key,
        forkedFrom: { id: template.id, name: template.name },
        result: null,
        error: null,
        circuitDiagram: null,
      };
    }),

  // ─── Workspace actions (API-017) ───
  loadTree: async () => {
    set({ treeLoading: true });
    try {
      const tree = await fetchWorkspaceTree();
      set({ tree, treeLoading: false });
    } catch {
      set({ treeLoading: false });
    }
  },
  openFileTab: async (fileId) => {
    const existing = get().openTabs.find((t) => t.fileId === fileId);
    if (existing) {
      get().setActiveTab(existing.key);
      return;
    }
    const f = await apiOpenFile(fileId);
    set((s) => {
      const tab: OpenTab = {
        key: nextTabKey(),
        fileId: f.id,
        name: f.name,
        fileType: f.file_type,
        content: f.content ?? "",
        folderId: f.folder_id,
        isDirty: false,
      };
      return {
        ...projectTab(tab),
        openTabs: [...s.openTabs, tab],
        activeKey: tab.key,
        forkedFrom: null,
        result: null,
        error: null,
        circuitDiagram: null,
      };
    });
  },
  openNewTab: (fileType, name, content = "") =>
    set((s) => {
      const key = nextTabKey();
      const tab: OpenTab = {
        key,
        fileId: null,
        name,
        fileType,
        content,
        folderId: null,
        isDirty: true,
      };
      return {
        ...projectTab(tab),
        openTabs: [...s.openTabs, tab],
        activeKey: key,
        forkedFrom: null,
        result: null,
        error: null,
        circuitDiagram: null,
      };
    }),
  setActiveTab: (key) =>
    set((s) => {
      const tab = s.openTabs.find((t) => t.key === key);
      if (!tab) return {};
      return { ...projectTab(tab), activeKey: key, result: null, error: null, circuitDiagram: null };
    }),
  closeTab: (key) =>
    set((s) => {
      const remaining = s.openTabs.filter((t) => t.key !== key);
      if (s.activeKey !== key) return { openTabs: remaining };
      const next = remaining[remaining.length - 1];
      if (!next) {
        return {
          ...projectTab(SCRATCH_TAB),
          openTabs: [SCRATCH_TAB],
          activeKey: SCRATCH_TAB.key,
          result: null,
          error: null,
          circuitDiagram: null,
        };
      }
      return {
        ...projectTab(next),
        openTabs: remaining,
        activeKey: next.key,
        result: null,
        error: null,
        circuitDiagram: null,
      };
    }),
  markActiveSaved: (file) =>
    set((s) => {
      const openTabs = s.openTabs.map((t) =>
        t.key === s.activeKey
          ? { ...t, fileId: file.id, name: file.name, folderId: file.folder_id, isDirty: false }
          : t,
      );
      const active = openTabs.find((t) => t.key === s.activeKey) ?? SCRATCH_TAB;
      return { ...projectTab(active), openTabs };
    }),
}));

// ============================================================
// Backend Store — manages backend status
// ============================================================

interface BackendState {
  backends: BackendInfo[];
  isLoading: boolean;
  /** True while the user's IBM devices are being fetched (slow — hits IBM cloud). */
  ibmLoading: boolean;
  setBackends: (backends: BackendInfo[]) => void;
  setLoading: (loading: boolean) => void;
  fetchBackends: () => Promise<void>;
  /** Merge the user's own IBM devices into the list (API-016; auth required). */
  fetchIBMBackends: () => Promise<void>;
}

// Default backends are only used as fallback until the API responds.
// The full enriched data comes from GET /api/backends.
export const DEFAULT_BACKENDS: BackendInfo[] = [
  {
    id: "local_simulator", name: "Local Simulator", provider: "TheQuantCloud",
    type: "simulator", qubits: 20, status: "online", queueDepth: 0,
    avgFidelity: 1.0, costPerShot: 0.0, description: "Pure NumPy statevector simulator (QuantSDK built-in). Up to 20 qubits.",
    technology: "simulator", nativeGates: ["h","x","y","z","cx","cz","rx","ry","rz","swap","ccx"], connectivity: "all-to-all",
    maxShots: 1_000_000, avgQueueTimeSec: 0, region: "cloud", features: ["simulator", "free-tier"],
  },
  {
    id: "aer_simulator", name: "Aer Simulator", provider: "TheQuantCloud",
    type: "simulator", qubits: 25, status: "online", queueDepth: 0,
    avgFidelity: 1.0, costPerShot: 0.0, description: "Qiskit Aer statevector/QASM simulator. Up to 25 qubits.",
    technology: "simulator", nativeGates: ["h","x","y","z","cx","cz","rx","ry","rz","swap","ccx"], connectivity: "all-to-all",
    maxShots: 1_000_000, avgQueueTimeSec: 0, region: "cloud", features: ["simulator", "free-tier"],
  },
  {
    id: "cirq_simulator", name: "Cirq Simulator", provider: "TheQuantCloud",
    type: "simulator", qubits: 20, status: "online", queueDepth: 0,
    avgFidelity: 1.0, costPerShot: 0.0, description: "Google Cirq DensityMatrix simulator. Up to 20 qubits.",
    technology: "simulator", nativeGates: ["h","x","y","z","cx","cz","rx","ry","rz","swap","ccx"], connectivity: "all-to-all",
    maxShots: 1_000_000, avgQueueTimeSec: 0, region: "cloud", features: ["simulator", "free-tier"],
  },
  {
    id: "pennylane_simulator", name: "PennyLane Simulator", provider: "TheQuantCloud",
    type: "simulator", qubits: 20, status: "online", queueDepth: 0,
    avgFidelity: 1.0, costPerShot: 0.0, description: "PennyLane default.qubit simulator. Up to 20 qubits.",
    technology: "simulator", nativeGates: ["h","x","y","z","cx","cz","rx","ry","rz","swap","ccx"], connectivity: "all-to-all",
    maxShots: 1_000_000, avgQueueTimeSec: 0, region: "cloud", features: ["simulator", "free-tier"],
  },
];

export const useBackendStore = create<BackendState>((set, get) => ({
  backends: DEFAULT_BACKENDS,
  isLoading: false,
  ibmLoading: false,
  setBackends: (backends) => set({ backends }),
  setLoading: (loading) => set({ isLoading: loading }),
  fetchBackends: async () => {
    set({ isLoading: true });
    try {
      // Fetch from TheQuantCloud API (public endpoint, no auth required)
      const { cloudFetchBackends } = await import("@/lib/cloud-api");
      const cloudBackends = await cloudFetchBackends();
      const mapped: BackendInfo[] = cloudBackends.map((b) => ({
        id: b.name,
        name: b.name,
        provider: b.provider,
        type: b.is_simulator ? "simulator" as const : "hardware" as const,
        qubits: b.num_qubits,
        status: (b.status === "online" ? "online" : b.status === "offline" ? "offline" : b.status === "maintenance" ? "maintenance" : "busy") as BackendInfo["status"],
        queueDepth: b.queue_depth || 0,
        avgFidelity: 1.0,
        costPerShot: b.cost_per_shot || 0.0,
        description: b.description || "",
        technology: b.is_simulator ? "simulator" : "hardware",
        nativeGates: b.native_gates || [],
        connectivity: "all-to-all",
        maxShots: 100_000,
        avgQueueTimeSec: b.avg_queue_time_sec || 0,
        region: "cloud",
        features: b.is_simulator ? ["simulator", "free-tier"] : ["hardware"],
      }));
      if (mapped.length > 0) {
        // Preserve any IBM devices already merged in (fetchIBMBackends can win
        // the race): only the simulators/public catalog are replaced here.
        const existingIBM = get().backends.filter((b) => b.id.startsWith("ibm_"));
        set({ backends: [...mapped, ...existingIBM] });
      }
    } catch {
      // Silently fall back to defaults
      console.warn("[QuantStudio] Failed to fetch cloud backends, using defaults");
    } finally {
      set({ isLoading: false });
    }
  },
  fetchIBMBackends: async () => {
    try {
      const { listIBMBackends, isCloudAuthenticated } = await import("@/lib/cloud-api");
      if (!isCloudAuthenticated()) return;
      set({ ibmLoading: true });
      const devices = await listIBMBackends();
      if (devices.length === 0) {
        console.warn(
          "[QuantStudio] IBM account connected but no devices returned — check your IBM plan/instance."
        );
      }
      const mapped: BackendInfo[] = devices.map((b) => ({
        id: b.name,
        name: b.name,
        provider: "IBM Quantum (your account)",
        type: "hardware" as const,
        qubits: b.num_qubits,
        status: (b.status === "online" ? "online" : "offline") as BackendInfo["status"],
        queueDepth: b.queue_depth || 0,
        avgFidelity: 0.99,
        costPerShot: 0.0,
        description: b.description || "",
        technology: "superconducting",
        nativeGates: b.native_gates || [],
        connectivity: "heavy-hex",
        maxShots: 100_000,
        avgQueueTimeSec: b.avg_queue_time_sec || 0,
        region: "ibm-cloud",
        features: ["hardware", "byo-credentials"],
      }));
      if (mapped.length > 0) {
        // Replace any previously merged IBM entries, keep simulators.
        const nonIBM = get().backends.filter((b) => !b.id.startsWith("ibm_"));
        set({ backends: [...nonIBM, ...mapped] });
      }
    } catch (err) {
      // Not connected / bridge disabled / IBM error — picker shows simulators
      // only. Log so a genuine failure isn't completely invisible.
      console.warn("[QuantStudio] Could not load IBM devices:", err);
    } finally {
      set({ ibmLoading: false });
    }
  },
}));
