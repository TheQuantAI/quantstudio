// Copyright 2026 TheQuantAI
// STUDIO-019: persisted marker for a pending QPU job. React state alone dies
// with the tab, which made results unreachable when IBM finished after the
// in-page poll window — this marker lets a reopened Studio resume watching.
// (Pattern follows lib/pending-circuit.ts: stash / read-with-expiry / clear.)

export interface PendingQPUJob {
  jobId: string;
  backend: string;
  submittedAt: string; // ISO
}

const KEY = "tqc-pending-qpu-job";
// Server auto-cancels at 6h; 7 days is a pure backstop against stuck markers.
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function stashPendingQPU(job: PendingQPUJob): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(job));
  } catch {
    /* storage unavailable — resume just won't work this session */
  }
}

export function readPendingQPU(): PendingQPUJob | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const job = JSON.parse(raw) as PendingQPUJob;
    if (
      typeof job?.jobId !== "string" ||
      typeof job?.backend !== "string" ||
      typeof job?.submittedAt !== "string"
    ) {
      clearPendingQPU();
      return null;
    }
    const age = Date.now() - new Date(job.submittedAt).getTime();
    if (!Number.isFinite(age) || age > MAX_AGE_MS) {
      clearPendingQPU();
      return null;
    }
    return job;
  } catch {
    clearPendingQPU();
    return null;
  }
}

export function clearPendingQPU(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
