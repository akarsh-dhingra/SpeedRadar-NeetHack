// Screenshot a Live2D page after its window.__done promise resolves.  node live2d/shot.mjs <page.html> <out.png>
import path from "node:path";
import { pathToFileURL } from "node:url";
import puppeteer from "puppeteer";
const [page_, out] = process.argv.slice(2);
const b = await puppeteer.launch({ headless: true, executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  args: ["--allow-file-access-from-files", "--disable-web-security", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const p = await b.newPage();
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => { if (m.type() === "error") errs.push(m.text()); });
await p.setViewport({ width: 1920, height: 1080 });
await p.goto(pathToFileURL(path.resolve(page_)).href, { waitUntil: "networkidle0", timeout: 90000 });
console.log("result:", JSON.stringify(await p.evaluate(() => window.__done)));
await p.screenshot({ path: out });
console.log("errors:", errs.length ? errs.slice(0, 5) : "none");
await b.close();
