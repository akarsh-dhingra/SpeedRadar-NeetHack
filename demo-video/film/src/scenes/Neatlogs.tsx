// 06 neatlogs: the site's neatlogs stats (real screenshots), a trace waterfall of the featured run, case study 02
// (3 of 5 peers thrown away -> all 5 kept, credits 26.6 -> 5.4) and case study 05 (3 verdicts -> 1).
import React from "react";
import { C, MONO, SANS } from "../theme";
import { map, p, spr, win, inExpo, rnd } from "../anim";
import { bt, ls, le } from "../tl";
import { Chip, Count, Label, Panel, Serif, Shot } from "../ui";
import facts from "../data/facts.json";
import run from "../data/run.json";

const FX = facts as any, R = run as any;
const VCOL: Record<string, string> = { confirmed: C.up, overturned: C.down, downgraded: C.warn };

// Spans in the order the run made them (from the task log): LLM spans (plan, decide, audit) and tool spans.
const SPANS = (() => {
  const out: { name: string; kind: "llm" | "tool" | "verify" | "retry" }[] = [{ name: "plan", kind: "llm" }];
  for (const tk of (R.tasks as any[]).slice(0, 14)) {
    out.push({ name: `act:${tk.tool}`, kind: tk.recovery ? "retry" : "tool" });
    if (tk.status !== "done") { out.push({ name: "verify:totals", kind: "verify" }); out.push({ name: "decide:recovery", kind: "llm" }); }
  }
  out.push({ name: "audit:f_ml_ai", kind: "llm" }, { name: "report", kind: "tool" });
  return out.slice(0, 18);
})();

export const Neatlogs: React.FC<{ t: number }> = ({ t }) => {
  const a1 = ls("nl1"), a2 = ls("nl2"), a3 = ls("nl3"), end = le("nl3") + 0.3;
  const hl = t < bt("nl1.retry") ? "llm" : t < bt("nl1.decision") ? "retry" : "llm";
  const showHl = t > bt("nl1.call") - 0.1 && t < a2;
  const three = bt("nl2.three"), fix = bt("nl2.fix"), cut = bt("nl2.cut");
  const peers = ["Honeycomb", "Sentry", "Arize", "Chronosphere", "Grafana Labs"];
  const thrown = new Set(["Honeycomb", "Arize", "Chronosphere"]);
  const one = bt("nl3.one");
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* nl1: stats strip (site screenshots) + waterfall */}
      {t < a2 + 0.4 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - p(t, a2 - 0.05, a2 + 0.35, inExpo), transform: `translateY(${-p(t, a2 - 0.05, a2 + 0.35, inExpo) * 120}px)` }}>
          <div style={{ position: "absolute", left: 120, top: 150, display: "flex", alignItems: "baseline", gap: 22 }}>
            <span style={{ fontFamily: SANS, fontSize: 84, fontWeight: 800, letterSpacing: -3, opacity: spr(t, a1) }}>neatlogs</span>
            <span style={{ fontFamily: MONO, fontSize: 20, color: C.text3, opacity: spr(t, a1 + 0.2) }}>trace {R.trace.slice(0, 12)}… · run {R.run_id}</span>
          </div>
          <div style={{ position: "absolute", right: 120, top: 150, display: "flex", gap: 14 }}>
            {[0, 1, 2, 3].map((i) => {
              const e = spr(t, a1 + 0.15 + i * 0.08);
              return <div key={i} style={{ opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}><Shot file={`traces-card${i}.png`} w={250} radius={12} /></div>;
            })}
          </div>
          <Panel style={{ position: "absolute", left: 120, right: 120, top: 330, height: 520, padding: "22px 30px", overflow: "hidden" }}>
            {SPANS.map((s, i) => {
              const e = spr(t, a1 + 0.1 + i * 0.07, { damping: 22, stiffness: 240 });
              const x = 330 + i * 62 + rnd(i) * 20, w = s.kind === "llm" ? 240 + rnd(i + 3) * 160 : 70 + rnd(i + 5) * 90;
              const col = s.kind === "llm" ? C.accent : s.kind === "verify" ? C.down : s.kind === "retry" ? C.warn : C.up;
              const lit = showHl && (s.kind === hl || (hl === "llm" && s.name === "decide:recovery"));
              return (
                <div key={i} style={{ position: "absolute", top: 18 + i * 27, left: 0, right: 0, height: 22, opacity: e }}>
                  <span style={{ position: "absolute", left: 0, width: 300, fontFamily: MONO, fontSize: 16, color: lit ? C.text : C.text3 }}>{s.name}</span>
                  <div style={{ position: "absolute", left: x, top: 3, height: 16, width: w * e, borderRadius: 4, background: col, opacity: showHl ? (lit ? 1 : 0.25) : 0.8, boxShadow: lit ? `0 0 18px ${col}` : "none" }} />
                </div>
              );
            })}
            <div style={{ position: "absolute", right: 30, top: 20, display: "flex", gap: 10, zIndex: 2 }}>
              {[["every call", "nl1.call", C.accent], ["every retry", "nl1.retry", C.warn], ["every decision", "nl1.decision", C.accent]].map(([txt, id, col]) => {
                const e = spr(t, bt(id) - 0.1, { damping: 12, stiffness: 260 });
                return <Chip key={txt} size={22} color={col} bg="rgba(255,255,255,0.04)" style={{ opacity: e, transform: `scale(${0.8 + 0.2 * e})`, border: `1px solid ${col}` }}>{txt}</Chip>;
              })}
            </div>
          </Panel>
        </div>
      )}

      {/* nl2: case study 02 */}
      {t > a2 - 0.3 && t < a3 + 0.4 && (
        <div style={{ position: "absolute", inset: 0, opacity: spr(t, a2 - 0.1) * (1 - p(t, a3 - 0.05, a3 + 0.35, inExpo)) }}>
          <div style={{ position: "absolute", left: 120, top: 160 }}>
            <Label color={C.accent2}>case study 02 · found in trace af0df27e… · n = 1 run per side</Label>
            <div style={{ fontFamily: SANS, fontSize: 60, fontWeight: 700, letterSpacing: -2, marginTop: 12 }}>
              {t < fix ? <>It threw away <Serif color={C.down}>3 of its 5</Serif> peers.</> : <>The fix kept <Serif color={C.up}>all 5.</Serif></>}
            </div>
          </div>
          <div style={{ position: "absolute", left: 120, top: 350, display: "flex", gap: 20 }}>
            {peers.map((n, i) => {
              const gone = thrown.has(n) && t > three + i * 0.08 && t < fix + i * 0.06;
              const e = spr(t, a2 + 0.1 + i * 0.06);
              return (
                <div key={n} style={{ position: "relative", padding: "22px 26px", borderRadius: 14, background: gone ? "rgba(236,95,90,0.08)" : C.card, border: `1px solid ${gone ? C.down : t > fix ? "rgba(61,191,85,0.6)" : C.line2}`,
                  fontFamily: SANS, fontSize: 30, color: gone ? C.text3 : C.text, opacity: e, transform: `translateY(${gone ? 24 : 0}px) rotate(${gone ? (i % 2 ? 4 : -4) : 0}deg)` }}>
                  {n}
                  {gone && <div style={{ fontFamily: MONO, fontSize: 15, color: C.down, marginTop: 6 }}>→ substitute_competitor</div>}
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 120, top: 500, fontFamily: MONO, fontSize: 21, color: C.down, opacity: win(t, three + 0.4, fix) }}>replaced by New Relic (3,095 people, 9.4× Acme) and Datadog (10,482)</div>
          <Panel style={{ position: "absolute", left: 120, right: 120, top: 590, padding: "28px 36px", opacity: spr(t, cut - 0.6) }}>
            <Label>crustdata credits per run</Label>
            <div style={{ display: "flex", alignItems: "center", gap: 30, marginTop: 14 }}>
              <div style={{ height: 34, borderRadius: 8, background: t > cut ? C.up : C.down, width: map(t, cut - 0.2, cut + 0.8, 1, 5.4 / 26.6) * 1100 }} />
              <span style={{ fontFamily: SANS, fontSize: 64, fontWeight: 800, color: t > cut ? C.up : C.text }}><Count t={t} a={cut - 0.2} b={cut + 0.8} from={26.6} to={5.4} d={1} /></span>
            </div>
          </Panel>
        </div>
      )}

      {/* nl3: case study 05 */}
      {t > a3 - 0.3 && (
        <div style={{ position: "absolute", inset: 0, opacity: spr(t, a3 - 0.1) * (1 - p(t, end - 0.1, end + 0.3)) }}>
          <div style={{ position: "absolute", left: 120, top: 160 }}>
            <Label color={C.accent2}>case study 05 · same Acme data, 5 identical runs per side</Label>
            <div style={{ fontFamily: SANS, fontSize: 60, fontWeight: 700, letterSpacing: -2, marginTop: 12 }}>
              {t < one ? <>Same data. <Serif color={C.down}>Three</Serif> different verdicts.</> : <>Now: <Serif color={C.warn}>one.</Serif> Every time.</>}
            </div>
          </div>
          <div style={{ position: "absolute", left: 120, right: 120, top: 380, display: "flex", gap: 24 }}>
            {(FX.case05.before as string[]).map((v, i) => {
              const after = FX.case05.after[i];
              const k = spr(t, one + i * 0.07, { damping: 13, stiffness: 230 });
              const e = spr(t, a3 + 0.1 + i * 0.08);
              const cur = k > 0.5 ? after : v;
              return (
                <Panel key={i} style={{ flex: 1, padding: "30px 24px", textAlign: "center", opacity: e, border: `1px solid ${VCOL[cur]}`, transform: `translateY(${(1 - e) * 40 + (k > 0 && k < 1 ? Math.sin(k * Math.PI) * -24 : 0)}px) rotateY(${k * 180}deg)` }}>
                  <div style={{ transform: k > 0.5 ? "rotateY(180deg)" : "none" }}>
                    <div style={{ fontFamily: MONO, fontSize: 18, color: C.text3 }}>run {i + 1}</div>
                    <div style={{ fontFamily: SANS, fontSize: 36, fontWeight: 700, color: VCOL[cur], marginTop: 10 }}>{cur}</div>
                  </div>
                </Panel>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 120, top: 600, display: "flex", gap: 40, alignItems: "baseline", opacity: spr(t, one + 0.4) }}>
            <span style={{ fontFamily: SANS, fontSize: 96, fontWeight: 800, letterSpacing: -4 }}>3 <span style={{ color: C.text3 }}>→</span> 1</span>
            <span style={{ fontFamily: SANS, fontSize: 30, color: C.text2 }}>distinct verdicts · the decision moved from the LLM to Python</span>
          </div>
        </div>
      )}
    </div>
  );
};
