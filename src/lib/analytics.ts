// Copyright 2026 TheQuantAI
// Product analytics wrapper (STUDIO-015) — PostHog, consent-gated.
//
// Thin, guarded wrapper over posthog-js so feature code (including plain,
// non-React modules like lib/api.ts) can call track()/identifyUser() without
// importing posthog directly. Every emit is a safe no-op until initAnalytics()
// runs, and init itself no-ops when no project key is configured — so nothing is
// captured without both a key and user consent.

import posthog from "posthog-js";

const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

let initialized = false;

/** True when a PostHog project key is configured (absent in local dev). */
export function analyticsConfigured(): boolean {
  return Boolean(KEY);
}

/** Initialise PostHog once, client-side, only when a key is present. */
export function initAnalytics(): void {
  if (initialized || !KEY || typeof window === "undefined") return;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only", // anon events stay pseudonymous until login
    capture_pageview: false, // App Router SPA — we capture pageviews manually
    capture_pageleave: true,
    disable_session_recording: true, // replay off (STUDIO-015 D3)
    autocapture: true, // clicks only; posthog masks input values by default
    persistence: "localStorage+cookie",
  });
  initialized = true;
}

/** Stop capturing (consent withdrawn). */
export function optOutAnalytics(): void {
  if (!KEY || typeof window === "undefined") return;
  try {
    posthog.opt_out_capturing();
  } catch {
    // posthog not initialised — nothing to opt out of.
  }
}

/** Capture an event. Returns true if it was actually sent (analytics active). */
export function track(event: string, props?: Record<string, unknown>): boolean {
  if (!initialized) return false;
  posthog.capture(event, props);
  return true;
}

export function identifyUser(id: string, props?: Record<string, unknown>): void {
  if (!initialized) return;
  posthog.identify(id, props);
}

export function resetAnalytics(): void {
  if (!initialized) return;
  posthog.reset();
}

export function capturePageview(path: string): void {
  if (!initialized) return;
  posthog.capture("$pageview", { path });
}
