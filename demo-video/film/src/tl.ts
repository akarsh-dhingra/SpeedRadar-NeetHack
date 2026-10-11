// The timeline (voice/align.py -> src/data/timeline.json) and the beats derived from it (beats.js).
// Everything in the film is timed in seconds from these, so pictures land on the words that name them.
import TL from "./data/timeline.json";
// @ts-ignore plain JS module shared with cues.mjs
import { beats } from "./beats.js";

export type Word = { w: string; t0: number; t1: number };
export type Line = { id: string; scene: string; start: number; dur: number; cap: string; say: string; words: Word[] };
export type Scene = { id: string; start: number; end: number };

export const tl = TL as unknown as { fps: number; duration: number; scenes: Scene[]; lines: Line[]; env: number[] };
export const B: Record<string, { t: number; sfx: string | null; gain: number }> = beats(tl);
export const L: Record<string, Line> = Object.fromEntries(tl.lines.map((l) => [l.id, l]));
export const SC: Record<string, Scene> = Object.fromEntries(tl.scenes.map((s) => [s.id, s]));

/** time of a beat (s) */
export const bt = (id: string) => (B[id] ? B[id].t : 0);
/** start / end of a narration line (s) */
export const ls = (id: string) => (L[id] ? L[id].start : 0);
export const le = (id: string) => (L[id] ? L[id].start + L[id].dur : 0);
/** voice loudness 0..1 at time t */
export const envAt = (t: number) => tl.env[Math.max(0, Math.floor(t * tl.fps))] || 0;
/** the line being spoken (or just spoken) at t */
export const lineAt = (t: number) => {
  let cur: Line | null = null;
  for (const l of tl.lines) if (t >= l.start - 0.05) cur = l;
  return cur;
};
