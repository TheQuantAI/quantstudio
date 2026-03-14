// Copyright 2026 TheQuantAI
// Python runtime powered by Pyodide (CPython compiled to WebAssembly)
// Provides a real Python interpreter in the browser for QuantStudio

// We load Pyodide from CDN to avoid bundling the ~10MB WASM binary
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PyodideInterface = any;

let pyodideInstance: PyodideInterface | null = null;
let loadingPromise: Promise<PyodideInterface> | null = null;

// The quantsdk stub Python source is fetched at runtime
let quantsdkStubSource: string | null = null;

/** Load the quantsdk Python stub source */
async function loadQuantsdkStub(): Promise<string> {
  if (quantsdkStubSource) return quantsdkStubSource;
  const res = await fetch("/quantsdk-stub.py");
  quantsdkStubSource = await res.text();
  return quantsdkStubSource;
}

/** Load Pyodide from CDN (cached after first load) */
export async function loadPyodide(): Promise<PyodideInterface> {
  if (pyodideInstance) return pyodideInstance;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    // Dynamic import from CDN — CPython compiled to WebAssembly
    const cdnUrl = "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.mjs";
    const pyodideModule = await (Function("url", "return import(url)")(cdnUrl)) as {
      loadPyodide: (opts?: Record<string, unknown>) => Promise<PyodideInterface>;
    };
    const load = pyodideModule.loadPyodide;

    const pyodide = await load({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.5/full/",
    });

    // Register the quantsdk stub module
    const stubSource = await loadQuantsdkStub();
    pyodide.FS.writeFile("/home/pyodide/quantsdk.py", stubSource);
    pyodide.runPython(`
import sys
sys.path.insert(0, "/home/pyodide")
`);

    // Verify import works
    pyodide.runPython("import quantsdk as qs; print(f'QuantSDK {qs.__version__} loaded')");

    pyodideInstance = pyodide;
    return pyodide;
  })();

  return loadingPromise;
}

/** Check if Pyodide is loaded */
export function isPyodideReady(): boolean {
  return pyodideInstance !== null;
}

/** Output callback type */
export type OutputCallback = (text: string, stream: "stdout" | "stderr") => void;

/**
 * Execute Python code with stdout/stderr capture.
 * Returns { success, output, error }
 */
export async function executePython(
  code: string,
  onOutput?: OutputCallback
): Promise<{ success: boolean; output: string; error: string | null }> {
  const pyodide = await loadPyodide();

  let stdout = "";
  let stderr = "";

  // Set up output capture
  pyodide.setStdout({
    batched: (text: string) => {
      stdout += text + "\n";
      onOutput?.(text, "stdout");
    },
  });
  pyodide.setStderr({
    batched: (text: string) => {
      stderr += text + "\n";
      onOutput?.(text, "stderr");
    },
  });

  try {
    // Run the user's code
    await pyodide.runPythonAsync(code);
    return { success: true, output: stdout, error: null };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Extract just the last part of Python traceback for cleaner display
    const lines = errorMsg.split("\n");
    const shortErr = lines.length > 3
      ? lines.slice(-3).join("\n")
      : errorMsg;
    stderr += shortErr;
    onOutput?.(shortErr, "stderr");
    return { success: false, output: stdout, error: shortErr };
  }
}

/**
 * Execute a single REPL expression/statement.
 * For interactive mode — handles expression evaluation (shows result)
 * and statements (executes silently unless they print).
 */
export async function executeRepl(
  line: string,
  onOutput?: OutputCallback
): Promise<void> {
  const pyodide = await loadPyodide();

  pyodide.setStdout({
    batched: (text: string) => {
      onOutput?.(text, "stdout");
    },
  });
  pyodide.setStderr({
    batched: (text: string) => {
      onOutput?.(text, "stderr");
    },
  });

  try {
    // Try to evaluate as expression first (like Python REPL)
    // If it's an expression, display its repr
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;

    // Check if it's a statement (assignment, import, if, for, def, class, etc.)
    const isStatement = /^(import |from |if |for |while |def |class |with |try |raise |assert |del |pass|break|continue|return |yield )/.test(trimmed)
      || /^\w+\s*[+\-*/|&^%@]?=/.test(trimmed)  // assignment
      || trimmed.endsWith(":");                    // block start

    if (isStatement) {
      await pyodide.runPythonAsync(trimmed);
    } else {
      // Try as expression — show repr of result
      const result = await pyodide.runPythonAsync(`
__repl_result__ = ${trimmed}
if __repl_result__ is not None:
    print(repr(__repl_result__))
del __repl_result__
`);
      void result;
    }
  } catch {
    // If expression eval failed, try as statement
    try {
      await pyodide.runPythonAsync(line);
    } catch (err2: unknown) {
      const msg = err2 instanceof Error ? err2.message : String(err2);
      const lines = msg.split("\n");
      const short = lines.length > 3 ? lines.slice(-3).join("\n") : msg;
      onOutput?.(short, "stderr");
    }
  }
}
