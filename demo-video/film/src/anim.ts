// Motion helpers, all in seconds. Curves are expo/quint outs (fast in, long settle), the house style for this film.
import { Easing, interpolate, spring } from "remotion";
import { FPS } from "./theme";

const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
export const inOut = Easing.bezier(0.65, 0, 0.35, 1);
export const inExpo = Easing.bezier(0.7, 0, 0.84, 0);

/** 0..1 between a and b (s), eased */
export const p = (t: number, a: number, b: number, ease = outExpo) => interpolate(t, [a, b], [0, 1], { ...CL, easing: ease });
/** linear map with clamp */
export const map = (t: number, a: number, b: number, from: number, to: number, ease = outExpo) => interpolate(t, [a, b], [from, to], { ...CL, easing: ease });
/** spring from 0 to 1 starting at `at` (s) */
export const spr = (t: number, at: number, cfg: { damping?: number; stiffness?: number; mass?: number } = {}) =>
  t < at ? 0 : spring({ frame: (t - at) * FPS, fps: FPS, config: { damping: 14, stiffness: 170, mass: 0.9, ...cfg } });
/** visible window: fades in at a, out at b */
export const win = (t: number, a: number, b: number, fin = 0.25, fout = 0.25) =>
  Math.min(p(t, a, a + fin), 1 - p(t, b - fout, b, inExpo));
export const lerp = (a: number, b: number, k: number) => a + (b - a) * k;
export const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
/** deterministic pseudo-random 0..1 */
export const rnd = (i: number) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
