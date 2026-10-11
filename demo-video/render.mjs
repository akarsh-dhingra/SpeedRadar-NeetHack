// Renders the film (comp/index.html) frame by frame in headless Chrome and pipes JPEG frames to ffmpeg.
//   node render.mjs --shard 0 --shards 8      → build/seg_0.mp4 (silent; that shard's slice of frames)
//   node render.mjs --stills 1.2,8,30         → build/still_<t>.png (quick look at single frames)
//   node render.mjs --cues                    → build/cues.json (sound-effect times for music.py --mix)
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BUILD = path.join(HERE, "build");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > -1 ? process.argv[i + 1] ?? true : d; };
const TL = JSON.parse(fs.readFileSync(path.join(BUILD, "timeline.json"), "utf8"));
const clipsIdx = path.join(BUILD, "clips", "index.json");
const CLIPS = fs.existsSync(clipsIdx) ? JSON.parse(fs.readFileSync(clipsIdx, "utf8")) : {};
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const DATA = { run: JSON.parse(fs.readFileSync(path.join(HERE, "film/src/data/run.json"), "utf8")), facts: JSON.parse(fs.readFileSync(path.join(HERE, "film/src/data/facts.json"), "utf8")) };
const OW = 2560, OH = 1440; // output size; the film is drawn in 1920x1080 units and scaled up crisply

const browser = await puppeteer.launch({
  headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ["--no-sandbox", "--allow-file-access-from-files", "--force-color-profile=srgb", "--disable-web-security"],
});
const page = await browser.newPage();
await page.setViewport({ width: OW, height: OH, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument((tl, clips, data) => { window.__TL = tl; window.__CLIPS = clips; window.__DATA = data; }, TL, CLIPS, DATA);
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(pathToFileURL(path.join(HERE, "comp", "index.html")).href, { waitUntil: "networkidle0" });
await page.evaluate(() => window.__fontsReady);
await page.waitForFunction(() => window.__ready === true);

// lossless frames: PNG straight from the canvas pixels
const shot = async (t) => { await page.evaluate((tt) => window.__render(tt), t); return page.screenshot({ type: "png", optimizeForSpeed: true, clip: { x: 0, y: 0, width: OW, height: OH } }); };

if (arg("--cues")) {
  fs.writeFileSync(path.join(BUILD, "cues.json"), JSON.stringify(await page.evaluate(() => window.__cues())));
  console.log("cues written");
} else if (arg("--stills")) {
  const v = String(arg("--stills"));
  const times = v === "auto" ? TL.lines.map((l) => +(l.start + l.dur * 0.75).toFixed(2)) : v.split(",").map(Number);
  for (const t of times) {
    await page.evaluate((tt) => window.__render(tt), t);
    await page.screenshot({ path: path.join(BUILD, `still_${t.toFixed(2)}.png`), type: "png" });
    console.log("still", t);
  }
} else {
  const shards = Number(arg("--shards", 1)), shard = Number(arg("--shard", 0));
  const total = Math.round(TL.duration * TL.fps), per = Math.ceil(total / shards);
  const f0 = shard * per, f1 = Math.min(total, f0 + per);
  const out = path.join(BUILD, `seg_${shard}.mp4`);
  const ff = spawn(FFMPEG, ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(TL.fps), "-c:v", "png", "-i", "-",
    "-c:v", "libx264", "-preset", "slow", "-crf", "15", "-tune", "animation", "-pix_fmt", "yuv420p", "-r", String(TL.fps), out], { stdio: ["pipe", "inherit", "inherit"] });
  const t0 = Date.now();
  for (let f = f0; f < f1; f++) {
    const buf = await shot(f / TL.fps);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if ((f - f0) % 150 === 0) console.log(`shard ${shard}: frame ${f - f0}/${f1 - f0} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`shard ${shard} done: frames ${f0}–${f1 - 1} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
}
await browser.close();
