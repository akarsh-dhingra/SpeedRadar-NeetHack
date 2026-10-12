// Finds text that spills out of the box it sits in, or off the frame, across the whole film.
//   node check_text.mjs [step=0.2]   -> prints each overflow once (first time seen), worst first
// Uses the renderer's check mode (window.__CHECK): every drawn box and text run as screen rectangles.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const TL = JSON.parse(fs.readFileSync(path.join(HERE, "build", "timeline.json"), "utf8"));
const DATA = { run: JSON.parse(fs.readFileSync(path.join(HERE, "film/src/data/run.json"), "utf8")), facts: JSON.parse(fs.readFileSync(path.join(HERE, "film/src/data/facts.json"), "utf8")) };
const step = Number(process.argv[2] || 0.2);
const browser = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, args: ["--allow-file-access-from-files", "--disable-web-security", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setViewport({ width: 2560, height: 1440 });
await page.evaluateOnNewDocument((tl, data) => { window.__TL = tl; window.__CLIPS = {}; window.__DATA = data; window.__CHECK = true; }, TL, DATA);
await page.goto(pathToFileURL(path.join(HERE, "comp", "index.html")).href, { waitUntil: "networkidle0", timeout: 120000 });
await page.evaluate(() => window.__fontsReady);
await page.waitForFunction(() => window.__ready === true, { timeout: 120000 });
const found = new Map();
const sceneAt = (t) => (TL.scenes.find((s) => t >= s.start && t < s.end) || {}).id;
for (let t = 0; t < TL.duration; t += step) {
  const log = await page.evaluate((tt) => window.__checkFrame(tt), t);
  log.forEach((r, i) => { r.i = i; });
  const boxes = log.filter((r) => r.kind === "box" && r.x1 - r.x0 > 20 && r.y1 - r.y0 > 20 && r.x1 - r.x0 < 1900);
  // anything Sora stands in front of (she is drawn as a "char" rectangle)
  for (const c of log.filter((r) => r.kind === "char")) {
    const start = log.slice(0, c.i).map((q) => q.kind).lastIndexOf("charStart"); // her own parts are drawn after this
    for (const r of log.filter((q) => (q.kind === "text" && q.a > 0.35 || q.kind === "box" && q.x1 - q.x0 < 1600) && q.i < (start >= 0 ? start : c.i))) {
      const ix = Math.min(r.x1, c.x1) - Math.max(r.x0, c.x0), iy = Math.min(r.y1, c.y1) - Math.max(r.y0, c.y0);
      if (ix > 6 && iy > 6) {
        const key = "behind Sora|" + (r.label || "box@" + [r.x0, r.y0].map(Math.round));
        const over = Math.round(Math.min(ix, iy));
        if (!found.has(key) || found.get(key).over < over) found.set(key, { t: +t.toFixed(2), scene: sceneAt(t), issue: "behind Sora", text: (r.label || "box").slice(0, 60), over, where: `${r.kind} ${[r.x0, r.y0, r.x1, r.y1].map(Math.round)}` });
      }
    }
  }
  for (const r of log.filter((r) => r.kind === "text" && r.a > 0.35)) {
    const cx = (r.x0 + r.x1) / 2, cy = (r.y0 + r.y1) / 2;
    let issue = null, over = 0;
    if (r.x0 < -2 || r.x1 > 1922 || r.y0 < -2 || r.y1 > 1082) { issue = "off frame"; over = Math.max(-r.x0, r.x1 - 1920, -r.y0, r.y1 - 1080); }
    else {
      // the box the text sits in: the last box drawn before it whose area contains the text's centre
      const host = boxes.filter((b) => b.i < r.i && cx > b.x0 && cx < b.x1 && cy > b.y0 && cy < b.y1).sort((a, b) => b.i - a.i)[0];
      if (host) { over = Math.max(host.x0 - r.x0, r.x1 - host.x1, host.y0 - r.y0, r.y1 - host.y1); if (over > 4) issue = "out of its box"; r.host = host; }
    }
    if (issue) {
      const key = issue + "|" + r.label;
      if (!found.has(key) || found.get(key).over < over) found.set(key, { t: +t.toFixed(2), scene: sceneAt(t), issue, text: r.label.slice(0, 70), over: Math.round(over),
        where: `text ${[r.x0, r.y0, r.x1, r.y1].map(Math.round)}` + (r.host ? ` box ${[r.host.x0, r.host.y0, r.host.x1, r.host.y1].map(Math.round)}` : "") });
    }
  }
}
await browser.close();
const rows = [...found.values()].sort((a, b) => b.over - a.over);
for (const r of rows) console.log(`${String(r.over).padStart(4)}px  ${r.issue.padEnd(15)} t=${String(r.t).padEnd(7)} ${String(r.scene).padEnd(9)} "${r.text}"  ${r.where}`);
console.log(`${rows.length} overflowing text runs`);
