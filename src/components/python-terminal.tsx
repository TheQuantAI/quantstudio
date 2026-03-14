"use client";

// Copyright 2026 TheQuantAI
// Python Terminal component — real Python REPL powered by Pyodide + xterm.js

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { loadPyodide, isPyodideReady, executePython, executeRepl } from "@/lib/python-runtime";

// xterm types
import type { Terminal as XTerminal } from "@xterm/xterm";

/** Imperative handle exposed to parent */
export interface PythonTerminalHandle {
  /** Execute a block of code (from the editor's Run button) */
  runCode: (code: string) => Promise<void>;
  /** Write a line to the terminal */
  writeLine: (text: string, color?: "red" | "green" | "yellow" | "cyan" | "white") => void;
  /** Clear the terminal */
  clear: () => void;
}

const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  dim: "\x1b[2m",
  bold: "\x1b[1m",
};

const PROMPT = "\x1b[32m>>> \x1b[0m";
const CONTINUATION = "\x1b[32m... \x1b[0m";

const PythonTerminal = forwardRef<PythonTerminalHandle, { className?: string }>(
  function PythonTerminal({ className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const termRef = useRef<XTerminal | null>(null);
    const inputBufferRef = useRef("");
    const multilineBufferRef = useRef<string[]>([]);
    const isExecutingRef = useRef(false);
    const isReadyRef = useRef(false);
    const historyRef = useRef<string[]>([]);
    const historyIndexRef = useRef(-1);

    /** Write colored text to terminal */
    const write = useCallback((text: string, color?: string) => {
      const term = termRef.current;
      if (!term) return;
      const c = color ? (ANSI as Record<string, string>)[color] || "" : "";
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        term.write(`${c}${line}${ANSI.reset}`);
        if (i < lines.length - 1) term.write("\r\n");
      });
    }, []);

    /** Write a line with newline */
    const writeLine = useCallback((text: string, color?: "red" | "green" | "yellow" | "cyan" | "white") => {
      write(text + "\r\n", color);
    }, [write]);

    /** Show prompt */
    const showPrompt = useCallback(() => {
      const term = termRef.current;
      if (!term || !isReadyRef.current) return;
      term.write(PROMPT);
      inputBufferRef.current = "";
    }, []);

    /** Execute a block of code from Run button */
    const runCode = useCallback(async (code: string) => {
      const term = termRef.current;
      if (!term || !isReadyRef.current) return;

      isExecutingRef.current = true;

      // Show the code being executed
      term.write("\r\n");
      writeLine(`${ANSI.dim}# ── Running circuit ──${ANSI.reset}`);
      const codeLines = code.split("\n");
      for (const line of codeLines) {
        writeLine(`${ANSI.dim}${line}${ANSI.reset}`);
      }
      writeLine("");

      await executePython(code, (text, stream) => {
        if (stream === "stderr") {
          writeLine(text, "red");
        } else {
          writeLine(text);
        }
      });

      writeLine(`${ANSI.dim}# ── Execution complete ──${ANSI.reset}`);
      showPrompt();
      isExecutingRef.current = false;
    }, [writeLine, showPrompt]);

    /** Clear the terminal */
    const clear = useCallback(() => {
      const term = termRef.current;
      if (!term) return;
      term.clear();
      term.write("\x1b[H\x1b[2J"); // full clear
      showPrompt();
    }, [showPrompt]);

    // Expose methods to parent
    useImperativeHandle(ref, () => ({
      runCode,
      writeLine,
      clear,
    }), [runCode, writeLine, clear]);

    /** Handle REPL line execution */
    const executeLine = useCallback(async (line: string) => {
      const term = termRef.current;
      if (!term) return;

      const trimmed = line.trim();

      // Handle multiline blocks
      const isBlockStart = trimmed.endsWith(":");
      const isInMultiline = multilineBufferRef.current.length > 0;

      if (isInMultiline) {
        if (trimmed === "") {
          // Empty line ends multiline block
          const fullCode = multilineBufferRef.current.join("\n");
          multilineBufferRef.current = [];
          isExecutingRef.current = true;
          await executeRepl(fullCode, (text, stream) => {
            if (stream === "stderr") {
              writeLine(text, "red");
            } else {
              writeLine(text);
            }
          });
          isExecutingRef.current = false;
          showPrompt();
          return;
        }
        multilineBufferRef.current.push(line);
        term.write(CONTINUATION);
        return;
      }

      if (isBlockStart) {
        multilineBufferRef.current.push(line);
        term.write(CONTINUATION);
        return;
      }

      // Handle special commands
      if (trimmed === "clear" || trimmed === "cls") {
        clear();
        return;
      }
      if (trimmed === "help()") {
        writeLine("QuantStudio Python Terminal (Pyodide)", "cyan");
        writeLine("  import quantsdk as qs   — Load QuantSDK", "white");
        writeLine("  circuit = qs.Circuit(2)  — Create a circuit", "white");
        writeLine("  circuit.h(0)             — Add gates", "white");
        writeLine("  result = qs.run(circuit) — Run simulation", "white");
        writeLine("  print(result)            — View results", "white");
        writeLine("  clear                    — Clear terminal", "white");
        showPrompt();
        return;
      }

      if (!trimmed) {
        showPrompt();
        return;
      }

      // Add to history
      historyRef.current.unshift(trimmed);
      if (historyRef.current.length > 100) historyRef.current.pop();
      historyIndexRef.current = -1;

      isExecutingRef.current = true;
      await executeRepl(line, (text, stream) => {
        if (stream === "stderr") {
          writeLine(text, "red");
        } else {
          writeLine(text);
        }
      });
      isExecutingRef.current = false;
      showPrompt();
    }, [writeLine, showPrompt, clear]);

    // Initialize xterm.js + Pyodide
    useEffect(() => {
      if (!containerRef.current) return;

      let disposed = false;
      let term: XTerminal | null = null;

      (async () => {
        // Dynamic imports (xterm doesn't work with SSR)
        const [{ Terminal }, { FitAddon }] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
        ]);

        // Also load the CSS dynamically
        if (!document.getElementById("xterm-css")) {
          const link = document.createElement("link");
          link.id = "xterm-css";
          link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/@xterm/xterm@5/css/xterm.min.css";
          document.head.appendChild(link);
        }

        if (disposed) return;

        term = new Terminal({
          cursorBlink: true,
          cursorStyle: "bar",
          fontSize: 13,
          fontFamily: "var(--font-geist-mono), 'Menlo', 'Monaco', 'Courier New', monospace",
          theme: {
            background: "#0d1117",
            foreground: "#c9d1d9",
            cursor: "#58a6ff",
            selectionBackground: "#264f78",
            black: "#0d1117",
            red: "#ff7b72",
            green: "#3fb950",
            yellow: "#d29922",
            blue: "#58a6ff",
            magenta: "#bc8cff",
            cyan: "#39d353",
            white: "#c9d1d9",
          },
          convertEol: true,
          scrollback: 5000,
          allowTransparency: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(containerRef.current!);
        fitAddon.fit();
        termRef.current = term;

        // Handle resize
        const resizeObserver = new ResizeObserver(() => {
          try { fitAddon.fit(); } catch { /* ignore */ }
        });
        resizeObserver.observe(containerRef.current!);

        // Banner
        term.writeln(`\x1b[1m\x1b[36m╔══════════════════════════════════════╗\x1b[0m`);
        term.writeln(`\x1b[1m\x1b[36m║   QuantStudio Python Terminal        ║\x1b[0m`);
        term.writeln(`\x1b[1m\x1b[36m║   Powered by Pyodide (CPython WASM)  ║\x1b[0m`);
        term.writeln(`\x1b[1m\x1b[36m╚══════════════════════════════════════╝\x1b[0m`);
        term.writeln("");
        term.writeln(`\x1b[33mLoading Python runtime... (first load may take a few seconds)\x1b[0m`);

        // Load Pyodide
        try {
          await loadPyodide();
          if (disposed) return;
          term.writeln(`\x1b[32m✓ Python ready  •  Type help() for commands\x1b[0m`);
          term.writeln("");
          isReadyRef.current = true;

          // Show prompt
          term.write(PROMPT);
        } catch (err) {
          if (disposed) return;
          term.writeln(`\x1b[31m✗ Failed to load Python: ${err}\x1b[0m`);
          return;
        }

        // Handle keyboard input
        term.onData((data) => {
          if (!isReadyRef.current || isExecutingRef.current) return;

          // data is a string of characters
          for (const char of data) {
            const code = char.charCodeAt(0);

            if (code === 13) {
              // Enter
              term!.write("\r\n");
              const line = inputBufferRef.current;
              inputBufferRef.current = "";
              executeLine(line);
            } else if (code === 127 || code === 8) {
              // Backspace
              if (inputBufferRef.current.length > 0) {
                inputBufferRef.current = inputBufferRef.current.slice(0, -1);
                term!.write("\b \b");
              }
            } else if (code === 27) {
              // Escape sequences (arrow keys, etc.)
              // Arrow keys come as \x1b[A (up), \x1b[B (down)
              // They arrive as a single data string, handled below
              break;
            } else if (code >= 32) {
              // Printable character
              inputBufferRef.current += char;
              term!.write(char);
            }
          }

          // Handle escape sequences for arrow keys
          if (data === "\x1b[A") {
            // Up arrow — history previous
            if (historyRef.current.length > 0 && historyIndexRef.current < historyRef.current.length - 1) {
              // Clear current input
              const clearLen = inputBufferRef.current.length;
              term!.write("\b \b".repeat(clearLen));

              historyIndexRef.current++;
              const histLine = historyRef.current[historyIndexRef.current];
              inputBufferRef.current = histLine;
              term!.write(histLine);
            }
          } else if (data === "\x1b[B") {
            // Down arrow — history next
            const clearLen = inputBufferRef.current.length;
            term!.write("\b \b".repeat(clearLen));

            if (historyIndexRef.current > 0) {
              historyIndexRef.current--;
              const histLine = historyRef.current[historyIndexRef.current];
              inputBufferRef.current = histLine;
              term!.write(histLine);
            } else {
              historyIndexRef.current = -1;
              inputBufferRef.current = "";
            }
          } else if (data === "\x03") {
            // Ctrl+C
            term!.write("^C\r\n");
            multilineBufferRef.current = [];
            inputBufferRef.current = "";
            isExecutingRef.current = false;
            term!.write(PROMPT);
          } else if (data === "\x0c") {
            // Ctrl+L (clear)
            term!.clear();
            term!.write("\x1b[H\x1b[2J");
            term!.write(PROMPT);
          }
        });

        return () => {
          disposed = true;
          resizeObserver.disconnect();
          term?.dispose();
        };
      })();

      return () => {
        disposed = true;
        term?.dispose();
      };
    }, [executeLine]);

    return (
      <div
        ref={containerRef}
        className={`w-full h-full ${className || ""}`}
        style={{ minHeight: 100, background: "#0d1117" }}
      />
    );
  }
);

PythonTerminal.displayName = "PythonTerminal";
export default PythonTerminal;
