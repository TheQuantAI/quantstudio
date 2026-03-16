"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { CLOUD_API_URL, isCloudAuthenticated, cloudHealthCheck } from "@/lib/cloud-api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Atom,
  Check,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Copy,
  Key,
  Loader2,
  LogIn,
  Plus,
  Server,
  Shield,
  Terminal,
  Zap,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { useState, useEffect, useCallback } from "react";

// ─── Step indicator ──────────────────────────────────────────────

type StepStatus = "pending" | "active" | "done";

function StepBadge({ step, status }: { step: number; status: StepStatus }) {
  if (status === "done") {
    return (
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
        <Check className="h-4 w-4 text-green-500" />
      </div>
    );
  }
  return (
    <div
      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
        status === "active"
          ? "bg-quantum/20 border-quantum text-quantum"
          : "bg-muted border-border text-muted-foreground"
      }`}
    >
      {step}
    </div>
  );
}

// ─── Main page ───────────────────────────────────────────────────

export default function ConnectPage() {
  const router = useRouter();
  const { user, session, isLoading: authLoading, getAccessToken } = useAuth();

  // Step tracking
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [checkingApi, setCheckingApi] = useState(true);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [apiKeyName, setApiKeyName] = useState("default");
  const [generatingKey, setGeneratingKey] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [existingKeys, setExistingKeys] = useState<Array<{ id: string; name: string; key_prefix: string; created_at: string }>>([]);
  const [loadingKeys, setLoadingKeys] = useState(false);

  // ─── Step 1: Check cloud API health ────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setCheckingApi(true);
      try {
        const data = await cloudHealthCheck();
        if (!cancelled) setApiHealthy(data?.status === "healthy");
      } catch {
        if (!cancelled) setApiHealthy(false);
      } finally {
        if (!cancelled) setCheckingApi(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // ─── Load existing API keys once authenticated ─────────────────
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      setLoadingKeys(true);
      try {
        const token = await getAccessToken();
        const res = await fetch(`${CLOUD_API_URL}/v1/auth/api-keys`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setExistingKeys(data.api_keys || []);
        }
      } catch { /* ignore */ }
      finally { if (!cancelled) setLoadingKeys(false); }
    })();
    return () => { cancelled = true; };
  }, [session, getAccessToken]);

  // ─── Generate API key ──────────────────────────────────────────
  const handleGenerateKey = useCallback(async () => {
    setGeneratingKey(true);
    setApiKey(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${CLOUD_API_URL}/v1/auth/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: apiKeyName || "quantstudio" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setApiKey(data.key);
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Failed to generate key");
    } finally {
      setGeneratingKey(false);
    }
  }, [getAccessToken, apiKeyName]);

  // ─── Copy API key ──────────────────────────────────────────────
  const handleCopyKey = useCallback(async () => {
    if (!apiKey) return;
    await navigator.clipboard.writeText(apiKey);
    setKeyCopied(true);
    setTimeout(() => setKeyCopied(false), 2000);
  }, [apiKey]);

  // ─── Step 3: Verify connection ─────────────────────────────────
  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const token = await getAccessToken();
      const res = await fetch(`${CLOUD_API_URL}/v1/account/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.tier) {
        setVerified(true);
      } else {
        throw new Error("Unexpected response");
      }
    } catch (err) {
      setVerifyError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  }, [getAccessToken]);

  // ─── Step status derivation ────────────────────────────────────
  const isAuthenticated = !!user;
  const hasApiKey = !!apiKey || existingKeys.length > 0;

  const step1Status: StepStatus = apiHealthy ? "done" : checkingApi ? "active" : "active";
  const step2Status: StepStatus = isAuthenticated
    ? "done"
    : apiHealthy
    ? "active"
    : "pending";
  const step3Status: StepStatus = hasApiKey
    ? "done"
    : isAuthenticated
    ? "active"
    : "pending";
  const step4Status: StepStatus = verified
    ? "done"
    : hasApiKey
    ? "active"
    : "pending";

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-b from-quantum/5 via-background to-background">
      {/* Hero header */}
      <div className="container mx-auto px-4 md:px-6 pt-12 pb-8">
        <div className="max-w-3xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Cloud className="h-8 w-8 text-quantum" />
            <Zap className="h-5 w-5 text-amber-400" />
            <Server className="h-8 w-8 text-quantum" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Connect to <span className="text-quantum">TheQuantCloud</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Link your QuantStudio IDE to the cloud platform for remote execution,
            circuit storage, usage tracking, and access to real QPU backends.
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="container mx-auto px-4 md:px-6 pb-16">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* ── Step 1: API Status ────────────────────────────────── */}
          <Card className={step1Status === "active" ? "border-quantum/50" : ""}>
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <StepBadge step={1} status={step1Status} />
              <div className="flex-1">
                <CardTitle className="text-lg">Cloud API Status</CardTitle>
                <CardDescription>
                  Check that TheQuantCloud API is online and reachable
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pl-16">
              {checkingApi ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking {CLOUD_API_URL}...
                </div>
              ) : apiHealthy ? (
                <div className="flex items-center gap-2 text-sm text-green-500">
                  <CheckCircle2 className="h-4 w-4" />
                  API is online at <code className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{CLOUD_API_URL}</code>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <span className="inline-block w-2 h-2 rounded-full bg-destructive" />
                    API is unreachable
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setCheckingApi(true);
                      cloudHealthCheck()
                        .then((d) => { setApiHealthy(d?.status === "healthy"); setCheckingApi(false); })
                        .catch(() => { setApiHealthy(false); setCheckingApi(false); });
                    }}
                    className="gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Step 2: Authentication ────────────────────────────── */}
          <Card className={step2Status === "active" ? "border-quantum/50" : ""}>
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <StepBadge step={2} status={step2Status} />
              <div className="flex-1">
                <CardTitle className="text-lg">Sign In</CardTitle>
                <CardDescription>
                  Authenticate with your TheQuantCloud account
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pl-16">
              {authLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Checking authentication...
                </div>
              ) : isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Signed in as <strong>{user?.email}</strong>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Sign in or create a free account to get started. 
                    Free tier: 60 min simulator time, $50 credits, 10 QPU tasks/month.
                  </p>
                  <div className="flex gap-3">
                    <Link href="/login?callbackUrl=/connect">
                      <Button variant="quantum" size="sm" className="gap-1.5">
                        <LogIn className="h-3.5 w-3.5" />
                        Sign In
                      </Button>
                    </Link>
                    <Link href="/signup">
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <Plus className="h-3.5 w-3.5" />
                        Create Account
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Step 3: API Key ───────────────────────────────────── */}
          <Card className={step3Status === "active" ? "border-quantum/50" : ""}>
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <StepBadge step={3} status={step3Status} />
              <div className="flex-1">
                <CardTitle className="text-lg">Generate an API Key</CardTitle>
                <CardDescription>
                  Create an API key for QuantSDK access from Python scripts and notebooks
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pl-16">
              {!isAuthenticated ? (
                <p className="text-sm text-muted-foreground">Complete Step 2 first</p>
              ) : (
                <div className="space-y-4">
                  {/* Existing keys */}
                  {loadingKeys ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading existing keys...
                    </div>
                  ) : existingKeys.length > 0 && !apiKey && (
                    <div className="space-y-2">
                      <p className="text-sm text-green-500 flex items-center gap-1.5">
                        <Shield className="h-3.5 w-3.5" />
                        You have {existingKeys.length} active API key{existingKeys.length > 1 ? "s" : ""}
                      </p>
                      <div className="space-y-1">
                        {existingKeys.map((k) => (
                          <div key={k.id} className="flex items-center gap-2 text-xs text-muted-foreground font-mono bg-muted rounded px-2 py-1">
                            <Key className="h-3 w-3" />
                            {k.key_prefix}••••••••
                            <span className="text-muted-foreground/50 ml-auto">{k.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Generated key display */}
                  {apiKey && (
                    <div className="space-y-2">
                      <p className="text-sm text-green-500 font-medium flex items-center gap-1.5">
                        <CheckCircle2 className="h-4 w-4" />
                        API key generated!
                      </p>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-muted border border-border rounded px-3 py-2 select-all break-all">
                          {apiKey}
                        </code>
                        <Button variant="outline" size="icon" onClick={handleCopyKey}>
                          {keyCopied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-amber-500">
                        ⚠ Copy this key now — it won&apos;t be shown again.
                      </p>
                    </div>
                  )}

                  {/* Generate new key form */}
                  {!apiKey && (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={apiKeyName}
                        onChange={(e) => setApiKeyName(e.target.value)}
                        placeholder="Key name (e.g. my-laptop)"
                        className="flex-1 text-sm rounded-md border border-input bg-background px-3 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                      <Button
                        variant="quantum"
                        size="sm"
                        onClick={handleGenerateKey}
                        disabled={generatingKey}
                        className="gap-1.5"
                      >
                        {generatingKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Key className="h-3.5 w-3.5" />
                        )}
                        Generate Key
                      </Button>
                    </div>
                  )}

                  {verifyError && (
                    <p className="text-sm text-destructive">{verifyError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── Step 4: Verify ────────────────────────────────────── */}
          <Card className={step4Status === "active" ? "border-quantum/50" : ""}>
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <StepBadge step={4} status={step4Status} />
              <div className="flex-1">
                <CardTitle className="text-lg">Verify Connection</CardTitle>
                <CardDescription>
                  Confirm your account is fully connected and ready to use
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="pl-16">
              {!hasApiKey ? (
                <p className="text-sm text-muted-foreground">Complete Step 3 first</p>
              ) : verified ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-green-500">
                    <CheckCircle2 className="h-4 w-4" />
                    Connection verified! Your account is ready.
                  </div>
                  <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-3">
                    <p className="text-sm font-medium">Quick Start — QuantSDK</p>
                    <div className="rounded-md bg-background border border-border p-3 font-mono text-xs overflow-x-auto">
                      <div className="text-muted-foreground"># Install QuantSDK</div>
                      <div>pip install thequantsdk</div>
                      <div className="mt-2 text-muted-foreground"># Set your API key</div>
                      <div>export QUANTCLOUD_API_KEY=&quot;{apiKey || "qc_your_key_here"}&quot;</div>
                      <div className="mt-2 text-muted-foreground"># Run a circuit on the cloud</div>
                      <div className="text-blue-400">import</div> <span className="text-green-400">quantsdk</span> <span className="text-blue-400">as</span> <span className="text-green-400">qs</span>
                      <div className="mt-1">circuit = qs.Circuit(2).h(0).cx(0, 1).measure_all()</div>
                      <div>result = qs.run(circuit, backend=<span className="text-yellow-400">&quot;aer_simulator&quot;</span>)</div>
                      <div>print(result.counts)</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <Button
                    variant="quantum"
                    size="sm"
                    onClick={handleVerify}
                    disabled={verifying}
                    className="gap-1.5"
                  >
                    {verifying ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Zap className="h-3.5 w-3.5" />
                    )}
                    Verify Connection
                  </Button>
                  {verifyError && (
                    <p className="text-sm text-destructive">{verifyError}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── All done CTA ──────────────────────────────────────── */}
          {verified && (
            <div className="text-center pt-4 space-y-4">
              <div className="flex items-center justify-center gap-2 text-green-500 text-lg font-semibold">
                <CheckCircle2 className="h-6 w-6" />
                You&apos;re connected to TheQuantCloud!
              </div>
              <div className="flex justify-center gap-3">
                <Link href="/studio">
                  <Button variant="quantum" className="gap-2">
                    <Terminal className="h-4 w-4" />
                    Open Studio
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" className="gap-2">
                    <Atom className="h-4 w-4" />
                    Dashboard
                  </Button>
                </Link>
                <a href="https://docs.thequantcloud.com" target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" className="gap-2">
                    Docs
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
