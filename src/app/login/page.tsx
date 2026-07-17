"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Atom, Github, Mail, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, Suspense } from "react";
import { Captcha, type CaptchaHandle, isCaptchaConfigured } from "@/components/captcha";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/studio";
  const { user } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState("");
  const captchaRef = useRef<CaptchaHandle>(null);
  const captchaMissing = isCaptchaConfigured() && !captchaToken;
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [resendMsg, setResendMsg] = useState<string | null>(null);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) {
      router.push(callbackUrl);
    }
  }, [user, router, callbackUrl]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setUnconfirmed(false);
    setResendMsg(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
      options: { captchaToken: captchaToken || undefined },
    });

    captchaRef.current?.reset();
    setCaptchaToken("");

    if (authError) {
      // Supabase returns an "Email not confirmed" error for unconfirmed accounts.
      if (/confirm/i.test(authError.message)) {
        setUnconfirmed(true);
      } else {
        setError(authError.message);
      }
      setIsLoading(false);
    } else {
      router.push(callbackUrl);
      router.refresh();
    }
  };

  const handleResendConfirmation = async () => {
    setResendMsg(null);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
    setResendMsg(
      resendError
        ? resendError.message
        : "Confirmation email sent — check your inbox, then log in.",
    );
  };

  const handleGitHubLogin = async () => {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}${callbackUrl}`,
      },
    });
    if (authError) {
      setError(authError.message);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Atom className="h-10 w-10 mx-auto text-quantum mb-2" />
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Sign in to QuantStudio to continue building quantum circuits
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {unconfirmed && (
            <div className="rounded-md bg-amber-500/10 border border-amber-500/20 px-3 py-2 text-sm">
              <p className="mb-2">Please confirm your email before logging in.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendConfirmation}
              >
                Resend confirmation email
              </Button>
              {resendMsg && <p className="mt-2 text-muted-foreground">{resendMsg}</p>}
            </div>
          )}

          {/* GitHub OAuth — recommended */}
          <Button
            variant="quantum"
            className="w-full gap-2"
            onClick={handleGitHubLogin}
            disabled={isLoading}
          >
            <Github className="h-4 w-4" />
            Continue with GitHub
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">or</span>
            </div>
          </div>

          {/* Email form */}
          <form onSubmit={handleEmailLogin} className="space-y-3">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
                minLength={6}
              />
            </div>
            <Captcha ref={captchaRef} onVerify={setCaptchaToken} />
            <Button
              type="submit"
              variant="outline"
              className="w-full gap-2"
              disabled={isLoading || captchaMissing}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="text-quantum hover:underline">
              Sign up
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-quantum" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
