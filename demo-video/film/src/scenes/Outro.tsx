// 09 Close: every number in the film flies back to its source file; wordmark; team; links.
import React from "react";
import { C, MONO, SANS } from "../theme";
import { map, spr, rnd } from "../anim";
import { L, bt, ls } from "../tl";
import { Chip, Label, Serif, Spoken, center } from "../ui";

const SOURCES = [
  ["71 checks", "runs/1011-777bb7/state.json"], ["5 of 10", "frontend_data.json"], ["$5,280,000", "report.md · overturned"],
  ["7 companies", "frontend_data.json summary"], ["26.6 → 5.4", "case-studies/02"], ["3 → 1", "case-studies/05"],
  ["69 checkpoints", "frontend_data.json entire"], ["$0.0285", "cfo.ai Assumptions"], ["Jan 2028", "cfo.ai Monthly P&L & Cash"],
];

export const Outro: React.FC<{ t: number }> = ({ t }) => {
  const a = ls("out1"), b = ls("out2");
  return (
    <div style={{ ...center }}>
      {SOURCES.map(([n, src], i) => {
        const ang = (i / SOURCES.length) * Math.PI * 2 + 0.4;
        const k = spr(t, a - 0.2 + i * 0.05, { damping: 18, stiffness: 120 });
        const gone = spr(t, b - 0.2, { damping: 20, stiffness: 160 });
        const r = map(k, 0, 1, 1.6, 1 + rnd(i) * 0.06) * (1 - gone * 0.9);
        return (
          <div key={n} style={{ position: "absolute", left: 960 + Math.cos(ang) * 840 * r, top: 500 + Math.sin(ang) * 400 * r, transform: "translate(-50%,-50%)", opacity: k * (1 - gone), textAlign: "center" }}>
            <div style={{ fontFamily: SANS, fontSize: 30, fontWeight: 700, color: C.text }}>{n}</div>
            <div style={{ fontFamily: MONO, fontSize: 14, color: C.accent2 }}>↳ {src}</div>
          </div>
        );
      })}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28 }}>
        <Spoken t={t} line={L.out1} size={92} maxWidth={1800} accents={{ source: C.accent2, "source.": C.accent2 }} serif={["source.", "source"]} />
        <div style={{ display: "flex", gap: 16, alignItems: "center", opacity: spr(t, b - 0.1), transform: `translateY(${(1 - spr(t, b - 0.1)) * 30}px)` }}>
          <Chip size={26}>team qwep</Chip>
          <Chip size={26} color={C.accent2} bg="rgba(143,141,240,0.14)">#neatHack</Chip>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, opacity: spr(t, b + 0.5) }}>
          <span style={{ fontFamily: MONO, fontSize: 22, color: C.text2 }}>github.com/akarsh-dhingra/SpeedRadar-NeetHack</span>
          <span style={{ fontFamily: MONO, fontSize: 22, color: C.text2 }}>akarsh-dhingra.github.io/SpeedRadar-NeetHack</span>
          <Label style={{ marginTop: 16 }}>built with neatlogs · entire · cfo.ai — voice: chatterbox, timbre from librispeech reader 1673 (cc by 4.0)</Label>
        </div>
      </div>
    </div>
  );
};
export { bt, Serif };
