// build/timeline.json -> build/cues.json: the sound-effect hits for music.py --mix, from the same beats the film animates to.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beats } from "./src/beats.js";

const BUILD = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "build");
const tl = JSON.parse(fs.readFileSync(path.join(BUILD, "timeline.json"), "utf8"));
const cues = Object.entries(beats(tl))
  .filter(([, b]) => b.sfx)
  .map(([id, b]) => ({ id, t: +b.t.toFixed(3), sfx: b.sfx, gain: b.gain }))
  .sort((a, b) => a.t - b.t);
fs.writeFileSync(path.join(BUILD, "cues.json"), JSON.stringify(cues, null, 1));
console.log(`${cues.length} cues`);
