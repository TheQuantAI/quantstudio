// Copyright 2026 TheQuantAI
// Stash the anonymous user's in-progress circuit across a Supabase auth redirect
// (STUDIO-014). Written before login; popped once the user returns authenticated
// so their edit survives an OAuth/email round-trip and is saved as a new circuit.

const KEY = "tqc-pending-circuit";
const TTL_MS = 60 * 60 * 1000; // 60 min — ignore anything older to avoid clobbering real work

export interface PendingCircuit {
  code: string;
  name: string;
  forkedFrom: { id: string; name: string } | null;
}

export function stashPendingCircuit(p: PendingCircuit): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() }));
  } catch {
    // storage unavailable — the edit stays in the store for same-tab logins
  }
}

/** Read and clear the stash. Returns null if absent, malformed, or stale. */
export function popPendingCircuit(): PendingCircuit | null {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
    if (raw) localStorage.removeItem(KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PendingCircuit & { at?: number };
    if (!parsed.at || Date.now() - parsed.at > TTL_MS) return null;
    if (typeof parsed.code !== "string") return null;
    return { code: parsed.code, name: parsed.name, forkedFrom: parsed.forkedFrom ?? null };
  } catch {
    return null;
  }
}
