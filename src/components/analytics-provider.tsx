// Copyright 2026 TheQuantAI
// Consent-gated product analytics wiring (STUDIO-015).

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useConsent } from "@/components/consent-provider";
import { useAuth } from "@/components/auth-provider";
import {
  capturePageview,
  identifyUser,
  initAnalytics,
  optOutAnalytics,
  resetAnalytics,
  track,
} from "@/lib/analytics";

const SEEN_KEY = "tqc-seen";
const PENDING_SIGNUP_KEY = "tqc-pending-signup";

/**
 * Wires PostHog to consent + auth (STUDIO-015):
 * - inits only once consent is `granted`, opts out on `denied`;
 * - captures SPA pageviews and a one-time `return_visit`;
 * - `identify()`s on login / `reset()`s on logout;
 * - emits `signup_completed` when a login follows a pending signup.
 */
export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const { consent } = useConsent();
  const { user } = useAuth();
  const pathname = usePathname();
  const startedRef = useRef(false);
  const prevUserIdRef = useRef<string | null>(null);

  // Init + pageviews, gated on consent.
  useEffect(() => {
    if (consent === "denied") {
      optOutAnalytics();
      return;
    }
    if (consent !== "granted") return;

    if (!startedRef.current) {
      initAnalytics();
      startedRef.current = true;
      try {
        if (window.localStorage.getItem(SEEN_KEY)) track("return_visit");
        window.localStorage.setItem(SEEN_KEY, "1");
      } catch {
        // localStorage unavailable — skip return-visit detection.
      }
    }
    capturePageview(pathname);
  }, [consent, pathname]);

  // Identity: identify on login, reset on logout, emit signup_completed once.
  useEffect(() => {
    if (consent !== "granted" || !startedRef.current) return;
    const uid = user?.id ?? null;

    if (uid && uid !== prevUserIdRef.current) {
      identifyUser(uid, { email: user?.email ?? undefined });
      try {
        const method = window.localStorage.getItem(PENDING_SIGNUP_KEY);
        if (method) {
          track("signup_completed", { method });
          window.localStorage.removeItem(PENDING_SIGNUP_KEY);
        }
      } catch {
        // ignore storage errors
      }
    } else if (!uid && prevUserIdRef.current) {
      resetAnalytics();
    }
    prevUserIdRef.current = uid;
  }, [user, consent]);

  return <>{children}</>;
}
