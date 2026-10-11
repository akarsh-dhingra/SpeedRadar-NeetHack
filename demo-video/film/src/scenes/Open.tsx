import React from "react";
import { C, MONO, SANS, SERIF } from "../theme";
import { map, p, spr, win, rnd, inExpo } from "../anim";
import { L, bt, ls, le } from "../tl";
import { Chip, Label, Spoken, center } from "../ui";
import facts from "../data/facts.json";

const leave = (t: number, at: number) => ({
  transform: `translateY(${-p(t, at - 0.05, at + 0.35, inExpo) * 160}px)`,
  filter: `blur(${p(t, at - 0.05, at + 0.35, inExpo) * 18}px)`,
  opacity: 1 - p(t, at - 0.05, at + 0.3, inExpo),
});

// ── 01 Hook: "Your competitor just doubled their ML team… next quarter… unless your agent finds out first." ──
export const Hook: React.FC<{ t: number }> = ({ t }) => {
  const d = bt("hook1.doubled"), q = bt("hook2.quarter"), f = bt("hook3.first");
  const n = 28;
  return (
    <>
      {/* line 1 + a team that doubles (illustration, no numbers) */}
      {t < ls("hook2") + 0.4 && (
        <div style={{ ...center, flexDirection: "column", gap: 70, ...leave(t, ls("hook2")) }}>
          <Spoken t={t} line={L.hook1} size={112} accents={{ doubled: C.accent }} serif={["doubled"]} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${n}, 26px)`, gap: 10 }}>
              {Array.from({ length: n * 2 }).map((_, i) => {
                const doubled = i >= n;
                const k = doubled ? spr(t, d + (i - n) * 0.012, { damping: 12, stiffness: 240 }) : spr(t, ls("hook1") + 0.2 + i * 0.012);
                return <div key={i} style={{ width: 26, height: 26, borderRadius: 8, background: doubled ? C.accent : C.chip, transform: `scale(${k})`, opacity: k, boxShadow: doubled ? `0 0 16px ${C.accent}88` : "none" }} />;
              })}
            </div>
            <Label style={{ opacity: win(t, ls("hook1") + 0.4, 99) }}>a competitor's ML team · illustration</Label>
          </div>
        </div>
      )}
      {/* line 2: you learn it a quarter late */}
      {t > ls("hook2") - 0.2 && t < ls("hook3") + 0.4 && (
        <div style={{ ...center, flexDirection: "column", gap: 64, ...leave(t, ls("hook3")) }}>
          <Spoken t={t} line={L.hook2} size={112} accents={{ quarter: C.down, next: C.down }} serif={["quarter.", "quarter"]} />
          <div style={{ display: "flex", gap: 18 }}>
            {["Q1", "Q2", "Q3", "Q4"].map((x, i) => {
              const k = spr(t, ls("hook2") + 0.1 + i * 0.07);
              const hit = i === 3 ? spr(t, q, { damping: 10, stiffness: 260 }) : 0;
              return (
                <div key={x} style={{ width: 170, height: 120, borderRadius: 16, border: `1px solid ${i === 3 && t > q ? C.down : C.line2}`, background: i === 3 && t > q ? "rgba(236,95,90,0.12)" : C.card,
                  display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, transform: `translateY(${(1 - k) * 40}px) scale(${1 + hit * 0.08})`, opacity: k }}>
                  <span style={{ fontFamily: MONO, fontSize: 34, color: i === 3 && t > q ? C.down : C.text2 }}>{x}</span>
                  <span style={{ fontFamily: MONO, fontSize: 14, color: C.text3, letterSpacing: 1.5 }}>{i === 0 ? "THEY HIRE" : i === 3 ? "YOU NOTICE" : "·"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* line 3: unless your agent finds out first -> radar pulse */}
      {t > ls("hook3") - 0.2 && (
        <div style={{ ...center }}>
          {[0, 1, 2].map((k) => {
            const r = map(t, f - 0.3 + k * 0.18, f + 1.2 + k * 0.18, 0, 1);
            return <div key={k} style={{ position: "absolute", width: 1400, height: 1400, borderRadius: "50%", border: `2px solid ${C.accent}`, transform: `scale(${r})`, opacity: (1 - r) * 0.7 }} />;
          })}
          <Spoken t={t} line={L.hook3} size={118} accents={{ first: C.accent, "first.": C.accent, agent: C.accent }} serif={["first.", "first"]} />
        </div>
      )}
    </>
  );
};

// ── 02 Title: the radar finds the market; the wordmark lands; what it does, in three beats ──
const COMPS = (facts as any).companies.find((c: any) => c.key === "acme").competitors as string[];

export const Title: React.FC<{ t: number }> = ({ t }) => {
  const a = ls("title1"), r = bt("title1.radar");
  const sweep = (t - a) * 150 - 90;
  const word = "Spend Radar";
  const tags: [string, string, React.ReactNode][] = [
    ["title1.files", C.text, <>reads your <b>finance files</b></>],
    ["title1.data", C.text, <>checks the market with <b>real data</b></>],
    ["title1.wrong", C.down, <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 34 }}>then tries to prove itself wrong</span>],
  ];
  return (
    <div style={{ ...center }}>
      {/* radar */}
      <div style={{ position: "absolute", width: 980, height: 980, transform: `scale(${map(t, a - 0.3, a + 1.2, 0.6, 1)})`, opacity: map(t, a - 0.3, a + 0.6, 0, 0.9) }}>
        {[1, 0.75, 0.5, 0.25].map((s) => <div key={s} style={{ position: "absolute", inset: `${(1 - s) * 50}%`, borderRadius: "50%", border: `1px solid rgba(143,141,240,${0.12 + (1 - s) * 0.1})` }} />)}
        <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: `conic-gradient(from ${sweep}deg, rgba(143,141,240,0.32), rgba(143,141,240,0) 22%)` }} />
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: C.line }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: C.line }} />
        {COMPS.map((name, i) => {
          const ang = (i / COMPS.length) * 360 + 30 + rnd(i) * 30;
          const rad = 0.3 + rnd(i + 9) * 0.15;
          const hitT = a + (((ang + 90) % 360) / 150);
          const k = spr(t, hitT, { damping: 12, stiffness: 220 });
          const x = 490 + Math.cos(((ang - 90) * Math.PI) / 180) * 980 * rad, y = 490 + Math.sin(((ang - 90) * Math.PI) / 180) * 980 * rad;
          return (
            <div key={name} style={{ position: "absolute", left: x, top: y, transform: `translate(-6px,-6px) scale(${k})`, opacity: k, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 12, height: 12, borderRadius: "50%", background: C.up, boxShadow: `0 0 16px ${C.up}` }} />
              <span style={{ fontFamily: MONO, fontSize: 18, color: C.text2 }}>{name}</span>
            </div>
          );
        })}
      </div>
      {/* wordmark */}
      <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", gap: 40 }}>
        <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 196, letterSpacing: -9, color: C.text, display: "flex" }}>
          {word.split("").map((ch, i) => {
            const k = spr(t, r - 0.45 + i * 0.03, { damping: 15, stiffness: 200 });
            return <span key={i} style={{ display: "inline-block", whiteSpace: "pre", transform: `translateY(${(1 - k) * 80}px) rotate(${(1 - k) * 8}deg)`, opacity: k, filter: `blur(${(1 - k) * 10}px)`, color: i >= 6 ? C.accent2 : C.text }}>{ch}</span>;
          })}
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {tags.map(([id, col, txt], i) => {
            const k = spr(t, bt(id) - 0.1, { damping: 16, stiffness: 220 });
            return (
              <div key={id} style={{ padding: "16px 26px", borderRadius: 14, border: `1px solid ${i === 2 ? C.down : C.line2}`, background: i === 2 ? "rgba(236,95,90,0.10)" : "rgba(15,17,18,0.85)",
                fontFamily: SANS, fontSize: 30, color: col, transform: `translateY(${(1 - k) * 50}px) scale(${0.9 + 0.1 * k})`, opacity: k, fontWeight: 400 }}>{txt}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export { le };
