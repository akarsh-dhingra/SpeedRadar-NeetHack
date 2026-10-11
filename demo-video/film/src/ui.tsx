// Building blocks shared by every scene.
import React from "react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { C, MONO, SANS, SERIF, W, H } from "./theme";
import { map, p, spr, fmt, outExpo } from "./anim";
import { Line, envAt, lineAt, tl } from "./tl";

// ── Ground: one still image for the whole film. Nothing in it moves; motion lives on the content. ──
export const Ground: React.FC = () => (
  <AbsoluteFill style={{ background: C.ground }}>
    <AbsoluteFill style={{
      backgroundImage: "radial-gradient(rgba(255,255,255,0.055) 1.1px, transparent 1.3px)",
      backgroundSize: "36px 36px", backgroundPosition: "18px 18px",
      maskImage: "radial-gradient(ellipse 75% 70% at 50% 45%, black 30%, transparent 85%)",
    }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 60% 50% at 18% 0%, rgba(143,141,240,0.10), transparent 70%)" }} />
    <AbsoluteFill style={{ background: "radial-gradient(ellipse 120% 90% at 50% 50%, transparent 55%, rgba(0,0,0,0.55) 100%)" }} />
  </AbsoluteFill>
);

// Fixed film grain (same texture every frame: texture without flicker).
export const Grain: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.07, mixBlendMode: "overlay" }}>
    <svg width={W} height={H}>
      <filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" /><feColorMatrix type="saturate" values="0" /></filter>
      <rect width="100%" height="100%" filter="url(#g)" />
    </svg>
  </AbsoluteFill>
);

// ── Captions: the spoken words light up as they are said (Whisper word times). ──
// Lines already on screen as giant kinetic type don't also get a caption.
const BIG = new Set(["hook1", "hook2", "hook3", "out1", "out2"]);
export const Captions: React.FC<{ t: number }> = ({ t }) => {
  const l = lineAt(t);
  if (!l || t > l.start + l.dur + 0.35 || BIG.has(l.id)) return null;
  const words = l.cap.split(" ");
  // progress through the spoken words -> progress through the caption words
  const said = l.words.filter((w) => w.t0 <= t).length;
  const frac = l.words.length ? said / l.words.length : p(t, l.start, l.start + l.dur);
  const lit = Math.round(frac * words.length);
  const enter = spr(t, l.start - 0.05, { damping: 20, stiffness: 220 });
  const out = p(t, l.start + l.dur + 0.1, l.start + l.dur + 0.35);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 54, display: "flex", justifyContent: "center", opacity: enter * (1 - out) }}>
      <div style={{
        maxWidth: 1480, padding: "14px 26px", borderRadius: 14, textAlign: "center",
        background: "rgba(11,12,13,0.72)", border: `1px solid ${C.line}`, backdropFilter: "blur(8px)",
        fontFamily: SANS, fontSize: 38, fontWeight: 500, lineHeight: 1.3, letterSpacing: -0.2,
        transform: `translateY(${(1 - enter) * 14}px)`,
      }}>
        {words.map((w, i) => (
          <span key={i} style={{ color: i < lit ? C.text : "rgba(255,255,255,0.42)", transition: "none" }}>{w}{i < words.length - 1 ? " " : ""}</span>
        ))}
      </div>
    </div>
  );
};

// ── Voice mark: the film's narrator. A small radar that answers the voice (loudness per frame). ──
export const VoiceMark: React.FC<{ t: number }> = ({ t }) => {
  const e = envAt(t);
  const sweep = (t * 140) % 360;
  return (
    <div style={{ position: "absolute", right: 56, top: 44, width: 64, height: 64 }}>
      {[0, 1].map((k) => (
        <div key={k} style={{
          position: "absolute", inset: 0, borderRadius: "50%", border: `1.5px solid ${C.accent}`,
          transform: `scale(${0.55 + e * (0.5 + k * 0.35)})`, opacity: 0.25 + e * 0.5 - k * 0.12,
        }} />
      ))}
      <div style={{ position: "absolute", inset: 8, borderRadius: "50%", background: `conic-gradient(from ${sweep}deg, rgba(143,141,240,0.5), transparent 25%)` }} />
      <div style={{ position: "absolute", left: 27, top: 27, width: 10, height: 10, borderRadius: "50%", background: C.accent2, boxShadow: `0 0 ${8 + e * 18}px ${C.accent}` }} />
    </div>
  );
};

// ── Chapter label, top left ──
export const Chapter: React.FC<{ t: number; items: { at: number; n: string; label: string }[] }> = ({ t, items }) => {
  let cur = items[0], ci = 0;
  items.forEach((it, i) => { if (t >= it.at) { cur = it; ci = i; } });
  const k = spr(t, cur.at, { damping: 22, stiffness: 200 });
  return (
    <div style={{ position: "absolute", left: 60, top: 52, display: "flex", alignItems: "center", gap: 16, fontFamily: MONO, fontSize: 17, letterSpacing: 2.5, color: C.text2 }}>
      <span style={{ color: C.text, fontWeight: 600 }}>SPEND RADAR</span>
      <span style={{ width: 28, height: 1, background: C.line2 }} />
      <span style={{ overflow: "hidden", height: 22, display: "inline-block" }}>
        <span style={{ display: "inline-block", transform: `translateY(${(1 - k) * 22}px)`, opacity: k }}>
          <span style={{ color: C.accent }}>{cur.n}</span>&nbsp;&nbsp;{cur.label}
        </span>
      </span>
      <span style={{ display: "flex", gap: 5, marginLeft: 6 }}>
        {items.map((_, i) => <span key={i} style={{ width: i === ci ? 18 : 6, height: 4, borderRadius: 2, background: i <= ci ? C.accent : C.line2 }} />)}
      </span>
    </div>
  );
};

// ── Kinetic words: each word rises out of a mask at the moment it is spoken ──
export const Spoken: React.FC<{
  t: number; line: Line; size?: number; weight?: number; color?: string; accents?: Record<string, string>;
  serif?: string[]; align?: "left" | "center"; maxWidth?: number; lead?: number; style?: React.CSSProperties;
}> = ({ t, line, size = 96, weight = 700, color = C.text, accents = {}, serif = [], align = "center", maxWidth = 1500, lead = 0.06, style }) => {
  const words = line.cap.split(" ");
  const sw = line.words;
  return (
    <div style={{ fontFamily: SANS, fontSize: size, fontWeight: weight, letterSpacing: -size * 0.035, lineHeight: 1.04, color, textAlign: align, maxWidth, ...style }}>
      {words.map((w, i) => {
        const k = sw.length ? Math.min(sw.length - 1, Math.floor((i / words.length) * sw.length)) : 0;
        const at = (sw[k] ? sw[k].t0 : line.start + (i / words.length) * line.dur) - lead;
        const e = spr(t, at, { damping: 18, stiffness: 210 });
        const key = w.toLowerCase().replace(/[^a-z0-9$.%]/g, "");
        const isSerif = serif.includes(key);
        return (
          <span key={i} style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", paddingBottom: size * 0.12, marginRight: size * 0.24 }}>
            <span style={{
              display: "inline-block", transform: `translateY(${(1 - e) * 105}%)`, filter: `blur(${(1 - e) * 6}px)`,
              color: accents[key] || color, fontFamily: isSerif ? SERIF : SANS, fontStyle: isSerif ? "italic" : "normal",
              fontWeight: isSerif ? 400 : weight, letterSpacing: isSerif ? 0 : undefined,
            }}>{w}</span>
          </span>
        );
      })}
    </div>
  );
};

// ── Surfaces ──
export const Panel: React.FC<{ style?: React.CSSProperties; children?: React.ReactNode; glow?: string }> = ({ style, children, glow }) => (
  <div style={{
    background: C.card, border: `1px solid ${C.line}`, borderRadius: 18,
    boxShadow: `0 40px 90px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.02) inset${glow ? `, 0 0 60px ${glow}` : ""}`, ...style,
  }}>{children}</div>
);

/** a real screenshot of the site (film/public/shots) */
export const Shot: React.FC<{ file: string; w: number; style?: React.CSSProperties; radius?: number }> = ({ file, w, style, radius = 16 }) => (
  <Img src={staticFile(`shots/${file}`)} style={{ width: w, display: "block", borderRadius: radius, boxShadow: "0 50px 100px rgba(0,0,0,0.6)", border: `1px solid ${C.line}`, ...style }} />
);

/** browser chrome around a screenshot */
export const Browser: React.FC<{ file: string; w: number; h: number; scroll?: number; url?: string; style?: React.CSSProperties; imgW?: number }> = ({ file, w, h, scroll = 0, url = "akarsh-dhingra.github.io/SpeedRadar-NeetHack", style, imgW }) => (
  <div style={{ width: w, borderRadius: 16, overflow: "hidden", background: C.app, border: `1px solid ${C.line2}`, boxShadow: "0 60px 120px rgba(0,0,0,0.65)", ...style }}>
    <div style={{ height: 44, display: "flex", alignItems: "center", gap: 8, padding: "0 16px", borderBottom: `1px solid ${C.line}`, background: "#16181a" }}>
      {[C.down, C.warn, C.up].map((c) => <span key={c} style={{ width: 11, height: 11, borderRadius: "50%", background: c, opacity: 0.85 }} />)}
      <span style={{ marginLeft: 14, padding: "5px 14px", borderRadius: 8, background: C.field, fontFamily: MONO, fontSize: 15, color: C.text2 }}>{url}</span>
    </div>
    <div style={{ height: h - 44, overflow: "hidden", position: "relative" }}>
      <Img src={staticFile(`shots/${file}`)} style={{ width: imgW || w, display: "block", transform: `translateY(${-scroll}px)` }} />
    </div>
  </div>
);

export const Chip: React.FC<{ children: React.ReactNode; color?: string; bg?: string; style?: React.CSSProperties; mono?: boolean; size?: number }> = ({ children, color = C.text, bg = C.chip, style, mono = true, size = 20 }) => (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: `${size * 0.3}px ${size * 0.6}px`, borderRadius: size * 0.45, background: bg, color, fontFamily: mono ? MONO : SANS, fontSize: size, fontWeight: 500, whiteSpace: "nowrap", ...style }}>{children}</span>
);

export const Label: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.text3, style }) => (
  <div style={{ fontFamily: MONO, fontSize: 16, letterSpacing: 2.4, textTransform: "uppercase", color, ...style }}>{children}</div>
);

/** number that counts from `from` to `to` between a and b */
export const Count: React.FC<{ t: number; a: number; b: number; from?: number; to: number; d?: number; prefix?: string; suffix?: string; style?: React.CSSProperties }> = ({ t, a, b, from = 0, to, d = 0, prefix = "", suffix = "", style }) => {
  const v = map(t, a, b, from, to, outExpo);
  return <span style={{ fontVariantNumeric: "tabular-nums", ...style }}>{prefix}{fmt(v, d)}{suffix}</span>;
};

/** rubber stamp that slams in at `at` */
export const Stamp: React.FC<{ t: number; at: number; text: string; color?: string; rotate?: number; size?: number; style?: React.CSSProperties }> = ({ t, at, text, color = C.down, rotate = -9, size = 64, style }) => {
  if (t < at) return null;
  const k = spr(t, at, { damping: 11, stiffness: 260, mass: 0.7 });
  return (
    <div style={{
      position: "absolute", padding: `${size * 0.18}px ${size * 0.42}px`, border: `${size * 0.07}px solid ${color}`, borderRadius: size * 0.16,
      color, fontFamily: SANS, fontWeight: 800, fontSize: size, letterSpacing: size * 0.06, textTransform: "uppercase",
      transform: `rotate(${rotate}deg) scale(${2.4 - 1.4 * k})`, opacity: Math.min(1, k * 1.6), background: "rgba(11,12,13,0.65)",
      boxShadow: `0 0 50px ${color}55`, ...style,
    }}>{text}</div>
  );
};

/** a line drawn through text, left to right, from `at` */
export const Strike: React.FC<{ t: number; at: number; color?: string; dur?: number; thick?: number }> = ({ t, at, color = C.down, dur = 0.35, thick = 6 }) => (
  <div style={{ position: "absolute", left: -6, top: "52%", height: thick, borderRadius: thick, background: color, width: `calc(${p(t, at, at + dur) * 100}% + 12px)`, boxShadow: `0 0 18px ${color}` }} />
);

/** shake offset (px) after a hit at `at` */
export const shake = (t: number, at: number, amp = 14) => {
  if (t < at) return 0;
  const d = t - at;
  return Math.sin(d * 70) * amp * Math.exp(-d * 9);
};

export const Serif: React.FC<{ children: React.ReactNode; color?: string; style?: React.CSSProperties }> = ({ children, color = C.text, style }) => (
  <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, color, letterSpacing: 0, ...style }}>{children}</span>
);

export const FULL: React.CSSProperties = { position: "absolute", inset: 0 };
export const center: React.CSSProperties = { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" };
export { tl };
