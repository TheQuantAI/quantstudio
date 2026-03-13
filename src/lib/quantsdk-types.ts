// QuantSDK type definitions for Monaco Editor autocomplete
// These provide IntelliSense when writing QuantSDK code in the Studio

export const QUANTSDK_TYPE_DEFS = `
declare module "quantsdk" {
  /** Quantum circuit builder */
  export class Circuit {
    /** Create a new quantum circuit */
    constructor(n_qubits: number, name?: string);

    /** Number of qubits in the circuit */
    readonly n_qubits: number;
    /** Circuit name */
    readonly name: string;

    // Single-qubit gates
    /** Hadamard gate — creates superposition */
    h(qubit: number): Circuit;
    /** Pauli-X gate (NOT gate) */
    x(qubit: number): Circuit;
    /** Pauli-Y gate */
    y(qubit: number): Circuit;
    /** Pauli-Z gate */
    z(qubit: number): Circuit;
    /** S gate (√Z) */
    s(qubit: number): Circuit;
    /** S† gate (adjoint of S) */
    sdg(qubit: number): Circuit;
    /** T gate (√S) */
    t(qubit: number): Circuit;
    /** T† gate (adjoint of T) */
    tdg(qubit: number): Circuit;
    /** Rotation around X-axis */
    rx(qubit: number, theta: number): Circuit;
    /** Rotation around Y-axis */
    ry(qubit: number, theta: number): Circuit;
    /** Rotation around Z-axis */
    rz(qubit: number, theta: number): Circuit;
    /** U3 gate — general single-qubit rotation */
    u(qubit: number, theta: number, phi: number, lam: number): Circuit;

    // Two-qubit gates
    /** CNOT (Controlled-X) gate */
    cx(control: number, target: number): Circuit;
    /** Controlled-Z gate */
    cz(control: number, target: number): Circuit;
    /** Controlled-Phase gate */
    cp(control: number, target: number, theta: number): Circuit;
    /** SWAP gate */
    swap(q1: number, q2: number): Circuit;
    /** iSWAP gate */
    iswap(q1: number, q2: number): Circuit;

    // Three-qubit gates
    /** Toffoli (CCX) gate */
    ccx(c1: number, c2: number, target: number): Circuit;
    /** Fredkin (CSWAP) gate */
    cswap(control: number, q1: number, q2: number): Circuit;

    // Measurement
    /** Measure a single qubit */
    measure(qubit: number, cbit?: number): Circuit;
    /** Measure all qubits */
    measure_all(): Circuit;
    /** Add a barrier */
    barrier(): Circuit;

    // Visualization
    /** Draw circuit as text */
    draw(): string;

    // Circuit info
    /** Circuit depth */
    depth(): number;
    /** Gate count by type */
    gate_count(): Record<string, number>;
    /** Total number of qubits */
    qubit_count(): number;

    // Interop
    /** Convert to Qiskit circuit */
    to_qiskit(): any;
    /** Convert to Cirq circuit */
    to_cirq(): any;
    /** Convert to PennyLane tape */
    to_pennylane(): any;
    /** Export as OpenQASM 3.0 string */
    to_openqasm(): string;
  }

  /** Execution result from a quantum circuit */
  export class Result {
    /** Measurement counts */
    readonly counts: Record<string, number>;
    /** Measurement probabilities */
    readonly probabilities: Record<string, number>;
    /** Most frequently measured bitstring */
    readonly most_likely: string;
    /** Number of shots executed */
    readonly shots: number;
    /** Backend used for execution */
    readonly backend: string;
    /** Execution time in seconds */
    readonly execution_time: number;
    /** Unique job identifier */
    readonly job_id: string;

    /** Plot a histogram of measurement results */
    plot_histogram(): void;
    /** Convert results to a pandas DataFrame */
    to_pandas(): any;
    /** Compute expectation value of an observable */
    expectation_value(observable: any): number;
  }

  /** Run a circuit on a backend */
  export function run(
    circuit: Circuit,
    options?: {
      backend?: string;
      shots?: number;
      optimize_for?: "quality" | "speed" | "cost";
      max_cost_usd?: number;
      min_fidelity?: number;
    }
  ): Result;
}
`;

// Completion items for Monaco editor
export const QUANTSDK_COMPLETIONS = [
  // Module-level
  {
    label: "qs.Circuit",
    kind: "Class",
    detail: "Create a new quantum circuit",
    insertText: "qs.Circuit(n_qubits=${1:2}, name=${2:'circuit'})",
  },
  {
    label: "qs.run",
    kind: "Function",
    detail: "Run a circuit on a backend",
    insertText: "qs.run(${1:circuit}, shots=${2:1024})",
  },
  // Gate methods
  {
    label: ".h",
    kind: "Method",
    detail: "Hadamard gate — creates superposition",
    insertText: ".h(${1:0})",
  },
  {
    label: ".x",
    kind: "Method",
    detail: "Pauli-X (NOT) gate",
    insertText: ".x(${1:0})",
  },
  {
    label: ".y",
    kind: "Method",
    detail: "Pauli-Y gate",
    insertText: ".y(${1:0})",
  },
  {
    label: ".z",
    kind: "Method",
    detail: "Pauli-Z gate",
    insertText: ".z(${1:0})",
  },
  {
    label: ".cx",
    kind: "Method",
    detail: "CNOT gate",
    insertText: ".cx(${1:0}, ${2:1})",
  },
  {
    label: ".cz",
    kind: "Method",
    detail: "Controlled-Z gate",
    insertText: ".cz(${1:0}, ${2:1})",
  },
  {
    label: ".rx",
    kind: "Method",
    detail: "Rotation around X-axis",
    insertText: ".rx(${1:0}, ${2:math.pi/2})",
  },
  {
    label: ".ry",
    kind: "Method",
    detail: "Rotation around Y-axis",
    insertText: ".ry(${1:0}, ${2:math.pi/2})",
  },
  {
    label: ".rz",
    kind: "Method",
    detail: "Rotation around Z-axis",
    insertText: ".rz(${1:0}, ${2:math.pi/2})",
  },
  {
    label: ".swap",
    kind: "Method",
    detail: "SWAP gate",
    insertText: ".swap(${1:0}, ${2:1})",
  },
  {
    label: ".ccx",
    kind: "Method",
    detail: "Toffoli (CCX) gate",
    insertText: ".ccx(${1:0}, ${2:1}, ${3:2})",
  },
  {
    label: ".measure_all",
    kind: "Method",
    detail: "Measure all qubits",
    insertText: ".measure_all()",
  },
  {
    label: ".measure",
    kind: "Method",
    detail: "Measure a single qubit",
    insertText: ".measure(${1:0})",
  },
  {
    label: ".draw",
    kind: "Method",
    detail: "Draw circuit as text",
    insertText: '.draw()',
  },
  {
    label: ".barrier",
    kind: "Method",
    detail: "Add a barrier",
    insertText: ".barrier()",
  },
  // Result properties
  {
    label: ".counts",
    kind: "Property",
    detail: "Measurement counts dict",
    insertText: ".counts",
  },
  {
    label: ".probabilities",
    kind: "Property",
    detail: "Measurement probabilities dict",
    insertText: ".probabilities",
  },
  {
    label: ".most_likely",
    kind: "Property",
    detail: "Most frequently measured bitstring",
    insertText: ".most_likely",
  },
  {
    label: ".plot_histogram",
    kind: "Method",
    detail: "Plot results histogram",
    insertText: ".plot_histogram()",
  },
];
