// Copyright 2026 TheQuantAI
// In-context auth gate (STUDIO-014): shown when an anonymous user edits a
// template. Signing up / logging in preserves their in-progress code (stashed
// by the parent before we call Supabase), which is saved as a new circuit on
// return.

"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Atom, Github, Loader2, Mail, X } from "lucide-react";
import { track } from "@/lib/analytics";

const PENDING_SIGNUP_KEY = "tqc-pending-signup";

interface AuthGateModalProps {
  open: boolean;
  onClose: () => void;
  /** Called before any Supabase call so the parent can stash the pending edit. */
  onBeforeAuth: () => void;
}

export function AuthGateModal({ open, onClose, onBeforeAuth }: AuthGateModalProps) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  if (!open) return null;

  const markSignupStarted = (method: "email" | "github") => {
    track("signup_started", { method });
    try {
      localStorage.setItem(PENDING_SIGNUP_KEY, method);
    } catch {
      /* storage unavailable */
    }
  };

  const handleEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    onBeforeAuth();

    if (mode === "signup") {
      markSignupStarted("email");
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/studio` },
      });
      setIsLoading(false);
      if (authError) {
        setError(authError.message);
      } else if (data?.user?.identities?.length === 0) {
        setError("An account with this email already exists — log in instead.");
        setMode("login");
      } else if (!data.session) {
        // Confirmation email sent; the stash (60-min TTL) is restored on return.
        setEmailSent(true);
      }
      // Auto-confirmed (data.session present): the parent's auth effect saves the
      // stashed circuit once signed in.
    } else {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      setIsLoading(false);
      if (authError) setError(authError.message);
    }
  };

  const handleGitHub = async () => {
    onBeforeAuth();
    if (mode === "signup") markSignupStarted("github");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${window.location.origin}/studio` },
    });
    if (authError) setError(authError.message);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Sign up to keep editing"
    >
      <div className="relative w-full max-w-sm rounded-xl border border-border bg-background p-6 shadow-xl">
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        {emailSent ? (
          <div>
            <div className="mb-4 flex items-center gap-2">
              <Mail className="h-6 w-6 text-quantum" />
              <h2 className="text-lg font-semibold">Check your email</h2>
            </div>
            <p className="text-sm text-muted-foreground">
              We sent a confirmation link to <span className="font-medium">{email}</span>. Click it
              to finish signing up — you&apos;ll return here and your circuit will be saved
              automatically.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-4 flex items-center gap-2">
              <Atom className="h-6 w-6 text-quantum" />
              <h2 className="text-lg font-semibold">
                {mode === "signup" ? "Sign up to keep editing" : "Log in to keep editing"}
              </h2>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              Run the templates freely — to edit and save your own circuits, create a free account.
              Your work in progress is kept.
            </p>

            {error && <p className="mb-3 text-sm text-destructive">{error}</p>}

            <form onSubmit={handleEmail} className="space-y-3">
          <input
            type="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            type="password"
            required
            minLength={6}
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <Button type="submit" variant="quantum" className="w-full" disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {mode === "signup" ? "Create account" : "Log in"}
          </Button>
        </form>

        <div className="my-3 text-center text-xs text-muted-foreground">or</div>

        <Button variant="outline" className="w-full" onClick={handleGitHub}>
          <Github className="h-4 w-4" />
          Continue with GitHub
        </Button>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          {mode === "signup" ? "Already have an account?" : "Need an account?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setMode(mode === "signup" ? "login" : "signup");
                }}
                className="text-quantum hover:underline"
              >
                {mode === "signup" ? "Log in" : "Sign up"}
              </button>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
