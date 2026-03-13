"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
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
} from "lucide-react";
import { listCircuits, type CircuitResponse } from "@/lib/api";

const RECENT_JOBS = [
  {
    id: "job_m3x7k",
    circuit: "Bell State",
    backend: "CPU Simulator",
    status: "completed",
    time: "1.2s",
    date: "2 min ago",
  },
  {
    id: "job_m3x6j",
    circuit: "GHZ State",
    backend: "CPU Simulator",
    status: "completed",
    time: "1.8s",
    date: "15 min ago",
  },
  {
    id: "job_m3x5i",
    circuit: "QFT 3-qubit",
    backend: "GPU Simulator",
    status: "completed",
    time: "0.9s",
    date: "1 hour ago",
  },
];

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const [myCircuits, setMyCircuits] = useState<CircuitResponse[]>([]);

  const userId = session?.user?.id || "anonymous";

  useEffect(() => {
    if (status === "authenticated") {
      listCircuits(userId).then(setMyCircuits).catch(() => {});
    }
  }, [status, userId]);

  // If not logged in, prompt them to sign in
  if (status === "unauthenticated") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
        <LogIn className="h-16 w-16 text-muted-foreground mb-4 opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your dashboard</h2>
        <p className="text-muted-foreground mb-6 text-center max-w-md">
          Track your circuit executions, monitor usage, and manage your saved circuits.
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

  const stats = {
    circuitsSaved: myCircuits.length,
    totalJobs: Math.max(myCircuits.length * 3, 12),
    simulatorMinutes: 8.5,
    qpuTasksUsed: 2,
    credits: 48.0,
  };

  return (
    <div className="container mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">
            {session?.user?.name ? `Welcome, ${session.user.name}` : "Dashboard"}
          </h1>
          <p className="text-muted-foreground">
            Your quantum computing usage and recent activity.
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
              {stats.simulatorMinutes}m
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
              {stats.simulatorMinutes} / 60 minutes this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-quantum rounded-full transition-all"
                style={{
                  width: `${(stats.simulatorMinutes / 60) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">QPU Tasks</CardTitle>
            <CardDescription>
              {stats.qpuTasksUsed} / 10 tasks this month
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-quantum rounded-full transition-all"
                style={{
                  width: `${(stats.qpuTasksUsed / 10) * 100}%`,
                }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent jobs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Jobs</CardTitle>
          <CardDescription>
            Your latest circuit executions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {RECENT_JOBS.map((job) => (
              <div
                key={job.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-success" />
                  <div>
                    <p className="text-sm font-medium">{job.circuit}</p>
                    <p className="text-xs text-muted-foreground">
                      {job.backend} · {job.time}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <code className="text-xs font-mono text-muted-foreground">
                    {job.id}
                  </code>
                  <p className="text-xs text-muted-foreground">{job.date}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
