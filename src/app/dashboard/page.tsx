"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth-provider";
import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Code2,
  Cpu,
  Clock,
  DollarSign,
  BarChart3,
  FileCode2,
  LogIn,
  Key,
  Copy,
  Check,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { listCircuits, type CircuitResponse } from "@/lib/api";
import type {
  CloudUsage,
  CloudJobResponse,
} from "@/lib/cloud-api";
import {
  cloudGetUsage,
  cloudListJobs,
  cloudListCircuits as cloudListCircuitsFn,
} from "@/lib/cloud-api";

// ─── API Keys management ────────────────────────────────────────

interface APIKeyInfo {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
}

export default function DashboardPage() {
  const { user, isLoading: authLoading, getAccessToken } = useAuth();

  const [myCircuits, setMyCircuits] = useState<CircuitResponse[]>([]);
  const [usage, setUsage] = useState<CloudUsage | null>(null);
  const [jobs, setJobs] = useState<CloudJobResponse[]>([]);
  const [apiKeys, setApiKeys] = useState<APIKeyInfo[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [isCreatingKey, setIsCreatingKey] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);

  // Load dashboard data when authenticated
  const loadData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setDataLoading(true);
    try {
      const [usageRes, jobsRes, circuitsRes, keysRes] = await Promise.allSettled([
        cloudGetUsage(token),
        cloudListJobs(token, undefined, 10),
        cloudListCircuitsFn(token),
        fetchApiKeys(token),
      ]);
      if (usageRes.status === "fulfilled") setUsage(usageRes.value);
      if (jobsRes.status === "fulfilled") setJobs(jobsRes.value);
      if (circuitsRes.status === "fulfilled") {
        setMyCircuits(circuitsRes.value.map((c) => ({
          id: c.id, name: c.name, code: c.code,
          description: "", user_id: c.user_id,
          created_at: c.created_at, updated_at: c.updated_at,
        })));
      }
      if (keysRes.status === "fulfilled") setApiKeys(keysRes.value);
    } catch {
      // Silently handle errors — partial data is fine
    } finally {
      setDataLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    if (user) loadData();
    else setDataLoading(false);
  }, [user, loadData]);

  // ─── API key helpers ──────────────────────────────────────

  async function fetchApiKeys(token: string): Promise<APIKeyInfo[]> {
    const { CLOUD_API_URL } = await import("@/lib/cloud-api");
    const res = await fetch(`${CLOUD_API_URL}/v1/auth/api-keys`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [];
    return res.json();
  }

  const handleCreateKey = async () => {
    const token = getAccessToken();
    if (!token) return;
    setIsCreatingKey(true);
    try {
      const { CLOUD_API_URL } = await import("@/lib/cloud-api");
      const res = await fetch(`${CLOUD_API_URL}/v1/auth/api-keys`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: newKeyName || "default" }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedKey(data.key);
        setNewKeyName("");
        // Refresh key list
        fetchApiKeys(token).then(setApiKeys);
      }
    } finally {
      setIsCreatingKey(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    const token = getAccessToken();
    if (!token) return;
    const { CLOUD_API_URL } = await import("@/lib/cloud-api");
    await fetch(`${CLOUD_API_URL}/v1/auth/api-keys/${keyId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
  };

  const copyKey = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  // ─── Unauthenticated view ─────────────────────────────────

  if (!authLoading && !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
        <LogIn className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your dashboard</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          Track your circuit executions, monitor usage, manage API keys, and view saved circuits.
        </p>
        <Link href="/login?callbackUrl=/dashboard">
          <Button variant="quantum" className="gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
        </Link>
      </div>
    );
  }

  if (authLoading || dataLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-quantum" />
      </div>
    );
  }

  // ─── Stats ────────────────────────────────────────────────

  const stats = {
    circuitsSaved: myCircuits.length,
    totalJobs: jobs.length,
    simulatorMinutes: usage?.simulator_minutes_used ?? 0,
    simulatorLimit: usage?.simulator_minutes_limit ?? 60,
    qpuTasksUsed: usage?.qpu_tasks_used ?? 0,
    qpuTasksLimit: usage?.qpu_tasks_limit ?? 10,
    credits: usage?.credits_remaining_usd ?? 50,
    tier: usage?.tier ?? "explorer",
  };

  // ─── Job status helpers ───────────────────────────────────

  function jobStatusColor(status: string) {
    switch (status) {
      case "completed": return "bg-green-500";
      case "failed": case "timeout": return "bg-red-500";
      case "running": case "dispatched": return "bg-blue-500 animate-pulse";
      case "cancelled": return "bg-gray-500";
      default: return "bg-yellow-500";
    }
  }

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {user?.name ? `Welcome, ${user.name}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            Your quantum computing usage and recent activity.
            <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-quantum/10 text-quantum font-medium uppercase">
              {stats.tier}
            </span>
          </p>
        </div>
        <Link href="/studio">
          <Button variant="quantum" className="gap-2">
            <Code2 className="h-4 w-4" />
            New Circuit
          </Button>
        </Link>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <FileCode2 className="h-5 w-5 text-quantum mb-2" />
            <p className="text-2xl font-bold">{stats.circuitsSaved}</p>
            <p className="text-xs text-muted-foreground">Circuits Saved</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <BarChart3 className="h-5 w-5 text-quantum mb-2" />
            <p className="text-2xl font-bold">{stats.totalJobs}</p>
            <p className="text-xs text-muted-foreground">Total Jobs</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Clock className="h-5 w-5 text-quantum mb-2" />
            <p className="text-2xl font-bold">
              {stats.simulatorMinutes.toFixed(1)}m
            </p>
            <p className="text-xs text-muted-foreground">
              Simulator Time Used
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <Cpu className="h-5 w-5 text-quantum mb-2" />
            <p className="text-2xl font-bold">{stats.qpuTasksUsed}</p>
            <p className="text-xs text-muted-foreground">QPU Tasks Used</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <DollarSign className="h-5 w-5 text-quantum mb-2" />
            <p className="text-2xl font-bold">
              ${stats.credits.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Credits Remaining</p>
          </CardContent>
        </Card>
      </div>

      {/* Usage bars */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Simulator Usage</CardTitle>
            <CardDescription>
              {stats.simulatorMinutes.toFixed(1)} / {stats.simulatorLimit} minutes this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-quantum rounded-full transition-all"
                style={{
                  width: `${Math.min((stats.simulatorMinutes / stats.simulatorLimit) * 100, 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">QPU Tasks</CardTitle>
            <CardDescription>
              {stats.qpuTasksUsed} / {stats.qpuTasksLimit} tasks this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-quantum rounded-full transition-all"
                style={{
                  width: `${Math.min((stats.qpuTasksUsed / stats.qpuTasksLimit) * 100, 100)}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* API Keys section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Key className="h-4 w-4" />
            API Keys
          </CardTitle>
          <CardDescription>
            Generate API keys for use with the QuantSDK Python client
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Created key banner */}
          {createdKey && (
            <div className="mb-4 rounded-md bg-green-500/10 border border-green-500/20 px-4 py-3">
              <p className="text-sm font-medium text-green-600 mb-1">
                API key created! Copy it now — it won&apos;t be shown again.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-background px-2 py-1 rounded border break-all">
                  {createdKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0"
                  onClick={copyKey}
                >
                  {copiedKey ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          )}

          {/* Create new key */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="Key name (e.g. laptop, CI)"
              className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button
              variant="quantum"
              size="sm"
              className="gap-1"
              onClick={handleCreateKey}
              disabled={isCreatingKey}
            >
              {isCreatingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
              Generate
            </Button>
          </div>

          {/* Key list */}
          {apiKeys.length > 0 ? (
            <div className="space-y-2">
              {apiKeys.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md bg-muted/50"
                >
                  <div>
                    <p className="text-sm font-medium">{k.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {k.key_prefix}••••••••
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteKey(k.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No API keys yet. Generate one to use with <code className="text-xs">pip install quantsdk</code>.
            </p>
          )}

          {/* Usage hint */}
          <div className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <strong>Usage:</strong>{" "}
            <code>export QUANTCLOUD_API_KEY=&quot;qc_live_...&quot;</code> then{" "}
            <code>from quantsdk.cloud import CloudClient</code>
          </div>
        </CardContent>
      </Card>

      {/* Recent jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Jobs</CardTitle>
          <CardDescription>
            Your latest circuit executions on TheQuantCloud
          </CardDescription>
        </CardHeader>
        <CardContent>
          {jobs.length > 0 ? (
            <div className="space-y-3">
              {jobs.map((job) => (
                <div
                  key={job.job_id}
                  className="flex items-center justify-between py-2 border-b border-border last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${jobStatusColor(job.status)}`} />
                    <div>
                      <p className="text-sm font-medium capitalize">{job.status}</p>
                      <p className="text-xs text-muted-foreground">
                        {job.backend ?? "auto"} · {job.shots} shots
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <code className="text-xs font-mono text-muted-foreground">
                      {job.job_id.slice(0, 8)}
                    </code>
                    <p className="text-xs text-muted-foreground">
                      {timeAgo(job.submitted_at)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No jobs yet. Run a circuit from the{" "}
              <Link href="/studio" className="text-quantum hover:underline">
                Studio
              </Link>{" "}
              or via the QuantSDK.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
