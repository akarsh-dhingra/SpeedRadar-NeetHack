// Quick look at single frames (cheap: one bundle, a handful of stills).
//   node stills.mjs 83,172,486            -> out/still_<frame>.png
//   node stills.mjs lines                 -> one still at 80% of each narration line
// BROWSER=<path to Chrome/Edge> to use an installed browser instead of downloading one.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const arg = process.argv[2] || "lines";
const tl = JSON.parse(fs.readFileSync(path.join(HERE, "src/data/timeline.json"), "utf8"));
const frames = arg === "lines" ? tl.lines.map((l) => Math.round((l.start + l.dur * 0.8) * tl.fps)) : arg.split(",").map(Number);
const serveUrl = await bundle({ entryPoint: path.join(HERE, "src/index.ts") });
const opts = { serveUrl, browserExecutable: process.env.BROWSER || null, chromiumOptions: { gl: "angle" } };
const composition = await selectComposition({ ...opts, id: "Film" });
fs.mkdirSync(path.join(HERE, "out"), { recursive: true });
for (const frame of frames) {
  await renderStill({ ...opts, composition, frame, output: path.join(HERE, "out", `still_${String(frame).padStart(5, "0")}.png`), imageFormat: "png" });
  console.log("still", frame);
}
