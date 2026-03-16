import { create } from "zustand";

// ============================================================
// Circuit Store — manages editor state and circuit execution
// ============================================================

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

  // Execution
  isExecuting: boolean;
  result: ExecutionResult | null;
  error: string | null;
  selectedBackend: string;

  // Circuit visualization
  circuitDiagram: string | null;

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

export const useCircuitStore = create<CircuitState>((set) => ({
  // Editor defaults
  code: DEFAULT_CODE,
  circuitName: "Untitled Circuit",
  circuitId: null,
  isDirty: false,

  // Execution defaults
  isExecuting: false,
  result: null,
  error: null,
  selectedBackend: "simulator_cpu",

  // Visualization
  circuitDiagram: null,

  // Actions
  setCode: (code) => set({ code, isDirty: true }),
  setCircuitName: (circuitName) => set({ circuitName, isDirty: true }),
  setCircuitId: (circuitId) => set({ circuitId }),
  setExecuting: (isExecuting) => set({ isExecuting }),
  setResult: (result) => set({ result, error: null }),
  setError: (error) => set({ error, result: null }),
  setSelectedBackend: (selectedBackend) => set({ selectedBackend }),
  setCircuitDiagram: (circuitDiagram) => set({ circuitDiagram }),
  resetCircuit: () =>
    set({
      code: DEFAULT_CODE,
      circuitName: "Untitled Circuit",
      circuitId: null,
      isDirty: false,
      result: null,
      error: null,
      circuitDiagram: null,
    }),
  loadTemplate: (template) =>
    set({
      code: template.code,
      circuitName: template.name,
      circuitId: null,
      isDirty: false,
      result: null,
      error: null,
      circuitDiagram: null,
    }),
}));

// ============================================================
// Backend Store — manages backend status
// ============================================================

interface BackendState {
  backends: BackendInfo[];
  isLoading: boolean;
  setBackends: (backends: BackendInfo[]) => void;
  setLoading: (loading: boolean) => void;
  fetchBackends: () => Promise<void>;
}

// Default backends are only used as fallback until the API responds.
// The full enriched data comes from GET /api/backends.
export const DEFAULT_BACKENDS: BackendInfo[] = [
  {
    id: "simulator_cpu", name: "CPU Simulator", provider: "TheQuantCloud",
    type: "simulator", qubits: 25, status: "online", queueDepth: 0,
    avgFidelity: 1.0, costPerShot: 0.0, description: "Local CPU statevector simulator.",
    technology: "cpu", nativeGates: [], connectivity: "all-to-all",
    maxShots: 1_000_000, avgQueueTimeSec: 0, region: "local", features: ["free-tier"],
  },
];

export const useBackendStore = create<BackendState>((set) => ({
  backends: DEFAULT_BACKENDS,
  isLoading: false,
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
        set({ backends: mapped });
      }
    } catch {
      // Silently fall back to defaults
      console.warn("[QuantStudio] Failed to fetch cloud backends, using defaults");
    } finally {
      set({ isLoading: false });
    }
  },
}));
