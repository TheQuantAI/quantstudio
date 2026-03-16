"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Atom, Github, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { useState, useEffect } from "react";

export default function SignupPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);

  // Redirect if already authenticated
  useEffect(() => {
    if (user) router.push("/studio");
  }, [user, router]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/studio`,
      },
    });

    setIsLoading(false);

    if (authError) {
      setError(authError.message);
    } else if (data?.user?.identities?.length === 0) {
      // User already exists with this email
      setError("An account with this email already exists. Please sign in instead.");
    } else if (data?.session) {
      // Auto-confirmed (mailer_autoconfirm enabled) — redirect immediately
      router.push("/studio");
    } else {
      // Confirmation email sent; show success screen
      setEmailSent(true);
    }
  };

  const handleGitHubSignup = async () => {
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/studio`,
      },
    });
    if (authError) setError(authError.message);
  };

  if (emailSent) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-2" />
            <CardTitle className="text-2xl">Check Your Email</CardTitle>
            <CardDescription>
              We sent a confirmation link to <strong>{email}</strong>.
              Click the link to activate your account and start building
              quantum circuits.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Didn&apos;t receive it? Check your spam folder or{" "}
              <button
                onClick={() => setEmailSent(false)}
                className="text-quantum hover:underline"
              >
                try again
              </button>.
            </p>
            <Link href="/login">
              <Button variant="outline">Back to Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Atom className="h-10 w-10 mx-auto text-quantum mb-2" />
          <CardTitle className="text-2xl">Create Your Account</CardTitle>
          <CardDescription>
            Get started with QuantStudio — free tier includes 60 min simulator
            time, $50 credits, and 10 QPU tasks/month
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* GitHub OAuth — recommended for instant access */}
          <Button
            variant="quantum"
            className="w-full gap-2"
            onClick={handleGitHubSignup}
            disabled={isLoading}
          >
            <Github className="h-4 w-4" />
            Sign up with GitHub
            <span className="ml-1 text-[10px] font-normal opacity-80">
              (Recommended)
            </span>
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
          <form onSubmit={handleSignup} className="space-y-3">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Full Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Saket"
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                required
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
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
              <label htmlFor="password" className="block text-sm font-medium mb-1">
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
            <Button
              type="submit"
              variant="outline"
              className="w-full gap-2"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            By creating an account, you agree to our Terms of Service and Privacy Policy.
          </p>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-quantum hover:underline">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
