// Palette and type follow the evidence site (site/tokens.css, the "Audit Console" design system), so the film
// and the site read as one product. Dark, quiet ground; colour is reserved for meaning (up / down / accent / warn).
import { loadFont as geist } from "@remotion/google-fonts/Geist";
import { loadFont as geistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as serif } from "@remotion/google-fonts/InstrumentSerif";

export const SANS = geist("normal", { weights: ["400", "500", "600", "700", "800"], subsets: ["latin"] }).fontFamily;
export const MONO = geistMono("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily;
export const SERIF = serif("italic", { weights: ["400"], subsets: ["latin"] }).fontFamily;

export const C = {
  ground: "#0b0c0d",
  app: "#131517",
  card: "#0f1112",
  field: "#1a1c1e",
  chip: "#26282a",
  line: "rgba(255,255,255,0.08)",
  line2: "rgba(255,255,255,0.14)",
  text: "#ffffff",
  text2: "#a8aaac",
  text3: "#808385",
  up: "#3dbf55",
  down: "#ec5f5a",
  accent: "#8f8df0",
  accent2: "#a9a7ff",
  warn: "#e3b04b",
};

export const W = 1920, H = 1080, FPS = 30;
