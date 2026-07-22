// Copyright 2026 TheQuantAI
// STUDIO-019: expanded content of a Dashboard job row.
//  completed          → lazily fetch result + job detail → ResultPanels
//  failed/timeout/cancelled → honest error + timeline
//  queued/running     → truthful waiting note

"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";
import {
  cloudGetJob,
  cloudGetJobResult,
  type CloudJobResponse,
} from "@/lib/cloud-api";
import { diagramFromQasm } from "@/lib/qasm-diagram";
import { ResultPanels, type ResultPanelsData } from "@/components/viz";

// Results are immutable once completed — cache across expand/collapse cycles.
const detailCache = new Map<string, ResultPanelsData>();

export function JobRowDetail({
  job,
  getToken,
}: {
  job: CloudJobResponse;
  getToken: () => string | null;
}) {
  const terminalFailure = ["failed", "timeout", "cancelled"].includes(job.status);
  const completed = job.status === "completed";

  const [data, setData] = useState<ResultPanelsData | null>(
    detailCache.get(job.job_id) ?? null,
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const token = getToken() ?? undefined;
    setLoading(true);
    setError(null);
    try {
      const [result, detail] = await Promise.all([
        cloudGetJobResult(job.job_id, token),
        cloudGetJob(job.job_id, token),
      ]);
      const counts = result.counts ?? {};
      const totalShots = Object.values(counts).reduce((a, b) => a + b, 0);
      const mostLikely = Object.entries(counts).reduce(
        (best, [state, count]) => (count > best[1] ? [state, count] : best),
        ["", 0] as [string, number],
      )[0];
      const built: ResultPanelsData = {
        counts,
        probabilities: result.probabilities ?? {},
        shots: totalShots || job.shots,
        backend: result.backend ?? job.backend ?? "unknown",
        executionTimeSec:
          result.execution_time_ms != null ? result.execution_time_ms / 1000 : null,
        numQubits:
          (result.metadata?.num_qubits as number | undefined) ??
          Object.keys(counts)[0]?.length ??
          0,
        depth: (result.metadata?.transpiled_depth as number | undefined)
          ?? (result.metadata?.circuit_depth as number | undefined)
          ?? null,
        gateCount: (result.metadata?.transpiled_gates as number | undefined)
          ?? (result.metadata?.gate_count as number | undefined)
          ?? null,
        mostLikely,
        diagramText: diagramFromQasm(detail.circuit_qasm),
      };
      detailCache.set(job.job_id, built);
      setData(built);
    } catch (e) {
      const status = (e as { status?: number }).status;
      setError(
        status === 404
          ? "Result unavailable for this job."
          : e instanceof Error
            ? e.message
            : "Could not load the result.",
      );
    } finally {
      setLoading(false);
    }
  }, [job, getToken]);

  useEffect(() => {
    if (completed && !data && !loading && !error) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completed]);

  // ── Pending states ──
  if (!completed && !terminalFailure) {
    return (
      <Note icon={<Clock className="h-4 w-4 shrink-0 text-yellow-500" />}>
        {job.status === "queued" && job.backend?.startsWith("ibm_")
          ? "Queued at IBM — free-plan queues can take minutes to hours, and the job is auto-cancelled if it hasn't started within 6 hours. The result will appear here when it completes."
          : "This job is still in progress. The result will appear here when it completes."}
      </Note>
    );
  }

  // ── Terminal failures: honest error + timeline ──
  if (terminalFailure) {
    return (
      <div className="space-y-2 rounded-md border border-border bg-background p-3 text-xs">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <p className="text-red-400">
            {job.error_message ||
              (job.status === "timeout"
                ? "The job was auto-cancelled after waiting too long in the provider queue. No result exists."
                : `Job ${job.status}.`)}
          </p>
        </div>
        <Timeline job={job} />
      </div>
    );
  }

  // ── Completed ──
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-md border border-border bg-background py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-xs">
        <span className="text-muted-foreground">{error}</span>
        <button
          onClick={() => void load()}
          className="rounded border border-border px-2 py-1 hover:bg-accent"
        >
          Retry
        </button>
      </div>
    );
  }
  return data ? <ResultPanels data={data} /> : null;
}

function Note({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-border bg-background p-3 text-xs text-muted-foreground">
      {icon}
      <p>{children}</p>
    </div>
  );
}

function Timeline({ job }: { job: CloudJobResponse }) {
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString() : "—");
  const waited =
    job.completed_at && job.submitted_at
      ? Math.round(
          (new Date(job.completed_at).getTime() - new Date(job.submitted_at).getTime()) / 60000,
        )
      : null;
  return (
    <div className="grid grid-cols-1 gap-1 text-muted-foreground sm:grid-cols-3">
      <span>Submitted: {fmt(job.submitted_at)}</span>
      <span>Started: {fmt(job.started_at)}</span>
      <span>
        Ended: {fmt(job.completed_at)}
        {waited !== null && ` (after ${waited >= 60 ? `${(waited / 60).toFixed(1)}h` : `${waited}min`})`}
      </span>
    </div>
  );
}
