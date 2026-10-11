// Films the real evidence site (../site) in headless Chrome, in real time, and stores each clip as
// 30 fps JPEG frames: build/clips/<name>/00000.jpg … plus build/clips/index.json {name: frameCount}.
// Uses the DevTools screencast (frames arrive with timestamps), then resamples to a constant 30 fps.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, "build", "clips");
const SITE = pathToFileURL(path.join(HERE, "..", "site", "index.html")).href;
const W = 1600, H = 900, FPS = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Each clip: where to go, what to do before filming, what to do while filming, how long.
const CLIPS = [
  { name: "intro", hash: "overview", seconds: 8.5, pre: async () => {}, during: [] },
  { name: "proof", hash: "overview", seconds: 5.5, skipIntro: true,
    pre: async (p) => { await p.evaluate(() => document.getElementById("featured").scrollIntoView({ block: "center" })); await sleep(600); },
    during: [[0.15, async (p) => p.click("[data-replay-chain]")]] },
  { name: "matrix", hash: "overview", seconds: 4.0, skipIntro: true,
    pre: async (p) => { await p.evaluate(() => window.scrollTo(0, 0)); await sleep(300); }, during: [] },
  { name: "run", hash: "run", seconds: 9.0, skipIntro: true, company: "bastion",
    pre: async (p) => { await sleep(200); }, during: [[1.4, async (p) => p.evaluate(() => document.getElementById("timeline").scrollIntoView({ block: "start" }))]] },
  { name: "recovery", hash: "recovery", seconds: 4.5, skipIntro: true,
    pre: async () => {}, during: [[2.6, async (p) => p.evaluate(() => window.scrollBy({ top: 520, behavior: "smooth" }))]] },
  { name: "compare", hash: "compare", seconds: 4.0, skipIntro: true, pre: async () => {}, during: [] },
  { name: "business", hash: "business", seconds: 4.5, skipIntro: true, pre: async () => {}, during: [] },
  { name: "traces", hash: "traces", seconds: 3.5, skipIntro: true,
    pre: async () => {}, during: [[0.8, async (p) => p.evaluate(() => window.scrollBy({ top: 700, behavior: "smooth" }))]] },
];

async function film(browser, clip) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument((company) => {
    try { if (company) localStorage.setItem("sr.company", company); localStorage.setItem("sr.motion", "on"); } catch (e) {}
  }, clip.company || "");
  await page.goto(`${SITE}#${clip.hash}`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  if (clip.skipIntro) {
    await page.keyboard.press("Escape");
    await sleep(2600); // let the screen finish assembling before filming
  }
  await clip.pre(page);

  const client = await page.target().createCDPSession();
  const frames = [];
  client.on("Page.screencastFrame", async (f) => {
    frames.push({ t: f.metadata.timestamp, data: f.data });
    client.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await client.send("Page.startScreencast", { format: "jpeg", quality: 88, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
  const t0 = Date.now() / 1000;
  const timers = clip.during.map(([at, fn]) => setTimeout(() => fn(page).catch(() => {}), at * 1000));
  // Keep a heartbeat of plain screenshots too, so static stretches still have frames.
  const end = t0 + clip.seconds;
  while (Date.now() / 1000 < end) {
    const shot = await page.screenshot({ type: "jpeg", quality: 88, encoding: "base64", optimizeForSpeed: true });
    frames.push({ t: Date.now() / 1000, data: shot });
    await sleep(30);
  }
  timers.forEach(clearTimeout);
  await client.send("Page.stopScreencast").catch(() => {});
  await page.close();

  frames.sort((a, b) => a.t - b.t);
  const dir = path.join(OUT, clip.name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(clip.seconds * FPS);
  let j = 0;
  for (let k = 0; k < n; k++) {
    const target = t0 + k / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= target) j++;
    fs.writeFileSync(path.join(dir, String(k).padStart(5, "0") + ".jpg"), Buffer.from(frames[j].data, "base64"));
  }
  console.log(`${clip.name}: ${frames.length} captured → ${n} frames`);
  return n;
}

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb"] });
const index = {};
for (const clip of CLIPS) index[clip.name] = await film(browser, clip);
await browser.close();
fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
