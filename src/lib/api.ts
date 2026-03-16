// Copyright 2026 TheQuantAI
// API client for QuantStudio — routes to TheQuantCloud when authenticated,
// falls back to browser simulator for anonymous users.

import {
  cloudRunCircuit,
  cloudFetchBackends,
  cloudSaveCircuit,
  cloudListCircuits,
  cloudGetCircuit,
  cloudUpdateCircuit,
  cloudDeleteCircuit,
  isCloudAuthenticated,
  getAuthToken,
  type CloudBackendInfo,
} from "./cloud-api";

export interface ExecutionResult {
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  most_likely: string;
  shots: number;
  backend: string;
  execution_time: number;
  job_id: string;
  circuit_diagram: string;
  metadata: {
    num_qubits: number;
    circuit_depth: number;
    gate_count: number;
    simulator?: string;
    seed?: number | null;
  };
}

export interface BackendInfo {
  id: string;
  name: string;
  provider: string;
  status: string;
  qubits: number;
  description: string;
  features: string[];
}

export interface CircuitResponse {
  id: string;
  name: string;
  code: string;
  description: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

/**
 * Run a quantum circuit.
 *
 * If the user is authenticated → submit to TheQuantCloud API (async job lifecycle).
 * Otherwise → fall back to the browser-based simulator.
 */
export async function runCircuit(
  code: string,
  shots: number = 1024,
  backend: string = "local_simulator",
  onStatusUpdate?: (status: string) => void,
): Promise<ExecutionResult> {
  // If authenticated, try the cloud API
  if (isCloudAuthenticated()) {
    try {
      const result = await cloudRunCircuit({
        code,
        shots,
        backend: backend === "browser_sim" ? null : backend,
        onStatusUpdate,
      });

      // Convert cloud result → ExecutionResult expected by Studio
      const counts = result.counts;
      const totalShots = Object.values(counts).reduce((a, b) => a + b, 0);
      const probabilities = result.probabilities ?? {};
      const mostLikely = Object.entries(counts).reduce(
        (best, [state, count]) => (count > best[1] ? [state, count] : best),
        ["", 0] as [string, number],
      )[0];

      // Generate circuit diagram client-side (cloud API doesn't return one)
      let circuit_diagram = "";
      try {
        const { generateDiagramFromCode } = await import("./simulator");
        circuit_diagram = generateDiagramFromCode(code);
      } catch { /* diagram generation is best-effort */ }

      return {
        counts,
        probabilities,
        most_likely: mostLikely,
        shots: totalShots || shots,
        backend: result.backend,
        execution_time: (result.execution_time_ms ?? 0) / 1000,
        job_id: result.job_id,
        circuit_diagram,
        metadata: {
          num_qubits: (result.metadata?.num_qubits as number) ?? 0,
          circuit_depth: (result.metadata?.circuit_depth as number) ?? 0,
          gate_count: (result.metadata?.gate_count as number) ?? 0,
          simulator: result.backend,
        },
      };
    } catch (err) {
      // If cloud fails with auth error, fall back to simulator
      if (err instanceof Error && "status" in err && (err as { status: number }).status === 401) {
        console.warn("[QuantStudio] Cloud auth failed, falling back to browser simulator");
      } else {
        throw err; // Re-throw non-auth errors (quota exceeded, invalid circuit, etc.)
      }
    }
  }

  // Fallback: browser simulator
  const { simulateCircuit } = await import("./simulator");
  return simulateCircuit(code, shots);
}

/** Map a cloud backend to the Studio BackendInfo shape */
function mapCloudBackend(b: CloudBackendInfo): BackendInfo {
  return {
    id: b.name,
    name: b.name,
    provider: b.provider,
    status: b.status,
    qubits: b.num_qubits,
    description: b.description,
    features: b.is_simulator ? ["simulator"] : ["hardware"],
  };
}

/**
 * Fetch available backends from TheQuantCloud.
 * This is a public endpoint — no auth required.
 * Falls back to an empty array on network error.
 */
export async function fetchBackends(): Promise<BackendInfo[]> {
  try {
    const cloudBackends = await cloudFetchBackends();
    return cloudBackends.map(mapCloudBackend);
  } catch {
    console.warn("[QuantStudio] Failed to fetch cloud backends, using defaults");
    return [];
  }
}

// ─── localStorage helpers for circuit persistence ───────────────

const LS_KEY = "quantstudio_circuits";

function getLocalCircuits(): CircuitResponse[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

function setLocalCircuits(circuits: CircuitResponse[]): void {
  localStorage.setItem(LS_KEY, JSON.stringify(circuits));
}

/**
 * Save a circuit.
 * If authenticated → saves to TheQuantCloud.
 * Otherwise → saves to localStorage.
 */
export async function saveCircuit(
  name: string,
  code: string,
  description: string = "",
  userId: string = "anonymous",
): Promise<CircuitResponse> {
  if (isCloudAuthenticated()) {
    try {
      const saved = await cloudSaveCircuit({ name, code });
      return {
        id: saved.id,
        name: saved.name,
        code: saved.code,
        description: "",
        user_id: saved.user_id,
        created_at: saved.created_at,
        updated_at: saved.updated_at,
      };
    } catch {
      // Fall through to localStorage
    }
  }

  const now = new Date().toISOString();
  const circuit: CircuitResponse = {
    id: `local-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    code,
    description,
    user_id: userId,
    created_at: now,
    updated_at: now,
  };
  const circuits = getLocalCircuits();
  circuits.unshift(circuit);
  setLocalCircuits(circuits);
  return circuit;
}

/**
 * List saved circuits.
 * If authenticated → fetches from TheQuantCloud.
 * Falls back to localStorage.
 */
export async function listCircuits(userId?: string): Promise<CircuitResponse[]> {
  if (isCloudAuthenticated()) {
    try {
      const cloudCircuits = await cloudListCircuits();
      return cloudCircuits.map((c) => ({
        id: c.id,
        name: c.name,
        code: c.code,
        description: "",
        user_id: c.user_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
    } catch {
      // Fall through to localStorage
    }
  }

  const all = getLocalCircuits();
  return userId ? all.filter((c) => c.user_id === userId) : all;
}

/** Load a circuit by ID */
export async function getCircuit(id: string): Promise<CircuitResponse> {
  // Cloud circuits have UUID format (not "local-...")
  if (isCloudAuthenticated() && !id.startsWith("local-")) {
    try {
      const c = await cloudGetCircuit(id);
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        description: "",
        user_id: c.user_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    } catch {
      // Fall through to localStorage
    }
  }

  const circuit = getLocalCircuits().find((c) => c.id === id);
  if (!circuit) throw new Error("Circuit not found");
  return circuit;
}

/** Update an existing circuit */
export async function updateCircuit(
  id: string,
  updates: { name?: string; code?: string; description?: string },
): Promise<CircuitResponse> {
  if (isCloudAuthenticated() && !id.startsWith("local-")) {
    try {
      const c = await cloudUpdateCircuit(id, updates);
      return {
        id: c.id,
        name: c.name,
        code: c.code,
        description: "",
        user_id: c.user_id,
        created_at: c.created_at,
        updated_at: c.updated_at,
      };
    } catch {
      // Fall through to localStorage
    }
  }

  const circuits = getLocalCircuits();
  const idx = circuits.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error("Circuit not found");
  circuits[idx] = {
    ...circuits[idx],
    ...updates,
    updated_at: new Date().toISOString(),
  };
  setLocalCircuits(circuits);
  return circuits[idx];
}

/** Delete a circuit */
export async function deleteCircuit(id: string): Promise<void> {
  if (isCloudAuthenticated() && !id.startsWith("local-")) {
    try {
      await cloudDeleteCircuit(id);
      return;
    } catch {
      // Fall through to localStorage
    }
  }

  const circuits = getLocalCircuits().filter((c) => c.id !== id);
  setLocalCircuits(circuits);
}

// Re-export for convenience
export { isCloudAuthenticated, getAuthToken } from "./cloud-api";
