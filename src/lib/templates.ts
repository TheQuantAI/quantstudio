import { CircuitTemplate } from "@/store";

export const CIRCUIT_TEMPLATES: CircuitTemplate[] = [
  // ─── Entanglement ───
  {
    id: "bell_state",
    name: "Bell State",
    description:
      "Create a maximally entangled 2-qubit Bell state |Φ⁺⟩ = (|00⟩ + |11⟩)/√2",
    category: "entanglement",
    code: `import quantsdk as qs

# Bell State — Maximally Entangled Pair
# Creates |Φ⁺⟩ = (|00⟩ + |11⟩)/√2
circuit = qs.Circuit(2, name="bell_state")

# Apply Hadamard to put qubit 0 in superposition
circuit.h(0)

# CNOT entangles qubit 0 and qubit 1
circuit.cx(0, 1)

# Measure both qubits
circuit.measure_all()

# Run and see the results
result = qs.run(circuit, shots=1024)
print("Counts:", result.counts)
print("Probabilities:", result.probabilities)
print("Most likely:", result.most_likely)
`,
  },
  {
    id: "ghz_state",
    name: "GHZ State",
    description:
      "Create a 3-qubit GHZ state |GHZ⟩ = (|000⟩ + |111⟩)/√2 — multi-party entanglement",
    category: "entanglement",
    code: `import quantsdk as qs

# GHZ State — 3-qubit entanglement
# Creates |GHZ⟩ = (|000⟩ + |111⟩)/√2
circuit = qs.Circuit(3, name="ghz_state")

# Hadamard on first qubit
circuit.h(0)

# Chain of CNOTs to entangle all qubits
circuit.cx(0, 1)
circuit.cx(1, 2)

# Measure all
circuit.measure_all()

# Execute
result = qs.run(circuit, shots=1024)
print("Counts:", result.counts)
# Expect roughly equal |000⟩ and |111⟩
`,
  },
  {
    id: "w_state",
    name: "W State (3-qubit)",
    description:
      "Create a 3-qubit W state |W⟩ = (|001⟩ + |010⟩ + |100⟩)/√3 — robust entanglement",
    category: "entanglement",
    code: `import quantsdk as qs
import math

# W State — Robust 3-qubit entanglement
# |W⟩ = (|001⟩ + |010⟩ + |100⟩)/√3
# Unlike GHZ, losing one qubit still leaves entanglement
circuit = qs.Circuit(3, name="w_state")

# Step 1: Rotate q0 to create 1/√3 amplitude
circuit.ry(0, 2 * math.acos(math.sqrt(1/3)))

# Step 2: Controlled rotations to distribute
circuit.cx(0, 1)
circuit.ch(0, 2)

# Step 3: CNOT chain to complete W state
circuit.cx(1, 2)
circuit.x(0)

circuit.measure_all()
result = qs.run(circuit, shots=2048)
print("W State:", result.counts)
# Expect roughly equal |001⟩, |010⟩, |100⟩
`,
  },

  // ─── Algorithms ───
  {
    id: "deutsch_jozsa",
    name: "Deutsch-Jozsa Algorithm",
    description:
      "Determine if a function is constant or balanced in a single query — quantum speedup demo",
    category: "algorithm",
    code: `import quantsdk as qs

# Deutsch-Jozsa Algorithm (2-qubit oracle)
# Determines if f(x) is constant or balanced in ONE query
# Classical needs 2^(n-1)+1 queries in worst case

circuit = qs.Circuit(3, name="deutsch_jozsa")

# Initialize: |x⟩ = |00⟩, |y⟩ = |1⟩
circuit.x(2)

# Apply Hadamard to all qubits
circuit.h(0)
circuit.h(1)
circuit.h(2)

# Oracle for balanced function f(x) = x1 XOR x2
circuit.cx(0, 2)
circuit.cx(1, 2)

# Apply Hadamard to input qubits
circuit.h(0)
circuit.h(1)

# Measure input qubits only
circuit.measure(0)
circuit.measure(1)

result = qs.run(circuit, shots=1024)
print("Deutsch-Jozsa result:", result.counts)
print("If |00⟩ → constant; otherwise → balanced")
`,
  },
  {
    id: "bernstein_vazirani",
    name: "Bernstein-Vazirani",
    description:
      "Find a hidden bitstring s in a single query — exponential quantum speedup",
    category: "algorithm",
    code: `import quantsdk as qs

# Bernstein-Vazirani Algorithm
# Given oracle f(x) = s·x (mod 2), find hidden string s
# Hidden string: s = "101" (finds it in ONE query vs n classically)

n = 3  # number of bits
secret = "101"

circuit = qs.Circuit(n + 1, name="bernstein_vazirani")

# Initialize ancilla qubit |1⟩
circuit.x(n)

# Apply Hadamard to all qubits
for i in range(n + 1):
    circuit.h(i)

# Oracle: for each bit of secret that is '1', apply CNOT
for i in range(n):
    if secret[i] == '1':
        circuit.cx(i, n)

# Apply Hadamard to input qubits
for i in range(n):
    circuit.h(i)

# Measure input qubits
for i in range(n):
    circuit.measure(i)

result = qs.run(circuit, shots=1024)
print(f"Hidden string: {secret}")
print(f"Found: {result.most_likely[:n]}")
print("Counts:", result.counts)
`,
  },
  {
    id: "grovers_search",
    name: "Grover's Search (2-qubit)",
    description:
      "Quantum search algorithm — find marked state |11⟩ in √N iterations",
    category: "algorithm",
    code: `import quantsdk as qs

# Grover's Search Algorithm (2 qubits)
# Searching for marked state |11⟩
# Only 1 iteration needed for 2 qubits (pi/4 * sqrt(4) ≈ 1)

circuit = qs.Circuit(2, name="grovers_search")

# Step 1: Create uniform superposition
circuit.h(0)
circuit.h(1)

# Step 2: Oracle — mark |11⟩ with phase flip
circuit.cz(0, 1)

# Step 3: Diffusion operator (Grover diffuser)
circuit.h(0)
circuit.h(1)
circuit.x(0)
circuit.x(1)
circuit.cz(0, 1)
circuit.x(0)
circuit.x(1)
circuit.h(0)
circuit.h(1)

# Measure
circuit.measure_all()

result = qs.run(circuit, shots=1024)
print("Grover's search result:", result.counts)
print("Target |11⟩ found with high probability:", result.most_likely)
`,
  },
  {
    id: "simons_algorithm",
    name: "Simon's Algorithm",
    description:
      "Find hidden period in a function — exponential speedup over classical",
    category: "algorithm",
    code: `import quantsdk as qs

# Simon's Algorithm (simplified 2-bit oracle)
# Given f(x) = f(x⊕s), find hidden period s = "11"
circuit = qs.Circuit(4, name="simons_algorithm")

# Hadamard on input register
circuit.h(0)
circuit.h(1)

# Oracle: f maps x → x for x < s, x → x⊕s otherwise
# Implementing f(x) = x (identity) on output register
circuit.cx(0, 2)
circuit.cx(1, 3)
# Add period s = "11": XOR with s
circuit.cx(0, 3)
circuit.cx(1, 2)

# Hadamard on input register
circuit.h(0)
circuit.h(1)

# Measure input register
circuit.measure(0)
circuit.measure(1)

result = qs.run(circuit, shots=2048)
print("Simon's Algorithm results:", result.counts)
print("Results orthogonal to s='11': expect |00⟩ and |11⟩")
`,
  },

  // ─── Transforms ───
  {
    id: "qft_3qubit",
    name: "Quantum Fourier Transform",
    description:
      "3-qubit QFT — the quantum analog of the discrete Fourier transform",
    category: "transform",
    code: `import quantsdk as qs
import math

# Quantum Fourier Transform (3 qubits)
circuit = qs.Circuit(3, name="qft_3qubit")

# Initialize input state |5⟩ = |101⟩
circuit.x(0)
circuit.x(2)

# QFT on 3 qubits
# Qubit 0
circuit.h(0)
circuit.cp(0, 1, math.pi / 2)   # Controlled phase S
circuit.cp(0, 2, math.pi / 4)   # Controlled phase T

# Qubit 1
circuit.h(1)
circuit.cp(1, 2, math.pi / 2)

# Qubit 2
circuit.h(2)

# SWAP to reverse qubit order
circuit.swap(0, 2)

circuit.measure_all()

result = qs.run(circuit, shots=1024)
print("QFT of |101⟩:", result.counts)
`,
  },
  {
    id: "phase_estimation",
    name: "Quantum Phase Estimation",
    description:
      "Estimate eigenvalues of a unitary — cornerstone of Shor's algorithm and quantum chemistry",
    category: "transform",
    code: `import quantsdk as qs
import math

# Quantum Phase Estimation (simplified)
# Estimate phase of T gate: T|1⟩ = e^(iπ/4)|1⟩ → phase = 1/8
circuit = qs.Circuit(4, name="phase_estimation")

# Prepare eigenstate |1⟩ on target qubit (q3)
circuit.x(3)

# Hadamard on counting register (q0-q2)
circuit.h(0)
circuit.h(1)
circuit.h(2)

# Controlled-U^(2^k) operations
# CU^4 (q0 controls 4 applications of T = S^2 on q3)
circuit.cp(0, 3, 4 * math.pi / 4)
# CU^2 (q1 controls 2 applications)
circuit.cp(1, 3, 2 * math.pi / 4)
# CU^1 (q2 controls 1 application)
circuit.cp(2, 3, math.pi / 4)

# Inverse QFT on counting register
circuit.swap(0, 2)
circuit.h(0)
circuit.cp(0, 1, -math.pi / 2)
circuit.h(1)
circuit.cp(1, 2, -math.pi / 2)
circuit.cp(0, 2, -math.pi / 4)
circuit.h(2)

# Measure counting register
circuit.measure(0)
circuit.measure(1)
circuit.measure(2)

result = qs.run(circuit, shots=2048)
print("Phase Estimation results:", result.counts)
print("Expected: |001⟩ → phase = 1/8")
`,
  },

  // ─── Protocols ───
  {
    id: "teleportation",
    name: "Quantum Teleportation",
    description:
      "Transfer a quantum state using entanglement and classical communication",
    category: "protocol",
    code: `import quantsdk as qs
import math

# Quantum Teleportation Protocol
# Teleport state of q0 to q2 using shared entanglement
circuit = qs.Circuit(3, name="teleportation")

# Step 1: Prepare state to teleport on q0
# We'll teleport |+⟩ = H|0⟩
circuit.h(0)

# Step 2: Create Bell pair between q1 and q2 (shared entanglement)
circuit.h(1)
circuit.cx(1, 2)

# Step 3: Bell measurement on q0 and q1
circuit.cx(0, 1)
circuit.h(0)

# Step 4: Conditional corrections (classically controlled)
# In real teleportation, these are conditioned on measurement
# Here we use CNOT and CZ as the correction gates
circuit.cx(1, 2)
circuit.cz(0, 2)

# Measure all qubits
circuit.measure_all()

result = qs.run(circuit, shots=2048)
print("Teleportation result:", result.counts)
print("q2 now holds the teleported state")
`,
  },
  {
    id: "superdense_coding",
    name: "Superdense Coding",
    description:
      "Send 2 classical bits using only 1 qubit — the reverse of teleportation",
    category: "protocol",
    code: `import quantsdk as qs

# Superdense Coding
# Alice sends 2 classical bits to Bob using 1 qubit + shared entanglement
circuit = qs.Circuit(2, name="superdense_coding")

# Step 1: Create shared Bell pair
circuit.h(0)
circuit.cx(0, 1)

# Step 2: Alice encodes 2-bit message on her qubit (q0)
# Message "11" → apply ZX (both X and Z)
message = "11"
if message[1] == "1":
    circuit.x(0)
if message[0] == "1":
    circuit.z(0)

# Step 3: Bob decodes by reversing Bell creation
circuit.cx(0, 1)
circuit.h(0)

# Measure — Bob gets the 2-bit message
circuit.measure_all()

result = qs.run(circuit, shots=1024)
print(f"Sent message: {message}")
print(f"Received: {result.most_likely}")
print("Counts:", result.counts)
`,
  },

  // ─── Variational ───
  {
    id: "vqe_simple",
    name: "Simple VQE",
    description:
      "Variational Quantum Eigensolver — find ground state energy of H₂ molecule",
    category: "variational",
    code: `import quantsdk as qs
import math

# Simple VQE Ansatz for H₂ molecule
# This is the hardware-efficient ansatz
def vqe_circuit(theta: float) -> qs.Circuit:
    circuit = qs.Circuit(2, name="vqe_h2")

    # Initial state preparation
    circuit.x(0)  # Start from |01⟩ (one electron)

    # Parameterized ansatz
    circuit.ry(0, theta)
    circuit.ry(1, theta)
    circuit.cx(0, 1)
    circuit.ry(0, theta / 2)

    circuit.measure_all()
    return circuit

# Try different angles (in real VQE, an optimizer does this)
for theta in [0.0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0]:
    circuit = vqe_circuit(theta)
    result = qs.run(circuit, shots=1024)
    print(f"theta={theta:.1f}: {result.counts}")
`,
  },
  {
    id: "qaoa_maxcut",
    name: "QAOA MaxCut",
    description:
      "Quantum Approximate Optimization Algorithm for the MaxCut graph problem",
    category: "variational",
    code: `import quantsdk as qs
import math

# QAOA for MaxCut on a triangle graph (3 nodes, 3 edges)
# Edges: (0,1), (1,2), (0,2)

def qaoa_circuit(gamma: float, beta: float) -> qs.Circuit:
    circuit = qs.Circuit(3, name="qaoa_maxcut")

    # Initial superposition
    circuit.h(0)
    circuit.h(1)
    circuit.h(2)

    # Problem unitary (phase separator) — one ZZ per edge
    # Edge (0,1)
    circuit.cx(0, 1)
    circuit.rz(1, 2 * gamma)
    circuit.cx(0, 1)

    # Edge (1,2)
    circuit.cx(1, 2)
    circuit.rz(2, 2 * gamma)
    circuit.cx(1, 2)

    # Edge (0,2)
    circuit.cx(0, 2)
    circuit.rz(2, 2 * gamma)
    circuit.cx(0, 2)

    # Mixer unitary
    circuit.rx(0, 2 * beta)
    circuit.rx(1, 2 * beta)
    circuit.rx(2, 2 * beta)

    circuit.measure_all()
    return circuit

# Run with sample parameters
circuit = qaoa_circuit(gamma=0.8, beta=0.4)
result = qs.run(circuit, shots=2048)
print("QAOA MaxCut results:", result.counts)
print("Most likely partition:", result.most_likely)
`,
  },

  // ─── Utility ───
  {
    id: "qrng",
    name: "Quantum Random Number Generator",
    description:
      "Generate truly random bits using quantum superposition — cryptographic quality randomness",
    category: "utility",
    code: `import quantsdk as qs

# Quantum Random Number Generator (QRNG)
# Uses quantum superposition for true randomness
# Each qubit in superposition collapses to 0 or 1 with equal probability

n_bits = 8  # Generate an 8-bit random number

circuit = qs.Circuit(n_bits, name="qrng")

# Put each qubit in superposition
for i in range(n_bits):
    circuit.h(i)

# Measure all qubits
circuit.measure_all()

# Each shot gives a truly random n-bit number
result = qs.run(circuit, shots=1)
random_bits = result.most_likely
random_number = int(random_bits, 2)
print(f"Random bits: {random_bits}")
print(f"Random number (0-255): {random_number}")

# Run many shots to see uniform distribution
result_many = qs.run(circuit, shots=4096)
print(f"\\nUnique values from 4096 shots: {len(result_many.counts)}")
print("Top 5:", dict(sorted(result_many.counts.items(), key=lambda x: -x[1])[:5]))
`,
  },
  {
    id: "swap_test",
    name: "SWAP Test",
    description:
      "Compare two quantum states — measures overlap |⟨ψ|φ⟩|² without tomography",
    category: "utility",
    code: `import quantsdk as qs
import math

# SWAP Test — Compare two quantum states
# Measures |⟨ψ|φ⟩|² — the overlap of two states
# P(ancilla=0) = (1 + |⟨ψ|φ⟩|²) / 2

circuit = qs.Circuit(3, name="swap_test")
# q0 = ancilla, q1 = |ψ⟩, q2 = |φ⟩

# Prepare |ψ⟩ on q1 (e.g., |+⟩ = H|0⟩)
circuit.h(1)

# Prepare |φ⟩ on q2 (e.g., |+⟩ = H|0⟩)
circuit.h(2)

# SWAP test circuit
circuit.h(0)          # Hadamard on ancilla
circuit.cx(0, 1)      # Controlled-SWAP (q1, q2) via decomposition
circuit.cx(0, 2)
circuit.cx(0, 1)
circuit.h(0)          # Hadamard on ancilla

# Measure ancilla
circuit.measure(0)

result = qs.run(circuit, shots=2048)
print("SWAP Test results:", result.counts)
# If states identical: P(0) ≈ 1.0
# If states orthogonal: P(0) ≈ 0.5
`,
  },

  // ─── QML ───
  {
    id: "quantum_classifier",
    name: "Quantum Classifier",
    description:
      "Simple variational quantum classifier — encode data in rotation gates and learn parameters",
    category: "qml",
    code: `import quantsdk as qs
import math

# Quantum Classifier — Variational Circuit
# Encodes 2D data point into rotation gates
# Learns to classify via parameterized ansatz

def quantum_classifier(x1: float, x2: float, theta1: float, theta2: float, theta3: float) -> qs.Circuit:
    circuit = qs.Circuit(2, name="quantum_classifier")

    # Data encoding layer
    circuit.rx(0, x1 * math.pi)
    circuit.rx(1, x2 * math.pi)

    # Variational layer 1
    circuit.ry(0, theta1)
    circuit.ry(1, theta2)
    circuit.cx(0, 1)

    # Variational layer 2
    circuit.ry(0, theta3)

    circuit.measure_all()
    return circuit

# Test with sample data points
data_points = [
    (0.2, 0.8, "Class A"),
    (0.9, 0.1, "Class B"),
    (0.5, 0.5, "Boundary"),
]

# Random initial parameters (in real training, these are optimized)
theta1, theta2, theta3 = 1.2, 0.7, 2.1

for x1, x2, label in data_points:
    circuit = quantum_classifier(x1, x2, theta1, theta2, theta3)
    result = qs.run(circuit, shots=1024)
    p_class0 = result.probabilities.get("00", 0) + result.probabilities.get("01", 0)
    print(f"Point ({x1},{x2}) [{label}]: P(class 0)={p_class0:.3f}")
`,
  },
];
