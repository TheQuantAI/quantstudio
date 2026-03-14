// Copyright 2026 TheQuantAI
// API client for QuantStudio backend

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

/** Run a quantum circuit via the FastAPI backend, with browser simulator fallback */
export async function runCircuit(
  code: string,
  shots: number = 1024,
  backend: string = "simulator_cpu"
): Promise<ExecutionResult> {
  // Try the FastAPI backend first
  try {
    const res = await fetch(`${API_BASE}/api/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, shots, backend }),
      signal: AbortSignal.timeout(5000), // 5s timeout
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      throw new Error(body?.detail || `Execution failed (HTTP ${res.status})`);
    }
    return res.json();
  } catch {
    // Backend unreachable — fall back to browser simulator
    const { simulateCircuit } = await import("./simulator");
    return simulateCircuit(code, shots);
  }
}

/** Fetch available backends */
export async function fetchBackends(): Promise<BackendInfo[]> {
  const res = await fetch(`${API_BASE}/api/backends`);
  if (!res.ok) throw new Error("Failed to fetch backends");
  return res.json();
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

/** Save a circuit — tries API, falls back to localStorage */
export async function saveCircuit(
  name: string,
  code: string,
  description: string = "",
  userId: string = "anonymous"
): Promise<CircuitResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/circuits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code, description, user_id: userId }),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("API error");
    return res.json();
  } catch {
    // Fallback: save to localStorage
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
}

/** List saved circuits — tries API, falls back to localStorage */
export async function listCircuits(userId?: string): Promise<CircuitResponse[]> {
  try {
    const url = userId
      ? `${API_BASE}/api/circuits?user_id=${encodeURIComponent(userId)}`
      : `${API_BASE}/api/circuits`;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error("API error");
    return res.json();
  } catch {
    const all = getLocalCircuits();
    return userId ? all.filter((c) => c.user_id === userId) : all;
  }
}

/** Load a circuit by ID — tries API, falls back to localStorage */
export async function getCircuit(id: string): Promise<CircuitResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/circuits/${id}`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("API error");
    return res.json();
  } catch {
    const circuit = getLocalCircuits().find((c) => c.id === id);
    if (!circuit) throw new Error("Circuit not found");
    return circuit;
  }
}

/** Update an existing circuit — tries API, falls back to localStorage */
export async function updateCircuit(
  id: string,
  updates: { name?: string; code?: string; description?: string }
): Promise<CircuitResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/circuits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("API error");
    return res.json();
  } catch {
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
}

/** Delete a circuit — tries API, falls back to localStorage */
export async function deleteCircuit(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/api/circuits/${id}`, {
      method: "DELETE",
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) throw new Error("API error");
  } catch {
    const circuits = getLocalCircuits().filter((c) => c.id !== id);
    setLocalCircuits(circuits);
  }
}
