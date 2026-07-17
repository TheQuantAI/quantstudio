// Copyright 2026 TheQuantAI
// hCaptcha wrapper (STUDIO-016). Renders the widget only when a site key is
// configured; without one (local dev) it renders nothing and reset() is a no-op,
// so callers work unchanged in both environments.

"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import HCaptcha from "@hcaptcha/react-hcaptcha";

export const SITE_KEY = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY;

/** True when an hCaptcha site key is configured (captcha is enforced). */
export function isCaptchaConfigured(): boolean {
  return Boolean(SITE_KEY);
}

export interface CaptchaHandle {
  reset: () => void;
}

interface CaptchaProps {
  /** Receives the verification token; "" when the challenge expires or errors. */
  onVerify: (token: string) => void;
}

export const Captcha = forwardRef<CaptchaHandle, CaptchaProps>(function Captcha(
  { onVerify },
  ref,
) {
  const inner = useRef<HCaptcha>(null);

  useImperativeHandle(ref, () => ({
    reset: () => inner.current?.resetCaptcha(),
  }));

  if (!SITE_KEY) return null;

  return (
    <div className="flex justify-center">
      <HCaptcha
        ref={inner}
        sitekey={SITE_KEY}
        onVerify={(token) => onVerify(token)}
        onExpire={() => onVerify("")}
        onError={() => onVerify("")}
      />
    </div>
  );
});
