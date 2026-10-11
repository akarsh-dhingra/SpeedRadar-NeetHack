// 05 Held-out companies: seven fictional companies, six never used to build the agent; each card shows its latest
// run's planted errors caught; the three fault-injected runs flash their faults. Values: src/data/facts.json.
import React from "react";
import { C, MONO, SANS } from "../theme";
import { spr, win } from "../anim";
import { bt, ls } from "../tl";
import { Chip, Label, Panel, shake } from "../ui";
import facts from "../data/facts.json";

const FX = facts as any;
const injected: Record<string, any> = Object.fromEntries((FX.injected as any[]).map((r) => [r.company, r]));

export const General: React.FC<{ t: number }> = ({ t }) => {
  const seven = bt("gen1.seven"), six = bt("gen1.six"), caught = bt("gen2.caught"), zero = bt("gen2.zero"), purpose = bt("gen2.purpose") || ls("gen2") + 2.6;
  const cos = FX.companies as any[];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      <div style={{ position: "absolute", left: 120, right: 120, top: 160, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 26 }}>
        {cos.map((c, i) => {
          const e = spr(t, seven - 0.15 + i * 0.07, { damping: 16, stiffness: 200 });
          const held = c.role === "held_out";
          const tag = spr(t, six + i * 0.05);
          const ok = spr(t, caught - 0.1 + i * 0.06, { damping: 12, stiffness: 240 });
          const inj = injected[c.key];
          const hit = inj ? shake(t, purpose + i * 0.04, 10) : 0;
          return (
            <Panel key={c.key} style={{ padding: "26px 28px", height: 250, position: "relative", opacity: e, transform: `translateY(${(1 - e) * 80}px) rotateX(${(1 - e) * 30}deg) translateX(${hit}px)`,
              border: `1px solid ${ok > 0.5 ? "rgba(61,191,85,0.45)" : C.line}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 46, height: 46, borderRadius: 12, background: C.chip, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: 24 }}>{c.name[0]}</div>
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 26, fontWeight: 600 }}>{c.name.replace(" Inc.", "")}</div>
                  <div style={{ fontFamily: MONO, fontSize: 16, color: C.text3 }}>{c.industry}</div>
                </div>
              </div>
              <div style={{ marginTop: 18, opacity: tag }}>
                {held ? <Chip size={16} color={C.accent2} bg="rgba(143,141,240,0.12)">held-out · never tuned on</Chip> : <Chip size={16} color={C.text2}>development set</Chip>}
              </div>
              <div style={{ position: "absolute", left: 28, right: 20, bottom: 22, display: "flex", flexDirection: "column", gap: 2, opacity: ok, transform: `scale(${0.8 + 0.2 * ok})`, transformOrigin: "left" }}>
                <span style={{ fontFamily: SANS, fontSize: 44, fontWeight: 800, color: C.up }}>✓ {c.latest.caught}/{c.latest.total}</span>
                <span style={{ fontFamily: MONO, fontSize: 16, color: C.text3 }}>planted caught · {c.latest.false_alarms} false alarms</span>
              </div>
              {inj && t > purpose - 0.1 && (
                <div style={{ position: "absolute", right: 18, top: 18, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, opacity: spr(t, purpose + i * 0.04) }}>
                  <span style={{ fontFamily: MONO, fontSize: 13, color: C.text3 }}>fault-injected run {inj.run_id}</span>
                  <Chip size={14} color={C.down} bg="rgba(236,95,90,0.14)">{inj.faults.join(" · ")}</Chip>
                  <span style={{ fontFamily: MONO, fontSize: 15, color: C.up }}>✓ {inj.planted_caught}/{inj.planted_total} still caught</span>
                </div>
              )}
            </Panel>
          );
        })}
        {/* the 8th cell: the totals */}
        <div style={{ height: 250, display: "flex", flexDirection: "column", justifyContent: "center", paddingLeft: 10, opacity: spr(t, zero - 0.2) }}>
          <div style={{ fontFamily: SANS, fontSize: 92, fontWeight: 800, letterSpacing: -4, color: C.text, lineHeight: 1 }}>{FX.summary.latest_runs_false_alarms}</div>
          <Label>false alarms on the latest run of all {FX.summary.companies}</Label>
          <div style={{ marginTop: 18, opacity: win(t, purpose, 999) }}><Label color={C.down}>{(FX.injected as any[]).length} runs with faults injected · still all caught</Label></div>
        </div>
      </div>
    </div>
  );
};
