"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useCircuitStore } from "@/store";
import StudioPage from "../page";

// In v0.1, this page loads a circuit by ID and delegates to the Studio page.
// When the FastAPI backend is connected (Task 8), it will fetch the circuit from the API.
export default function CircuitPage() {
  const params = useParams();
  const circuitId = params.circuitId as string;
  const { setCircuitId, setCircuitName, setCode } = useCircuitStore();

  useEffect(() => {
    if (circuitId) {
      setCircuitId(circuitId);
      // TODO (Task 8): Fetch circuit from /api/circuits/{circuitId}
      // For now, just set the ID. The code stays at default/current value.
      setCircuitName(`Circuit ${circuitId}`);
    }
  }, [circuitId, setCircuitId, setCircuitName, setCode]);

  return <StudioPage />;
}
