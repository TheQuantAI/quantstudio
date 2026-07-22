// Copyright 2026 TheQuantAI
// STUDIO-019 T2: pending-QPU marker round-trip + expiry (AC5, AC6).

import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearPendingQPU, readPendingQPU, stashPendingQPU } from "./qpu-pending";

// vitest node env has no localStorage — provide a minimal one.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

const job = { jobId: "j-1", backend: "ibm_fez", submittedAt: new Date().toISOString() };

describe("qpu-pending marker", () => {
  it("stash → read round-trips", () => {
    stashPendingQPU(job);
    expect(readPendingQPU()).toEqual(job);
  });

  it("clear removes it", () => {
    stashPendingQPU(job);
    clearPendingQPU();
    expect(readPendingQPU()).toBeNull();
  });

  it("self-expires after 7 days (and clears)", () => {
    const old = new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString();
    stashPendingQPU({ ...job, submittedAt: old });
    expect(readPendingQPU()).toBeNull();
    expect(store.size).toBe(0);
  });

  it("corrupt JSON and malformed shapes → null + cleared", () => {
    store.set("tqc-pending-qpu-job", "{not json");
    expect(readPendingQPU()).toBeNull();
    store.set("tqc-pending-qpu-job", JSON.stringify({ jobId: 42 }));
    expect(readPendingQPU()).toBeNull();
    expect(store.size).toBe(0);
  });
});
