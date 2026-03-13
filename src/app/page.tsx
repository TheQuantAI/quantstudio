import Link from "next/link";
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
  Code2,
  Zap,
  Server,
  ArrowRight,
  Github,
  Sparkles,
  Shield,
  BarChart3,
} from "lucide-react";

const FEATURES = [
  {
    icon: Code2,
    title: "Monaco Code Editor",
    description:
      "Full-featured Python editor with QuantSDK autocomplete, syntax highlighting, and inline error detection.",
  },
  {
    icon: Zap,
    title: "One-Click Execution",
    description:
      "Run quantum circuits on simulators or real hardware — CPU, GPU, IBM Quantum, IonQ — with a single click.",
  },
  {
    icon: Server,
    title: "Multi-Backend Support",
    description:
      "5 backends available: CPU simulator, GPU simulator (cuQuantum), IBM Quantum, IonQ Harmony, and IonQ Aria.",
  },
  {
    icon: Sparkles,
    title: "QuantRouter",
    description:
      "Intelligent routing selects the optimal backend for your circuit based on size, fidelity, cost, and queue time.",
  },
  {
    icon: BarChart3,
    title: "Rich Visualizations",
    description:
      "Interactive histograms, probability distributions, and text-based circuit diagrams for your results.",
  },
  {
    icon: Shield,
    title: "Open Source SDK",
    description:
      "Built on QuantSDK (Apache 2.0) — write once, run anywhere. Full interop with Qiskit, Cirq, and PennyLane.",
  },
];

const BACKENDS_PREVIEW = [
  { name: "CPU Simulator", qubits: "25", status: "online", type: "Free" },
  { name: "GPU Simulator", qubits: "32+", status: "online", type: "$0.001/shot" },
  { name: "IBM Brisbane", qubits: "127", status: "online", type: "$0.003/shot" },
  { name: "IonQ Harmony", qubits: "11", status: "online", type: "$0.01/shot" },
  { name: "IonQ Aria", qubits: "25", status: "busy", type: "$0.03/shot" },
];

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden py-20 md:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-quantum/5 to-transparent" />
        <div className="container mx-auto px-4 md:px-6 relative">
          <div className="flex flex-col items-center text-center gap-8 max-w-4xl mx-auto">
            <div className="flex items-center gap-2 rounded-full border border-quantum/30 bg-quantum/10 px-4 py-1.5 text-sm text-quantum">
              <Atom className="h-4 w-4" />
              <span>Powered by QuantSDK v0.1 — Open Source</span>
            </div>

            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight">
              Write Quantum Code.
              <br />
              <span className="text-quantum">Run Anywhere.</span>
            </h1>

            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl">
              QuantStudio is the web IDE for TheQuantCloud platform. Build,
              simulate, and deploy quantum circuits on real hardware — IBM
              Quantum, IonQ, GPU simulators — all from your browser.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/studio">
                <Button variant="quantum" size="lg" className="gap-2 text-base">
                  <Code2 className="h-5 w-5" />
                  Open Studio
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <a
                href="https://github.com/TheQuantAI/quantsdk"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="lg" className="gap-2 text-base">
                  <Github className="h-5 w-5" />
                  View on GitHub
                </Button>
              </a>
            </div>

            {/* Code preview */}
            <div className="w-full max-w-2xl mt-4">
              <div className="rounded-lg border border-border bg-card overflow-hidden shadow-lg">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-muted/50">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500/70" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                    <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  </div>
                  <span className="text-xs text-muted-foreground ml-2 font-mono">
                    bell_state.py
                  </span>
                </div>
                <pre className="p-4 text-sm font-mono text-left overflow-x-auto">
                  <code>
                    <span className="text-blue-400">import</span>{" "}
                    <span className="text-green-400">quantsdk</span>{" "}
                    <span className="text-blue-400">as</span>{" "}
                    <span className="text-green-400">qs</span>
                    {"\n\n"}
                    <span className="text-muted-foreground"># Create a Bell State</span>
                    {"\n"}
                    circuit = qs.Circuit(
                    <span className="text-orange-400">2</span>)
                    {"\n"}
                    circuit.h(<span className="text-orange-400">0</span>)
                    {"\n"}
                    circuit.cx(<span className="text-orange-400">0</span>,{" "}
                    <span className="text-orange-400">1</span>)
                    {"\n"}
                    circuit.measure_all()
                    {"\n\n"}
                    <span className="text-muted-foreground"># Run on real hardware</span>
                    {"\n"}
                    result = qs.run(circuit, backend=
                    <span className="text-yellow-300">&quot;ibm_brisbane&quot;</span>)
                    {"\n"}
                    <span className="text-blue-400">print</span>(result.counts)
                    {"\n"}
                    <span className="text-muted-foreground">
                      {`# {'00': 503, '11': 497}`}
                    </span>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Everything You Need for Quantum Development
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              From circuit design to execution on real quantum hardware —
              QuantStudio brings the full quantum development lifecycle to your
              browser.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature) => (
              <Card
                key={feature.title}
                className="bg-card hover:border-quantum/50 transition-colors"
              >
                <CardHeader>
                  <feature.icon className="h-10 w-10 text-quantum mb-2" />
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-sm">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Backends */}
      <section className="py-20 border-t border-border bg-muted/30">
        <div className="container mx-auto px-4 md:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              5 Backends, One Platform
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Access simulators and real quantum hardware through a unified
              interface. QuantRouter selects the best backend for your circuit
              automatically.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 max-w-5xl mx-auto">
            {BACKENDS_PREVIEW.map((backend) => (
              <Card key={backend.name} className="text-center">
                <CardContent className="pt-6">
                  <Server className="h-8 w-8 mx-auto mb-3 text-quantum" />
                  <h3 className="font-semibold text-sm mb-1">{backend.name}</h3>
                  <p className="text-xs text-muted-foreground mb-2">
                    {backend.qubits} qubits
                  </p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      backend.status === "online"
                        ? "bg-success/20 text-success"
                        : "bg-warning/20 text-warning"
                    }`}
                  >
                    {backend.status}
                  </span>
                  <p className="text-xs text-muted-foreground mt-2">
                    {backend.type}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-border">
        <div className="container mx-auto px-4 md:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Start Building Quantum Circuits Today
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
            Free tier includes 60 minutes of simulator time and 10 real QPU
            tasks per month. No credit card required.
          </p>
          <div className="flex justify-center gap-4">
            <Link href="/studio">
              <Button variant="quantum" size="lg" className="gap-2">
                <Code2 className="h-5 w-5" />
                Launch QuantStudio
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Atom className="h-5 w-5 text-quantum" />
              <span className="text-sm text-muted-foreground">
                © 2026 TheQuantAI. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <a
                href="https://thequantai.in"
                className="hover:text-foreground transition-colors"
              >
                TheQuantAI
              </a>
              <a
                href="https://thequantcloud.com"
                className="hover:text-foreground transition-colors"
              >
                TheQuantCloud
              </a>
              <a
                href="https://github.com/TheQuantAI/quantsdk"
                className="hover:text-foreground transition-colors"
              >
                GitHub
              </a>
              <Link
                href="/pricing"
                className="hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
