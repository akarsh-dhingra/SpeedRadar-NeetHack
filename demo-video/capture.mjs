// Captures the real evidence site (../site) for the film, in headless Chrome:
//   film/public/shots/<view>.png         full page at 2x (motion off, so every number is settled)
//   film/public/shots/<view>-card<i>.png each card on that page, cut out, for "exploded UI" shots
//   film/public/shots/manifest.json      sizes, card titles and boxes (CSS px) per view
//   film/public/clips/<name>.mp4         real-time recordings of the site's own animations (30 fps)
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import puppeteer from "puppeteer";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PUB = path.join(HERE, "film", "public");
const SHOTS = path.join(PUB, "shots"), CLIPS = path.join(PUB, "clips");
const SITE = pathToFileURL(path.join(HERE, "..", "site", "index.html")).href;
const W = 1600, H = 900, FPS = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const FFMPEG = process.env.FFMPEG || "ffmpeg";
fs.mkdirSync(SHOTS, { recursive: true });
fs.mkdirSync(CLIPS, { recursive: true });

const VIEWS = [
  { name: "overview", hash: "overview" },
  { name: "run", hash: "run", company: "bastion" },
  { name: "run-acme", hash: "run", company: "acme" },
  { name: "disproved", hash: "disproved" },
  { name: "recovery", hash: "recovery" },
  { name: "compare", hash: "compare" },
  { name: "business", hash: "business" },
  { name: "traces", hash: "traces" },
  { name: "entire", hash: "entire" },
];

async function open(browser, hash, { company = "", motion = "off", scale = 2 } = {}) {
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: scale });
  await page.evaluateOnNewDocument((c, m) => {
    try { if (c) localStorage.setItem("sr.company", c); localStorage.setItem("sr.motion", m); } catch (e) {}
  }, company, motion);
  await page.goto(`${SITE}${motion === "off" ? "?motion=off" : ""}#${hash}`, { waitUntil: "networkidle0" });
  await page.evaluate(() => document.fonts.ready);
  return page;
}

const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--force-color-profile=srgb", "--allow-file-access-from-files"] });
const manifest = {};

for (const v of VIEWS) {
  const page = await open(browser, v.hash, { company: v.company });
  await sleep(1200);
  const file = `${v.name}.png`;
  await page.screenshot({ path: path.join(SHOTS, file), fullPage: true });
  const info = await page.evaluate(() => {
    const cards = [...document.querySelectorAll(".ac-card")].map((el) => {
      const r = el.getBoundingClientRect();
      const title = (el.querySelector(".ac-card-title, .ac-title, h2, h3")?.textContent || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80);
      return { title, box: [r.left + scrollX, r.top + scrollY, r.width, r.height] };
    }).filter((c) => c.box[2] > 40 && c.box[3] > 30);
    return { w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight, cards };
  });
  // Sticky/fixed bars would otherwise be printed over tall cards when they are cut out.
  await page.addStyleTag({ content: ".ac-topbar{position:static!important}" }).catch(() => {});
  await page.evaluate(() => document.querySelectorAll("*").forEach((el) => {
    const p = getComputedStyle(el).position;
    if (p === "sticky" || p === "fixed") el.style.setProperty("position", "static", "important");
  }));
  const cards = [];
  const els = await page.$$(".ac-card");
  let i = 0;
  for (const el of els) {
    const box = await el.boundingBox();
    if (!box || box.width <= 40 || box.height <= 30) continue;
    const f = `${v.name}-card${i}.png`;
    await el.screenshot({ path: path.join(SHOTS, f) });
    cards.push({ file: f, ...info.cards[i] });
    i++;
  }
  manifest[v.name] = { file, w: info.w, h: info.h, cards };
  console.log(`${v.name}: ${info.w}x${info.h}, ${cards.length} cards`);
  await page.close();
}
fs.writeFileSync(path.join(SHOTS, "manifest.json"), JSON.stringify(manifest, null, 1));

// Real-time clips of the site's own motion.
const CLIP_SPECS = [
  { name: "intro", hash: "overview", seconds: 7.5, skipIntro: false, during: [] },
  { name: "proof", hash: "overview", seconds: 6, skipIntro: true,
    pre: async (p) => { await p.evaluate(() => document.getElementById("featured")?.scrollIntoView({ block: "center" })); await sleep(700); },
    during: [[0.2, (p) => p.click("[data-replay-chain]")]] },
  { name: "run", hash: "run", seconds: 8, skipIntro: true, company: "bastion",
    during: [[0.3, (p) => p.click("[data-replay-run]").catch(() => {})], [2.2, (p) => p.evaluate(() => document.getElementById("timeline")?.scrollIntoView({ behavior: "smooth", block: "start" }))]] },
];

for (const c of process.env.SKIP_CLIPS ? [] : CLIP_SPECS) {
  const page = await open(browser, c.hash, { company: c.company, motion: "on", scale: 1.2 });
  if (c.skipIntro) { await page.keyboard.press("Escape"); await sleep(2600); }
  if (c.pre) await c.pre(page);
  const frames = [];
  const t0 = Date.now() / 1000;
  const timers = c.during.map(([at, fn]) => setTimeout(() => fn(page).catch(() => {}), at * 1000));
  while (Date.now() / 1000 < t0 + c.seconds) {
    frames.push({ t: Date.now() / 1000, data: await page.screenshot({ type: "jpeg", quality: 90, optimizeForSpeed: true }) });
  }
  timers.forEach(clearTimeout);
  await page.close();
  // Resample to a constant 30 fps (nearest earlier frame) and encode.
  const dir = path.join(CLIPS, `_${c.name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(c.seconds * FPS);
  for (let k = 0, j = 0; k < n; k++) {
    while (j + 1 < frames.length && frames[j + 1].t <= t0 + k / FPS) j++;
    fs.writeFileSync(path.join(dir, `${String(k).padStart(5, "0")}.jpg`), frames[j].data);
  }
  const r = spawnSync(FFMPEG, ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", path.join(dir, "%05d.jpg"),
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "16", "-pix_fmt", "yuv420p", path.join(CLIPS, `${c.name}.mp4`)], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed for ${c.name}`);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`clip ${c.name}: ${frames.length} captured -> ${n} frames`);
}
await browser.close();
