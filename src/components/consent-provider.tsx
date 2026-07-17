"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react";

/** Analytics consent state (WEB-005). `unset` until hydrated from storage. */
export type ConsentState = "granted" | "denied" | "unset";

const STORAGE_KEY = "tqc-analytics-consent";

// Module-level external store. Read via useSyncExternalStore so the value is
// hydration-safe (server always sees "unset") without a setState-in-effect, and
// updates propagate to every subscriber in this tab plus across tabs.
const listeners = new Set<() => void>();
let memoryValue: ConsentState | null = null; // fallback when localStorage is blocked

function readConsent(): ConsentState {
  if (memoryValue) return memoryValue;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "granted" || stored === "denied") return stored;
  } catch {
    // localStorage unavailable (private mode, etc.) — treat as unset.
  }
  return "unset";
}

function writeConsent(value: "granted" | "denied") {
  memoryValue = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Ignore write failures; memoryValue keeps the choice for this session.
  }
  listeners.forEach((notify) => notify());
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) notify();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(notify);
    window.removeEventListener("storage", onStorage);
  };
}

type ConsentContextValue = {
  consent: ConsentState;
  grant: () => void;
  deny: () => void;
};

const ConsentContext = createContext<ConsentContextValue | null>(null);

/**
 * Single-opt-in analytics consent for QuantStudio (WEB-005).
 *
 * Consumers (GatedAnalytics now, the STUDIO-015 PostHog loader later) initialise
 * analytics only when `consent === "granted"`. The value starts `unset` during
 * SSR/first paint and resolves to the stored choice on the client.
 */
export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const consent = useSyncExternalStore<ConsentState>(
    subscribe,
    readConsent,
    () => "unset"
  );
  const grant = useCallback(() => writeConsent("granted"), []);
  const deny = useCallback(() => writeConsent("denied"), []);

  return (
    <ConsentContext.Provider value={{ consent, grant, deny }}>
      {children}
    </ConsentContext.Provider>
  );
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) {
    throw new Error("useConsent must be used within a ConsentProvider");
  }
  return ctx;
}
