import { build } from "esbuild";
import { cpSync, rmSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const outdir = "dist";
if (existsSync(outdir)) rmSync(outdir, { recursive: true, force: true });
mkdirSync(outdir, { recursive: true });

// Copy static
cpSync("public", outdir, { recursive: true });

// Copy models
cpSync("models", join(outdir, "models"), { recursive: true });

// Copy MediaPipe WASM assets so they load at runtime
cpSync("node_modules/@mediapipe/tasks-vision/wasm", join(outdir, "vendor/mediapipe/wasm"), { recursive: true });

await build({
  entryPoints: {
    service_worker: "src/service_worker.ts",
    content_script: "src/content_script.ts",
    offscreen: "src/offscreen.ts"
  },
  bundle: true,
  format: "esm",
  sourcemap: true,
  target: ["chrome120"],
  outdir
});

console.log("Built to", outdir);
