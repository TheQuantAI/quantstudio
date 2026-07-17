"use client";

import { Button } from "@/components/ui/button";
import { useConsent } from "@/components/consent-provider";

/**
 * One-time analytics consent banner (WEB-005). Visible only while consent is
 * `unset`; the choice persists via ConsentProvider. Analytics stays off until
 * the user accepts.
 */
export function ConsentBanner() {
  const { consent, grant, deny } = useConsent();
  if (consent !== "unset") return null;

  return (
    <div
      role="dialog"
      aria-label="Analytics consent"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80"
    >
      <div className="container mx-auto flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
        <p className="text-sm text-muted-foreground">
          We use privacy-friendly product analytics to improve QuantStudio. You can accept or
          decline — see our{" "}
          <a
            href="https://thequantcloud.com/privacy"
            className="text-quantum hover:underline"
          >
            Privacy Policy
          </a>
          .
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" onClick={deny}>
            Decline
          </Button>
          <Button variant="quantum" size="sm" onClick={grant}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
