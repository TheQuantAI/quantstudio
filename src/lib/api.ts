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

/** Run a quantum circuit via the FastAPI backend */
export async function runCircuit(
  code: string,
  shots: number = 1024,
  backend: string = "simulator_cpu"
): Promise<ExecutionResult> {
  const res = await fetch(`${API_BASE}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, shots, backend }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail || `Execution failed (HTTP ${res.status})`);
  }
  return res.json();
}

/** Fetch available backends */
export async function fetchBackends(): Promise<BackendInfo[]> {
  const res = await fetch(`${API_BASE}/api/backends`);
  if (!res.ok) throw new Error("Failed to fetch backends");
  return res.json();
}

/** Save a circuit */
export async function saveCircuit(
  name: string,
  code: string,
  description: string = "",
  userId: string = "anonymous"
): Promise<CircuitResponse> {
  const res = await fetch(`${API_BASE}/api/circuits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, code, description, user_id: userId }),
  });
  if (!res.ok) throw new Error("Failed to save circuit");
  return res.json();
}

/** List saved circuits (optionally by user) */
export async function listCircuits(userId?: string): Promise<CircuitResponse[]> {
  const url = userId
    ? `${API_BASE}/api/circuits?user_id=${encodeURIComponent(userId)}`
    : `${API_BASE}/api/circuits`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to list circuits");
  return res.json();
}

/** Load a circuit by ID */
export async function getCircuit(id: string): Promise<CircuitResponse> {
  const res = await fetch(`${API_BASE}/api/circuits/${id}`);
  if (!res.ok) throw new Error("Circuit not found");
  return res.json();
}

/** Update an existing circuit */
export async function updateCircuit(
  id: string,
  updates: { name?: string; code?: string; description?: string }
): Promise<CircuitResponse> {
  const res = await fetch(`${API_BASE}/api/circuits/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error("Failed to update circuit");
  return res.json();
}

/** Delete a circuit */
export async function deleteCircuit(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/circuits/${id}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete circuit");
}
