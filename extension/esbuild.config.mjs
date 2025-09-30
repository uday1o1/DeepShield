import { build } from "esbuild";
import { cpSync, rmSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const outdir = "dist";

// clean
if (existsSync(outdir)) rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

// copy public (html/css/icons/thresholds)
cpSync("public", outdir, { recursive: true });

// copy models
cpSync("models", join(outdir, "models"), { recursive: true });

// copy mediapipe wasm
cpSync(
  "node_modules/@mediapipe/tasks-vision/wasm",
  join(outdir, "vendor/mediapipe/wasm"),
  { recursive: true }
);

// bundle TS → JS
await build({
  entryPoints: {
    service_worker: "src/service_worker.ts",
    content_script: "src/content_script.ts",
    offscreen: "src/offscreen.ts",
    popup: "src/popup.ts" // <-- popup bundle
  },
  bundle: true,
  format: "esm",
  sourcemap: true,
  target: ["chrome120"],
  outdir
});

console.log("Built to", outdir);
