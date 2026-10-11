import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { C, FPS, SANS } from "./theme";
import { inOut, p } from "./anim";
import { tl, SC } from "./tl";
import { Captions, Chapter, Grain, Ground, VoiceMark } from "./ui";
import { Hook, Title } from "./scenes/Open";
import { Run } from "./scenes/Run";
import { Audit } from "./scenes/Audit";
import { General } from "./scenes/General";
import { Neatlogs } from "./scenes/Neatlogs";
import { Entire } from "./scenes/Entire";
import { Cfo } from "./scenes/Cfo";
import { Outro } from "./scenes/Outro";

const SCENES: Record<string, React.FC<{ t: number }>> = { hook: Hook, title: Title, run: Run, audit: Audit, general: General, neatlogs: Neatlogs, entire: Entire, cfo: Cfo, outro: Outro };
const CHAPTERS: Record<string, [string, string]> = {
  hook: ["01", "THE PROBLEM"], title: ["02", "MEET THE AGENT"], run: ["03", "A REAL RUN"], audit: ["04", "SELF-AUDIT"], general: ["05", "HELD-OUT COMPANIES"],
  neatlogs: ["06", "NEATLOGS"], entire: ["07", "ENTIRE"], cfo: ["08", "CFO.AI"], outro: ["09", "#NEATHACK"],
};
// How each scene arrives (the previous one leaves the same way). Fast: 0.36 s, centred on the cut.
const ARRIVE: Record<string, "whip" | "zoom" | "rise"> = { title: "zoom", run: "whip", audit: "zoom", general: "rise", neatlogs: "whip", entire: "rise", cfo: "whip", outro: "zoom" };
const TR = 0.36;

const look = (kind: string, k: number, dir: "in" | "out"): React.CSSProperties => {
  // k: 0 = fully on screen, 1 = fully off
  const s = dir === "in" ? 1 : -1;
  if (kind === "zoom") return { transform: `scale(${dir === "in" ? 1 - 0.25 * k : 1 + 0.7 * k})`, filter: `blur(${k * 26}px)`, opacity: 1 - k };
  if (kind === "rise") return { transform: `translateY(${s * k * 420}px)`, filter: `blur(${k * 22}px)`, opacity: 1 - k };
  return { transform: `translateX(${s * k * 900}px) skewX(${-s * k * 8}deg)`, filter: `blur(${k * 30}px)`, opacity: 1 - k };
};

export const Film: React.FC = () => {
  const t = useCurrentFrame() / FPS;
  const layers: React.ReactNode[] = [];
  tl.scenes.forEach((sc, i) => {
    const next = tl.scenes[i + 1];
    const a = sc.start - (i === 0 ? 0 : TR / 2), b = next ? next.start + TR / 2 : tl.duration + 1;
    if (t < a || t > b) return;
    const Comp = SCENES[sc.id];
    if (!Comp) return;
    let style: React.CSSProperties = {};
    if (i > 0 && t < sc.start + TR / 2) style = look(ARRIVE[sc.id] || "whip", 1 - p(t, sc.start - TR / 2, sc.start + TR / 2, inOut), "in");
    if (next && t > next.start - TR / 2) style = look(ARRIVE[next.id] || "whip", p(t, next.start - TR / 2, next.start + TR / 2, inOut), "out");
    layers.push(<AbsoluteFill key={sc.id} style={style}><Comp t={t} /></AbsoluteFill>);
  });
  // a light streak across each cut
  const cut = tl.scenes.slice(1).find((s) => Math.abs(t - s.start) < TR / 2);
  const streak = cut ? p(t, cut.start - TR / 2, cut.start + TR / 2, inOut) : 0;
  return (
    <AbsoluteFill style={{ background: C.ground, overflow: "hidden", color: C.text, fontFamily: SANS }}>
      <Ground />
      {layers}
      {cut ? <div style={{ position: "absolute", top: 0, bottom: 0, width: 260, left: -300 + streak * 2500, background: "linear-gradient(90deg, transparent, rgba(169,167,255,0.18), transparent)", filter: "blur(10px)" }} /> : null}
      <Chapter t={t} items={tl.scenes.map((s) => ({ at: s.start, n: CHAPTERS[s.id]?.[0] || "", label: CHAPTERS[s.id]?.[1] || s.id }))} />
      <VoiceMark t={t} />
      <Captions t={t} />
      <Grain />
    </AbsoluteFill>
  );
};
export { SC };
