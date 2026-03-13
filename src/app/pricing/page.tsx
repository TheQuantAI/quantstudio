import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Zap, Rocket, Building2 } from "lucide-react";

const PLANS = [
  {
    name: "Free",
    icon: Zap,
    price: "$0",
    period: "forever",
    description: "Perfect for learning and experimentation",
    features: [
      "60 min/month simulator time",
      "10 real QPU tasks/month",
      "CPU Simulator access",
      "QuantStudio IDE",
      "QuantSDK full access",
      "Community Discord support",
    ],
    cta: "Get Started",
    ctaVariant: "outline" as const,
    popular: false,
  },
  {
    name: "Developer",
    icon: Rocket,
    price: "$49",
    period: "/month",
    description: "For serious quantum developers and researchers",
    features: [
      "300 min/month simulator time",
      "100 real QPU tasks/month",
      "CPU + GPU Simulator access",
      "IBM Quantum + IonQ backends",
      "QuantRouter (rule-based)",
      "Email support (48h response)",
      "Save unlimited circuits",
      "Priority queue access",
    ],
    cta: "Start Free Trial",
    ctaVariant: "quantum" as const,
    popular: true,
  },
  {
    name: "Enterprise",
    icon: Building2,
    price: "Custom",
    period: "",
    description: "For teams and organizations — coming Phase 2",
    features: [
      "Unlimited simulator time",
      "Unlimited QPU tasks",
      "All backends including Rigetti & D-Wave",
      "QuantRouter ML-powered (v0.5+)",
      "Dedicated account manager",
      "SLA with 99.9% uptime",
      "On-premise deployment option",
      "Custom integrations",
    ],
    cta: "Contact Sales",
    ctaVariant: "outline" as const,
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <div className="container mx-auto px-4 md:px-6 py-16">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-4">
          Simple, Transparent Pricing
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Start free. Scale when you&apos;re ready. No credit card required for
          the free tier.
        </p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {PLANS.map((plan) => (
          <Card
            key={plan.name}
            className={`relative flex flex-col ${
              plan.popular ? "border-quantum quantum-border" : ""
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge variant="default" className="bg-quantum text-white">
                  Most Popular
                </Badge>
              </div>
            )}
            <CardHeader className="text-center pb-2">
              <plan.icon
                className={`h-10 w-10 mx-auto mb-2 ${
                  plan.popular ? "text-quantum" : "text-muted-foreground"
                }`}
              />
              <CardTitle className="text-xl">{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground">{plan.period}</span>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-quantum mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Link href={plan.name === "Enterprise" ? "#" : "/signup"} className="w-full">
                <Button
                  variant={plan.ctaVariant}
                  className="w-full"
                >
                  {plan.cta}
                </Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Usage overage */}
      <div className="mt-16 text-center max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold mb-4">Usage Overage</h2>
        <p className="text-muted-foreground mb-6">
          Need more than your plan includes? Pay-as-you-go rates apply:
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Extra Simulator Time
              </p>
              <p className="text-2xl font-bold mt-1">$0.01</p>
              <p className="text-xs text-muted-foreground">per minute</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-sm text-muted-foreground">
                Extra QPU Tasks
              </p>
              <p className="text-2xl font-bold mt-1">Cost + 20%</p>
              <p className="text-xs text-muted-foreground">pass-through markup</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
