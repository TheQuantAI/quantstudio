// Guard: the QuantSDK browser stub exists in two places —
//   src/lib/quantsdk-stub.py  (edited by devs, loaded by the round-trip tests)
//   public/quantsdk-stub.py   (the file actually fetched at runtime by Pyodide)
// They MUST stay identical. This bit us once (API-014): to_openqasm was added
// to src/lib but not public/, so production ran the old stub. Fail the build
// if they diverge. Long-term fix (STUDIO-017): collapse to a single source.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const a = join(root, "src/lib/quantsdk-stub.py");
const b = join(root, "public/quantsdk-stub.py");

const sa = readFileSync(a, "utf8");
const sb = readFileSync(b, "utf8");

if (sa !== sb) {
  console.error(
    "\n✖ quantsdk-stub.py is out of sync between src/lib and public.\n" +
      "  The runtime fetches public/quantsdk-stub.py — copy your changes there:\n" +
      "    cp src/lib/quantsdk-stub.py public/quantsdk-stub.py\n",
  );
  process.exit(1);
}
console.log("✓ quantsdk-stub.py in sync (src/lib == public)");
