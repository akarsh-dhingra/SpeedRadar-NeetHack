// 08 cfo.ai: the real cfo.ai workspace (screenshot, public/cfoai), the cost split from its Assumptions sheet,
// and the three 24-month cash curves exported from cfo.ai (src/data/facts.json -> cash).
import React from "react";
import { Img, staticFile } from "remotion";
import { C, MONO, SANS } from "../theme";
import { map, p, spr, win, inExpo, fmt, inOut } from "../anim";
import { bt, ls, le } from "../tl";
import { Chip, Label, Panel, Serif } from "../ui";
import facts from "../data/facts.json";

const FX = facts as any;
const CASH = FX.cash;
const IMG_W = 1364, IMG_H = 892;
const money = (v: number) => `${v < 0 ? "−" : ""}$${fmt(Math.abs(v))}`;
const MONTHS = ["Nov 26", "Dec", "Jan 27", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan 28", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct 28"];

export const Cfo: React.FC<{ t: number }> = ({ t }) => {
  const a1 = ls("cfo1"), a2 = ls("cfo2"), a3 = ls("cfo3"), end = le("cfo3") + 0.3;
  // screenshot: push in on the scenario table, then on the Assumptions sheet's cost rows
  const shotOut = p(t, a3 - 0.05, a3 + 0.4, inExpo);
  const focusR = spr(t, a2 - 0.2, { damping: 22, stiffness: 120 });
  const scale = map(t, a1 - 0.2, a1 + 4.5, 1.02, 1.12, inOut) + focusR * 0.25;
  const fx = focusR * -330, fy = focusR * -40;
  const box = (x: number, y: number, w: number, h: number, at: number, col: string) => {
    const e = spr(t, at, { damping: 14, stiffness: 230 });
    return <div style={{ position: "absolute", left: x, top: y, width: w, height: h, border: `3px solid ${col}`, borderRadius: 8, opacity: e, transform: `scale(${1.15 - 0.15 * e})`, boxShadow: `0 0 24px ${col}` }} />;
  };
  // chart geometry
  const CW = 1500, CH = 430, max = 120000, min = -12000;
  const X = (i: number) => (i / 23) * CW, Y = (v: number) => CH - ((v - min) / (max - min)) * CH;
  const draw = p(t, a3 + 0.1, a3 + 2.6, inOut);
  const path = (arr: number[]) => arr.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const SC = (CASH.scenarios || { "Main Scenario": CASH.base, Growth: CASH.growth, Downside: CASH.downside }) as Record<string, number[]>;
  const COL: Record<string, string> = { Growth: C.up, "Main Scenario": C.accent2, Downside: C.down, "Team uncached cap": "#6fb6d6", "Team repriced": "#c9a3e8", "Industry mix": C.text3 };
  const series: [string, number[], string][] = Object.entries(SC).map(([k, v]) => [k, v, COL[k] || C.text3]);
  const major = new Set(["Growth", "Main Scenario", "Downside"]);
  const baseMin = CASH.base.indexOf(Math.min(...CASH.base));
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* cfo1 + cfo2: the workspace */}
      {t < a3 + 0.5 && (
        <div style={{ position: "absolute", inset: 0, opacity: (1 - shotOut), transform: `scale(${1 + shotOut * 0.3})`, filter: `blur(${shotOut * 16}px)` }}>
          <div style={{ position: "absolute", left: 120, top: 140, display: "flex", alignItems: "baseline", gap: 20, opacity: spr(t, a1 - 0.1) }}>
            <span style={{ fontFamily: SANS, fontSize: 64, fontWeight: 800, letterSpacing: -2 }}>cfo.ai</span>
            <span style={{ fontFamily: MONO, fontSize: 20, color: C.text3 }}>Spend Radar Financial Model · built from measured costs</span>
          </div>
          <div style={{ position: "absolute", left: 960, top: 560, width: IMG_W * 0.92, height: IMG_H * 0.62, transform: `translate(-50%,-50%) perspective(2000px) rotateX(${(1 - spr(t, a1 - 0.2, { damping: 20, stiffness: 120 })) * 25}deg)`, borderRadius: 16, overflow: "hidden", border: `1px solid ${C.line2}`, boxShadow: "0 60px 120px rgba(0,0,0,0.6)", opacity: spr(t, a1 - 0.2) }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: IMG_W, height: IMG_H, transformOrigin: "0 0", transform: `scale(${scale * 0.92}) translate(${fx}px, ${fy - 40}px)` }}>
              <Img src={staticFile("cfoai/launch-plan.png")} style={{ width: IMG_W, height: IMG_H, display: "block" }} />
              {box(52, 300, 676, 46, a1 + 1.4, C.accent2)}
              {box(52, 404, 676, 46, a1 + 2.6, C.down)}
              {box(846, 214, 432, 30, bt("cfo2.three") - 0.1, C.up)}
              {box(846, 351, 432, 30, bt("cfo2.ninety") - 0.2, C.warn)}
            </div>
          </div>
          {/* the split, as numbers */}
          <div style={{ position: "absolute", left: 120, bottom: 170, display: "flex", gap: 24, opacity: win(t, bt("cfo2.three") - 0.1, 999) }}>
            <Panel style={{ padding: "16px 24px" }}>
              <Label>AI per run</Label>
              <div style={{ fontFamily: SANS, fontSize: 48, fontWeight: 800, color: C.up }}>{FX.cfo.llm_per_run}</div>
            </Panel>
            <Panel style={{ padding: "16px 24px", opacity: spr(t, bt("cfo2.ninety") - 0.3) }}>
              <Label>competitor data, uncached run</Label>
              <div style={{ fontFamily: SANS, fontSize: 48, fontWeight: 800, color: C.warn }}>{FX.cfo.crustdata_per_uncached_run} <span style={{ fontSize: 26, color: C.text2, fontWeight: 500 }}>≈ 99% of the cost</span></div>
            </Panel>
          </div>
        </div>
      )}

      {/* cfo3: the cash curves */}
      {t > a3 - 0.3 && (
        <div style={{ position: "absolute", inset: 0, opacity: spr(t, a3 - 0.1) * (1 - p(t, end - 0.1, end + 0.3)) }}>
          <div style={{ position: "absolute", left: 120, top: 150 }}>
            <Label color={C.accent2}>cfo.ai · ending cash, 24 months · {CASH.months} · starting cash ${fmt(FX.cfo.starting_cash)}</Label>
            <div style={{ fontFamily: SANS, fontSize: 60, fontWeight: 700, letterSpacing: -2, marginTop: 10 }}>Base case: cash-flow positive <Serif color={C.accent2}>{FX.cfo.base_positive}.</Serif></div>
          </div>
          <div style={{ position: "absolute", left: 120, top: 290, display: "flex", gap: 12, flexWrap: "wrap", width: 1700 }}>
            <Label style={{ alignSelf: "center", marginRight: 6 }}>{series.length} scenarios · month-24 cash</Label>
            {series.map(([name, arr, col], i) => (
              <span key={name} style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: MONO, fontSize: 17, color: C.text2, opacity: spr(t, a3 + 0.3 + i * 0.08) }}>
                <span style={{ width: 14, height: 4, borderRadius: 2, background: col }} />{name === "Main Scenario" ? "Base" : name} <span style={{ color: col }}>{money(arr[23])}</span>
              </span>
            ))}
          </div>
          <div style={{ position: "absolute", left: 210, top: 360, width: CW, height: CH - 20 }}>
            <div style={{ position: "absolute", left: 0, right: 0, top: Y(0), height: 1, background: C.line2 }} />
            <span style={{ position: "absolute", left: -70, top: Y(0) - 12, fontFamily: MONO, fontSize: 16, color: C.text3 }}>$0</span>
            <svg width={CW} height={CH} style={{ position: "absolute", overflow: "visible" }}>
              <defs><clipPath id="draw"><rect x={0} y={-50} width={CW * draw} height={CH + 100} /></clipPath></defs>
              {series.map(([name, arr, col]) => <path key={name} d={path(arr)} fill="none" stroke={col} strokeWidth={name === "Main Scenario" ? 6 : major.has(name) ? 4 : 2.5} strokeOpacity={major.has(name) ? 1 : 0.7} clipPath="url(#draw)" style={{ filter: major.has(name) ? `drop-shadow(0 0 8px ${col})` : "none" }} />)}
            </svg>
            {series.filter(([n]) => major.has(n)).map(([name, arr, col]) => (
              <div key={name} style={{ position: "absolute", left: X(23) + 18, top: Y(arr[23]) - 16, fontFamily: MONO, fontSize: 20, color: col, opacity: p(t, a3 + 2.3, a3 + 2.7), whiteSpace: "nowrap" }}>{name === "Main Scenario" ? "Base" : name} {money(arr[23])}</div>
            ))}
            {/* base low point and turn */}
            <div style={{ position: "absolute", left: X(baseMin) - 9, top: Y(CASH.base[baseMin]) - 9, width: 18, height: 18, borderRadius: "50%", background: C.accent2, opacity: spr(t, bt("cfo3.january") - 0.2), boxShadow: `0 0 18px ${C.accent2}` }} />
            <div style={{ position: "absolute", left: X(baseMin) - 120, top: Y(CASH.base[baseMin]) - 64, fontFamily: MONO, fontSize: 17, color: C.text, background: "rgba(11,12,13,0.8)", padding: "4px 10px", borderRadius: 8, opacity: spr(t, bt("cfo3.january") - 0.1) }}>lowest ${fmt(CASH.base[baseMin])} · {MONTHS[baseMin]} 27 → positive from {MONTHS[baseMin + 1]}</div>
            {[0, 6, 12, 18, 23].map((i) => <span key={i} style={{ position: "absolute", left: X(i) - 30, top: CH + 14, fontFamily: MONO, fontSize: 15, color: C.text3 }}>{MONTHS[i]}</span>)}
          </div>
          <div style={{ position: "absolute", left: 120, bottom: 170, display: "flex", gap: 14, opacity: spr(t, bt("cfo3.team") - 0.2) }}>
            <Chip size={20}>Starter {FX.cfo.starter}</Chip>
            <Chip size={20}>Team {FX.cfo.team}</Chip>
            <Chip size={20} color={C.accent2} bg="rgba(143,141,240,0.14)" style={{ transform: `scale(${1 + 0.06 * spr(t, bt("cfo3.team"), { damping: 9, stiffness: 260 })})` }}>next: test Team at {FX.cfo.test_team}</Chip>
            <Chip size={20} color={C.down} bg="rgba(236,95,90,0.12)">downside {FX.cfo.downside}</Chip>
          </div>
        </div>
      )}
    </div>
  );
};
