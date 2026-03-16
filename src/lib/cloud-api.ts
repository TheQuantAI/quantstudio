// Copyright 2026 TheQuantAI
// Cloud API client for TheQuantCloud (api.thequantcloud.com)
// Handles async job lifecycle: submit → poll → result

// ─── Configuration ──────────────────────────────────────────────

export const CLOUD_API_URL =
  process.env.NEXT_PUBLIC_CLOUD_API_URL || "https://api.thequantcloud.com";

const CLOUD_V1 = `${CLOUD_API_URL}/v1`;

/** Max time (ms) to poll a job before giving up */
const JOB_POLL_TIMEOUT_MS = 120_000; // 2 minutes

/** Initial poll interval (ms), doubles each attempt (exponential backoff) */
const POLL_INITIAL_MS = 500;

/** Maximum poll interval (ms) */
const POLL_MAX_MS = 5_000;

// ─── Auth token helper ──────────────────────────────────────────
// In D7 this will read from Supabase Auth session.
// For now, check localStorage for a manually-set token or API key.

const TOKEN_KEY = "quantcloud_auth_token";
const API_KEY_KEY = "quantcloud_api_key";

/** Get the current auth token (Supabase JWT or API key). Returns null if unauthenticated. */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // 1. Supabase session token (set by D7 auth integration)
  const supabaseKey = Object.keys(localStorage).find((k) =>
    k.startsWith("sb-") && k.endsWith("-auth-token")
  );
  if (supabaseKey) {
    try {
      const session = JSON.parse(localStorage.getItem(supabaseKey) || "{}");
      if (session?.access_token) return session.access_token;
    } catch { /* ignore */ }
  }

  // 2. Explicit token (set from dashboard or dev tools)
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) return token;

  // 3. API key
  const apiKey = localStorage.getItem(API_KEY_KEY);
  if (apiKey) return apiKey;

  return null;
}

/** Build Authorization header if token is available */
function authHeaders(token?: string | null): Record<string, string> {
  const t = token ?? getAuthToken();
  if (!t) return {};
  // API keys start with "qc_", JWTs start with "ey"
  if (t.startsWith("qc_")) {
    return { "X-API-Key": t };
  }
  return { Authorization: `Bearer ${t}` };
}

/** Check if user is currently authenticated with the cloud API */
export function isCloudAuthenticated(): boolean {
  return getAuthToken() !== null;
}

// ─── Types matching the cloud API schemas ───────────────────────

export interface CloudBackendInfo {
  name: string;
  provider: string;
  num_qubits: number;
  status: string;
  is_simulator: boolean;
  queue_depth: number;
  avg_queue_time_sec: number;
  cost_per_shot: number;
  native_gates: string[];
  description: string;
}

export interface CloudBackendList {
  backends: CloudBackendInfo[];
  count: number;
}

export interface CloudJobResponse {
  job_id: string;
  status: string; // submitted | analyzing | routing | running | completed | failed | timeout | cancelled
  backend: string | null;
  shots: number;
  optimize_for: string;
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface CloudJobResult {
  job_id: string;
  counts: Record<string, number>;
  probabilities: Record<string, number> | null;
  backend: string | null;
  execution_time_ms: number | null;
  metadata: Record<string, unknown>;
}

export interface CloudCircuit {
  id: string;
  user_id: string;
  name: string;
  code: string;
  qasm: string | null;
  num_qubits: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// ─── Error class ────────────────────────────────────────────────

export class CloudAPIError extends Error {
  constructor(
    message: string,
    public status: number,
    public detail?: string
  ) {
    super(message);
    this.name = "CloudAPIError";
  }
}

async function cloudFetch(
  path: string,
  options: RequestInit = {},
  token?: string | null
): Promise<Response> {
  const url = path.startsWith("http") ? path : `${CLOUD_V1}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...authHeaders(token),
    ...(options.headers as Record<string, string> || {}),
  };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new CloudAPIError(
      body.detail || body.error || `HTTP ${res.status}`,
      res.status,
      body.detail
    );
  }
  return res;
}

// ─── Backends (public) ──────────────────────────────────────────

/** Fetch all available backends from the cloud API (no auth required) */
export async function cloudFetchBackends(): Promise<CloudBackendInfo[]> {
  const res = await cloudFetch("/backends", { method: "GET" });
  const data: CloudBackendList = await res.json();
  return data.backends;
}

/** Fetch a single backend's details */
export async function cloudGetBackend(name: string): Promise<CloudBackendInfo> {
  const res = await cloudFetch(`/backends/${encodeURIComponent(name)}`, { method: "GET" });
  return res.json();
}

// ─── Circuit execution (async job lifecycle) ────────────────────

/** Submit a circuit for cloud execution. Returns the initial job response. */
export async function cloudSubmitCircuit(params: {
  code?: string;
  circuit_qasm?: string;
  shots?: number;
  backend?: string | null;
  optimize_for?: string;
  num_qubits?: number;
  token?: string;
}): Promise<CloudJobResponse> {
  const res = await cloudFetch(
    "/circuits/run",
    {
      method: "POST",
      body: JSON.stringify({
        code: params.code,
        circuit_qasm: params.circuit_qasm,
        shots: params.shots ?? 1024,
        backend: params.backend,
        optimize_for: params.optimize_for ?? "balanced",
        num_qubits: params.num_qubits,
      }),
    },
    params.token
  );
  return res.json();
}

/** Poll job status until it reaches a terminal state */
export async function cloudPollJob(
  jobId: string,
  token?: string,
  onStatusUpdate?: (status: string) => void
): Promise<CloudJobResponse> {
  const start = Date.now();
  let interval = POLL_INITIAL_MS;

  while (Date.now() - start < JOB_POLL_TIMEOUT_MS) {
    const res = await cloudFetch(`/jobs/${jobId}`, { method: "GET" }, token);
    const job: CloudJobResponse = await res.json();

    if (onStatusUpdate) onStatusUpdate(job.status);

    const terminal = ["completed", "failed", "timeout", "cancelled"];
    if (terminal.includes(job.status)) {
      return job;
    }

    // Exponential backoff
    await new Promise((r) => setTimeout(r, interval));
    interval = Math.min(interval * 2, POLL_MAX_MS);
  }

  throw new CloudAPIError("Job timed out waiting for completion", 408);
}

/** Get the result of a completed job */
export async function cloudGetJobResult(
  jobId: string,
  token?: string
): Promise<CloudJobResult> {
  const res = await cloudFetch(`/jobs/${jobId}/result`, { method: "GET" }, token);
  return res.json();
}

/**
 * High-level: submit circuit, poll until done, return result.
 * This is the main function Studio calls for cloud execution.
 */
export async function cloudRunCircuit(params: {
  code: string;
  shots?: number;
  backend?: string | null;
  optimize_for?: string;
  num_qubits?: number;
  token?: string;
  onStatusUpdate?: (status: string) => void;
}): Promise<{
  job_id: string;
  counts: Record<string, number>;
  probabilities: Record<string, number>;
  backend: string;
  execution_time_ms: number;
  metadata: Record<string, unknown>;
}> {
  const token = params.token ?? getAuthToken() ?? undefined;

  // 1. Submit
  const job = await cloudSubmitCircuit({ ...params, token });
  if (params.onStatusUpdate) params.onStatusUpdate(job.status);

  // 2. Poll until terminal
  const finalJob = await cloudPollJob(job.job_id, token, params.onStatusUpdate);

  if (finalJob.status === "failed") {
    throw new CloudAPIError(
      finalJob.error_message || "Job execution failed",
      500,
      finalJob.error_message ?? undefined
    );
  }
  if (finalJob.status === "cancelled") {
    throw new CloudAPIError("Job was cancelled", 499);
  }
  if (finalJob.status === "timeout") {
    throw new CloudAPIError("Job execution timed out on the server", 408);
  }

  // 3. Fetch result
  const result = await cloudGetJobResult(job.job_id, token);

  return {
    job_id: result.job_id,
    counts: result.counts,
    probabilities: result.probabilities ?? {},
    backend: result.backend ?? finalJob.backend ?? "unknown",
    execution_time_ms: result.execution_time_ms ?? 0,
    metadata: result.metadata,
  };
}

// ─── Circuit CRUD (requires auth) ──────────────────────────────

export async function cloudSaveCircuit(params: {
  name: string;
  code: string;
  num_qubits?: number;
  metadata?: Record<string, unknown>;
  token?: string;
}): Promise<CloudCircuit> {
  const res = await cloudFetch(
    "/circuits",
    {
      method: "POST",
      body: JSON.stringify({
        name: params.name,
        code: params.code,
        num_qubits: params.num_qubits,
        metadata: params.metadata ?? {},
      }),
    },
    params.token
  );
  return res.json();
}

export async function cloudListCircuits(
  token?: string,
  limit = 50,
  offset = 0
): Promise<CloudCircuit[]> {
  const res = await cloudFetch(
    `/circuits?limit=${limit}&offset=${offset}`,
    { method: "GET" },
    token
  );
  return res.json();
}

export async function cloudGetCircuit(
  id: string,
  token?: string
): Promise<CloudCircuit> {
  const res = await cloudFetch(`/circuits/${id}`, { method: "GET" }, token);
  return res.json();
}

export async function cloudUpdateCircuit(
  id: string,
  updates: { name?: string; code?: string; num_qubits?: number },
  token?: string
): Promise<CloudCircuit> {
  const res = await cloudFetch(
    `/circuits/${id}`,
    { method: "PUT", body: JSON.stringify(updates) },
    token
  );
  return res.json();
}

export async function cloudDeleteCircuit(
  id: string,
  token?: string
): Promise<void> {
  await cloudFetch(`/circuits/${id}`, { method: "DELETE" }, token);
}

// ─── Jobs (requires auth) ──────────────────────────────────────

export async function cloudListJobs(
  token?: string,
  statusFilter?: string,
  limit = 50,
  offset = 0
): Promise<CloudJobResponse[]> {
  let path = `/jobs?limit=${limit}&offset=${offset}`;
  if (statusFilter) path += `&status_filter=${statusFilter}`;
  const res = await cloudFetch(path, { method: "GET" }, token);
  return res.json();
}

export async function cloudCancelJob(
  jobId: string,
  token?: string
): Promise<CloudJobResponse> {
  const res = await cloudFetch(
    `/jobs/${jobId}/cancel`,
    { method: "POST" },
    token
  );
  return res.json();
}

// ─── Account (requires auth) ───────────────────────────────────

export interface CloudUsage {
  tier: string;
  simulator_minutes_used: number;
  simulator_minutes_limit: number;
  qpu_tasks_used: number;
  qpu_tasks_limit: number;
  credits_remaining_usd: number;
}

export async function cloudGetUsage(token?: string): Promise<CloudUsage> {
  const res = await cloudFetch("/account/usage", { method: "GET" }, token);
  return res.json();
}

// ─── Health (public) ────────────────────────────────────────────

export async function cloudHealthCheck(): Promise<{ status: string; version: string }> {
  const res = await fetch(`${CLOUD_API_URL}/health`);
  return res.json();
}
