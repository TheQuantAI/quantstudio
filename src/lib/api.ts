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
  cloudSubmitCircuit,
  cloudGetWorkspaceTree,
  cloudCreateFolder,
  cloudUpdateFolder,
  cloudDeleteFolder,
  cloudDownloadFolder,
  cloudCreateFile,
  cloudGetFile,
  cloudUpdateFile,
  cloudDeleteFile,
  cloudRestoreFile,
  cloudRestoreFolder,
  cloudGetTrash,
  cloudEmptyTrash,
  cloudGetUsage,
  isCloudAuthenticated,
  getAuthToken,
  type CloudBackendInfo,
  type CloudFolder,
  type CloudFile,
  type CloudWorkspaceTree,
  type FileType,
  type TrashItem,
  type StorageUsage,
} from "./cloud-api";
import { track } from "./analytics";

const FIRST_CLOUD_RUN_KEY = "tqc-first-cloud-run";

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
 * Submit a circuit to a real QPU (API-016) — submit-only, no result polling.
 *
 * IBM queue times run from minutes to hours; blocking the tab would be
 * dishonest UX. The job is tracked on Dashboard → Jobs.
 */
export async function submitCircuitToQPU(
  code: string,
  shots: number = 1024,
  backend: string,
): Promise<{ job_id: string; status: string; backend: string | null; qasm: string }> {
  let circuit_qasm: string | undefined;
  let num_qubits: number | undefined;
  try {
    const { generateQasmFromCode } = await import("./python-runtime");
    const compiled = await generateQasmFromCode(code);
    circuit_qasm = compiled.qasm;
    num_qubits = compiled.num_qubits;
  } catch (qerr) {
    const detail = qerr instanceof Error ? qerr.message : String(qerr);
    throw new Error(`Could not prepare circuit for QPU submission: ${detail}`);
  }

  const job = await cloudSubmitCircuit({
    code,
    circuit_qasm,
    num_qubits,
    shots,
    backend,
  });

  track("circuit_run", { mode: "qpu", backend, shots });
  // qasm returned so the caller can render the SUBMITTED circuit's diagram
  // and pass it to pollQPUResult / the resume path (STUDIO-019).
  return { job_id: job.job_id, status: job.status, backend: job.backend, qasm: circuit_qasm };
}

/** A QPU job reached a terminal non-success state (STUDIO-019). Distinct from
 *  CloudAPIError(408), which means the poll *window* expired while the job is
 *  still pending — callers must message these very differently. */
export class QPUTerminalError extends Error {
  constructor(
    public kind: "failed" | "cancelled" | "timeout",
    message: string,
  ) {
    super(message);
    this.name = "QPUTerminalError";
  }
}

/** How long Studio foreground-polls a QPU job before handing off to the
 *  Dashboard. Free-plan queues can exceed this; the job still completes and is
 *  saved server-side regardless. */
const QPU_POLL_TIMEOUT_MS = 20 * 60 * 1000; // 20 minutes

/**
 * Poll an already-submitted QPU job until it finishes, then return its result
 * mapped to ExecutionResult. Non-blocking for the tab (the caller awaits it in
 * the background). Throws CloudAPIError(408) if it's still queued past the
 * timeout — the job keeps running and the result is retrievable from Dashboard.
 */
export async function pollQPUResult(
  jobId: string,
  opts: { qasm?: string | null; onStatusUpdate?: (status: string) => void } = {},
): Promise<ExecutionResult> {
  const { cloudPollJob, cloudGetJobResult } = await import("./cloud-api");
  const token = getAuthToken() ?? undefined;

  const finalJob = await cloudPollJob(jobId, token, opts.onStatusUpdate, QPU_POLL_TIMEOUT_MS);
  // Terminal non-success states get a typed error so callers can never again
  // conflate "your job died" with "still waiting" (STUDIO-019).
  if (finalJob.status === "failed") {
    throw new QPUTerminalError("failed", finalJob.error_message || "QPU job failed at the provider.");
  }
  if (finalJob.status === "cancelled") {
    throw new QPUTerminalError("cancelled", finalJob.error_message || "QPU job was cancelled.");
  }
  if (finalJob.status === "timeout") {
    throw new QPUTerminalError(
      "timeout",
      finalJob.error_message || "QPU job was auto-cancelled after waiting too long in the provider queue.",
    );
  }

  const result = await cloudGetJobResult(jobId, token);
  const counts = result.counts;
  const totalShots = Object.values(counts).reduce((a, b) => a + b, 0);
  const mostLikely = Object.entries(counts).reduce(
    (best, [state, count]) => (count > best[1] ? [state, count] : best),
    ["", 0] as [string, number],
  )[0];

  // Diagram from the SUBMITTED circuit's QASM — not from whatever is in the
  // editor now (which may have been edited during the queue wait).
  let circuit_diagram = "";
  try {
    const { diagramFromQasm } = await import("./qasm-diagram");
    circuit_diagram = diagramFromQasm(opts.qasm) ?? "";
  } catch { /* best-effort */ }

  // QPU results don't carry num_qubits in metadata — derive from the
  // measured bitstring length.
  const numQubits =
    (result.metadata?.num_qubits as number | undefined) ??
    Object.keys(counts)[0]?.length ??
    0;

  return {
    counts,
    probabilities: result.probabilities ?? {},
    most_likely: mostLikely,
    shots: totalShots,
    backend: result.backend ?? "ibm",
    execution_time: (result.execution_time_ms ?? 0) / 1000,
    job_id: result.job_id,
    circuit_diagram,
    metadata: {
      num_qubits: numQubits,
      circuit_depth: (result.metadata?.transpiled_depth as number) ?? 0,
      gate_count: (result.metadata?.transpiled_gates as number) ?? 0,
      simulator: result.backend ?? undefined,
    },
  };
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
      // Compile the user's Python to OpenQASM in-browser so the server runs
      // the real circuit (API-014). A failure here is surfaced, not hidden —
      // we never fall back to submitting raw Python.
      let circuit_qasm: string | undefined;
      let num_qubits: number | undefined;
      try {
        const { generateQasmFromCode } = await import("./python-runtime");
        const compiled = await generateQasmFromCode(code);
        circuit_qasm = compiled.qasm;
        num_qubits = compiled.num_qubits;
      } catch (qerr) {
        const detail = qerr instanceof Error ? qerr.message : String(qerr);
        throw new Error(`Could not prepare circuit for cloud execution: ${detail}`);
      }

      const result = await cloudRunCircuit({
        code,
        circuit_qasm,
        num_qubits,
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

      // Analytics (STUDIO-015): a successful cloud run, and the first one once.
      // Only mark "first run seen" if the event actually fired (analytics active),
      // so a cloud run made before consent doesn't silently suppress it later.
      track("circuit_run", { mode: "cloud", backend: result.backend, shots });
      try {
        if (!localStorage.getItem(FIRST_CLOUD_RUN_KEY)) {
          if (track("first_cloud_run", { backend: result.backend })) {
            localStorage.setItem(FIRST_CLOUD_RUN_KEY, "1");
          }
        }
      } catch { /* storage unavailable — skip first-run marker */ }

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
  const localResult = await simulateCircuit(code, shots);
  track("circuit_run", { mode: "local", backend: "browser_sim", shots });
  return localResult;
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
  metadata?: Record<string, unknown>,
): Promise<CircuitResponse> {
  if (isCloudAuthenticated()) {
    try {
      const saved = await cloudSaveCircuit({ name, code, metadata });
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

// ─── Workspace: folders + files (API-017) ──────────────────────
// Authenticated-only. Unlike the circuit facade above, these SURFACE errors
// (no silent localStorage fallback) — the explorer only renders when signed in.

export type {
  CloudFolder,
  CloudFile,
  CloudWorkspaceTree,
  FileType,
} from "./cloud-api";

function requireAuth(): void {
  if (!isCloudAuthenticated()) {
    throw new Error("Sign in to use your workspace.");
  }
}

export async function fetchWorkspaceTree(): Promise<CloudWorkspaceTree> {
  requireAuth();
  return cloudGetWorkspaceTree();
}

export async function createFolder(
  name: string,
  parentId: string | null = null,
): Promise<CloudFolder> {
  requireAuth();
  return cloudCreateFolder({ name, parent_id: parentId });
}

export async function renameFolder(id: string, name: string): Promise<CloudFolder> {
  requireAuth();
  return cloudUpdateFolder(id, { name });
}

export async function moveFolder(
  id: string,
  parentId: string | null,
): Promise<CloudFolder> {
  requireAuth();
  return cloudUpdateFolder(id, { parent_id: parentId });
}

export async function deleteFolder(id: string, hard = false): Promise<void> {
  requireAuth();
  return cloudDeleteFolder(id, hard);
}

export async function restoreFolder(id: string): Promise<CloudFolder> {
  requireAuth();
  return cloudRestoreFolder(id);
}

export async function createFile(params: {
  name: string;
  fileType: FileType;
  folderId?: string | null;
  content?: string;
  numQubits?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<CloudFile> {
  requireAuth();
  return cloudCreateFile({
    name: params.name,
    file_type: params.fileType,
    folder_id: params.folderId ?? null,
    content: params.content ?? "",
    num_qubits: params.numQubits ?? null,
    metadata: params.metadata,
  });
}

export async function openFile(id: string): Promise<CloudFile> {
  requireAuth();
  return cloudGetFile(id);
}

/** Persist a tab: create when it has no fileId yet, otherwise patch its content. */
export async function saveFile(params: {
  fileId: string | null;
  name: string;
  fileType: FileType;
  content: string;
  folderId?: string | null;
  numQubits?: number | null;
  metadata?: Record<string, unknown>;
}): Promise<CloudFile> {
  requireAuth();
  if (params.fileId === null) {
    return createFile({
      name: params.name,
      fileType: params.fileType,
      folderId: params.folderId ?? null,
      content: params.content,
      numQubits: params.numQubits ?? null,
      metadata: params.metadata,
    });
  }
  return cloudUpdateFile(params.fileId, {
    name: params.name, // persist toolbar renames of an existing file
    content: params.content,
    num_qubits: params.numQubits ?? null,
    metadata: params.metadata,
  });
}

export async function renameFile(id: string, name: string): Promise<CloudFile> {
  requireAuth();
  return cloudUpdateFile(id, { name });
}

export async function moveFile(
  id: string,
  folderId: string | null,
): Promise<CloudFile> {
  requireAuth();
  return cloudUpdateFile(id, { folder_id: folderId });
}

export async function deleteFile(id: string, hard = false): Promise<void> {
  requireAuth();
  return cloudDeleteFile(id, hard);
}

export async function restoreFile(id: string): Promise<CloudFile> {
  requireAuth();
  return cloudRestoreFile(id);
}

// ─── Trash + storage usage (API-018) ───────────────────────────

export type { TrashItem, StorageUsage } from "./cloud-api";

export async function listTrash(): Promise<TrashItem[]> {
  requireAuth();
  return cloudGetTrash();
}

export async function emptyTrash(): Promise<number> {
  requireAuth();
  return cloudEmptyTrash();
}

export async function fetchStorageUsage(): Promise<StorageUsage> {
  requireAuth();
  return cloudGetUsage();
}

/** File types accepted for upload (only these can be created). */
export const UPLOADABLE_EXT: Record<string, FileType> = {
  py: "py",
  qasm: "qasm",
  md: "md",
  json: "json",
  csv: "csv",
};
const MAX_UPLOAD_BYTES = 100_000;

export interface UploadResult {
  created: CloudFile[];
  errors: { name: string; reason: string }[];
}

/** Read local text files and create them in a folder. Validates type + size;
 *  surfaces per-file errors (bad type, too large, quota). */
export async function uploadFiles(
  files: File[],
  folderId: string | null,
): Promise<UploadResult> {
  requireAuth();
  const result: UploadResult = { created: [], errors: [] };
  for (const file of files) {
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const fileType = UPLOADABLE_EXT[ext];
    if (!fileType) {
      result.errors.push({ name: file.name, reason: "Unsupported type (use .py/.qasm/.md/.json/.csv)" });
      continue;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      result.errors.push({ name: file.name, reason: "Too large (max 100 KB)" });
      continue;
    }
    try {
      // STUDIO-018: content-level check — a renamed binary (PNG-as-.csv) must
      // not land in the workspace as mojibake.
      const { decodeTextFile } = await import("./text-validation");
      const content = decodeTextFile(await file.arrayBuffer());
      const created = await createFile({ name: file.name, fileType, folderId, content });
      result.created.push(created);
    } catch (e) {
      result.errors.push({ name: file.name, reason: e instanceof Error ? e.message : "Upload failed" });
    }
  }
  return result;
}

/** Trigger a browser download of a single file's content. */
export function downloadFile(name: string, content: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Zip every file in a folder (client-side, via jszip) and download it. */
export async function downloadFolder(id: string, folderName: string): Promise<void> {
  requireAuth();
  const files = await cloudDownloadFolder(id);
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const f of files) {
    zip.file(f.name, f.content ?? "");
  }
  const blob = await zip.generateAsync({ type: "blob" });
  if (typeof window === "undefined") return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${folderName || "folder"}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}

// Re-export for convenience
export { isCloudAuthenticated, getAuthToken } from "./cloud-api";
