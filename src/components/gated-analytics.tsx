"use client";

import { Analytics } from "@vercel/analytics/react";
import { useConsent } from "@/components/consent-provider";

/** Vercel Analytics, mounted only once the user grants analytics consent (WEB-005). */
export function GatedAnalytics() {
  const { consent } = useConsent();
  if (consent !== "granted") return null;
  return <Analytics />;
}
