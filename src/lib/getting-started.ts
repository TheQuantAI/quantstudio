// Copyright 2026 TheQuantAI
// STUDIO-018: bundled "Getting Started" guide. Rendered read-only in a modal
// from a pinned explorer entry — a virtual doc, so it's non-deletable, costs no
// storage, and every user always sees this latest copy. Edit the copy here.

export const GETTING_STARTED_TITLE = "Getting Started";

export const GETTING_STARTED_MD = `# Welcome to QuantStudio

Your browser-based IDE for building, running, and organizing quantum work — circuits, scripts, notes, and data, all in one workspace.

## Your workspace

The left rail is your **file explorer**. Create folders and files, drag to move them, rename, download, and search.

- **File types:** \`.py\` (Python / circuits), \`.qasm\` (OpenQASM), \`.md\` (notes), \`.json\` (config/data), \`.csv\` (tabular data).
- **Upload** local files with the ⬆ button or by dragging them onto the rail.
- **Download** any file, or a whole folder as a \`.zip\`.
- **Delete** moves items to **Trash** (restorable) — nothing is lost immediately.

## Editing, by file type

- **\`.py\`** — full Python editor with QuantSDK autocomplete.
- **\`.md\`** — toggle **Edit ⇄ Preview** to see rendered Markdown.
- **\`.csv\`** — opens as an **editable table** (add/remove rows & columns); switch to **Raw** for the text.
- **\`.json\`** — **Format** to pretty-print, and a **Tree** view to explore nested data.
- **\`.qasm\`** — OpenQASM syntax highlighting.

## Running your work

Press **Run** — QuantStudio decides what to do from the file:

- **A circuit** (defines a \`qs.Circuit(...)\`) runs on the **cloud simulator** (or a **real QPU**, if you've connected one). Results appear as a histogram.
- **A plain script** (any other Python) runs **locally in your browser** (Pyodide), with output in the **Terminal**.

Scripts can **read your workspace files** — \`open("data.csv")\` finds a file sitting in the same folder. Popular libraries auto-load on import:

\`\`\`python
import pandas as pd
df = pd.read_csv("data.csv")
print(df.head())
\`\`\`

\`numpy\`, \`pandas\`, \`scipy\`, \`matplotlib\`, \`scikit-learn\`, \`sympy\`, and \`networkx\` are available. For anything else pure-Python, in the Terminal run \`import micropip; await micropip.install("package-name")\`.

## Real hardware

Connect your own **IBM Quantum** account under **Connect** to run circuits on real devices. Your credentials are encrypted; the platform owns no hardware and charges nothing for it. QPU queues can take minutes to hours.

## Saving & storage

**Save** (or **Ctrl/Cmd+S**) writes the active tab into your workspace. A storage indicator in the rail shows your usage against your plan's limits.

---

## Good to know — current limitations

- **File size:** up to **100 KB per file**; total storage is capped by your plan (Explorer / Developer / Team).
- **File types:** only the five above can be created or uploaded.
- **Scripts run in your browser** (Pyodide/WebAssembly): no network access, no interactive \`input()\`, and packages are limited to the bundled set above plus pure-Python PyPI via \`micropip\`. Large computations are slower and memory-bound compared to native Python.
- **Only circuits run on the cloud / QPU.** General Python never executes on our servers — it stays in your browser.
- **Script file access is read-only:** files a script writes inside the run are **not** saved back to your workspace.
- **The CSV table view** is best for modest files; very large CSVs open as raw text.
- **Trash auto-empties after 30 days.** Restore anything before then.
- **QPU runs** require connecting your own IBM Quantum account.

Questions or feedback? We're building this with you — reach out any time.
`;
