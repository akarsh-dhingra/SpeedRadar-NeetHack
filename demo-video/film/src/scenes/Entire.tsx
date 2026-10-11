// 07 Entire: commits linked to checkpoints (real git log), the `spendradar explain` chain from a neatlogs span to
// the prompt that wrote the code (evidence/explain), and the review runners' two findings fixed before merge.
import React from "react";
import { C, MONO, SANS } from "../theme";
import { map, p, spr, win, inExpo, inOut } from "../anim";
import { bt, ls, le } from "../tl";
import { Chip, Count, Label, Panel, Serif, Shot } from "../ui";
import facts from "../data/facts.json";

const FX = facts as any;
const X = FX.explain;

export const Entire: React.FC<{ t: number }> = ({ t }) => {
  const a1 = ls("ent1"), a2 = ls("ent2"), a3 = ls("ent3"), end = le("ent3") + 0.3;
  const commits = FX.commits as any[];
  // explain chain: the camera travels node to node as each is named
  const nodes = [
    { at: bt("ent2.span"), label: "neatlogs span", main: "decide:recovery", sub: `trace ${X.trace.slice(0, 12)}…`, col: C.accent },
    { at: bt("ent2.code"), label: "code line", main: X.code, sub: "decide_recovery()", col: C.text },
    { at: bt("ent2.commit"), label: "commit", main: X.commit, sub: "written by Claude Code", col: C.text },
    { at: bt("ent2.commit") + 0.35, label: "entire checkpoint", main: X.checkpoint.slice(0, 14) + "…", sub: `session ${X.session.slice(0, 8)}…`, col: C.up },
    { at: bt("ent2.prompt"), label: "the prompt", main: "“" + X.prompt + "”", sub: "the brief that produced this line", col: C.warn },
  ];
  const NW = 520, GAP = 110;
  let cam = 0;
  nodes.forEach((n, i) => { cam += spr(t, n.at - 0.15, { damping: 20, stiffness: 140 }) * (i === 0 ? 0 : NW + GAP); });
  const camX = 960 - NW / 2 - cam;
  const trails = FX.trails as any[];
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* ent1: commit -> checkpoint -> prompt, scrolling */}
      {t < a2 + 0.4 && (
        <div style={{ position: "absolute", inset: 0, opacity: 1 - p(t, a2 - 0.05, a2 + 0.35, inExpo), transform: `scale(${1 - p(t, a2 - 0.05, a2 + 0.35, inExpo) * 0.1})` }}>
          <div style={{ position: "absolute", left: 120, top: 150 }}>
            <Label color={C.up}>entire · checkpoints on github</Label>
            <div style={{ fontFamily: SANS, fontSize: 72, fontWeight: 800, letterSpacing: -3, marginTop: 10 }}>
              A <Serif color={C.up}>memory</Serif> for the coding agent.
            </div>
          </div>
          <div style={{ position: "absolute", right: 120, top: 150, textAlign: "right", opacity: spr(t, bt("ent1.sixty") - 0.3) }}>
            <div style={{ fontFamily: SANS, fontSize: 130, fontWeight: 800, letterSpacing: -5, color: C.up, lineHeight: 1 }}><Count t={t} a={bt("ent1.sixty") - 0.3} b={bt("ent1.sixty") + 0.6} to={FX.checkpoints} /></div>
            <Label>checkpoints · commit ↔ agent session ↔ prompt</Label>
          </div>
          <div style={{ position: "absolute", left: 120, right: 120, top: 400, display: "flex", flexDirection: "column", gap: 12 }}>
            {commits.slice(0, 7).map((c, i) => {
              const e = spr(t, a1 + 0.2 + i * 0.16, { damping: 20, stiffness: 220 });
              return (
                <div key={c.sha} style={{ display: "flex", alignItems: "center", gap: 18, height: 48, opacity: e, transform: `translateX(${(1 - e) * -80}px)` }}>
                  <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.up, boxShadow: `0 0 12px ${C.up}` }} />
                  <span style={{ width: 110, fontFamily: MONO, fontSize: 20, color: C.text }}>{c.sha}</span>
                  <span style={{ flex: 1, fontFamily: SANS, fontSize: 21, color: C.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.subject}</span>
                  <Chip size={17} color={C.up} bg="rgba(61,191,85,0.10)">Entire-Checkpoint {c.checkpoint.slice(0, 12)}…</Chip>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ent2: explain chain */}
      {t > a2 - 0.3 && t < a3 + 0.4 && (
        <div style={{ position: "absolute", inset: 0, opacity: spr(t, a2 - 0.1) * (1 - p(t, a3 - 0.05, a3 + 0.35, inExpo)) }}>
          <div style={{ position: "absolute", left: 120, top: 150 }}>
            <Label color={C.accent2}>spendradar explain {X.trace.slice(0, 12)}</Label>
            <div style={{ fontFamily: SANS, fontSize: 60, fontWeight: 700, letterSpacing: -2, marginTop: 10 }}>From a trace, back to <Serif color={C.warn}>why the code exists.</Serif></div>
          </div>
          <div style={{ position: "absolute", top: 430, left: camX, display: "flex", gap: GAP, alignItems: "center" }}>
            {nodes.map((n, i) => {
              const e = spr(t, n.at - 0.25, { damping: 16, stiffness: 200 });
              const focus = i === nodes.filter((m) => t >= m.at - 0.15).length - 1;
              return (
                <div key={i} style={{ position: "relative", width: NW }}>
                  {i > 0 && <div style={{ position: "absolute", left: -GAP, top: "50%", width: GAP * p(t, n.at - 0.3, n.at), height: 2, background: n.col, boxShadow: `0 0 12px ${n.col}` }} />}
                  <Panel style={{ padding: "28px 30px", opacity: 0.35 + 0.65 * e, transform: `scale(${0.88 + 0.12 * e + (focus ? 0.04 : 0)})`, border: `1px solid ${focus ? n.col : C.line}` }} glow={focus ? `${n.col}33` : undefined}>
                    <Label color={n.col}>{n.label}</Label>
                    <div style={{ fontFamily: i === 4 ? SANS : MONO, fontSize: i === 4 ? 30 : 32, color: C.text, marginTop: 12, lineHeight: 1.3 }}>{n.main}</div>
                    <div style={{ fontFamily: MONO, fontSize: 18, color: C.text3, marginTop: 10 }}>{n.sub}</div>
                  </Panel>
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 120, bottom: 190, fontFamily: MONO, fontSize: 19, color: C.text3, opacity: win(t, a2 + 0.5, 999) }}>
            the decision this span records: {X.chosen} instead of the rule's {X.default} · {X.model}
          </div>
        </div>
      )}

      {/* ent3: runners and their findings */}
      {t > a3 - 0.3 && (
        <div style={{ position: "absolute", inset: 0, opacity: spr(t, a3 - 0.1) * (1 - p(t, end - 0.1, end + 0.3)) }}>
          <div style={{ position: "absolute", left: 120, top: 150, display: "flex", alignItems: "center", gap: 14 }}>
            <Label color={C.up} style={{ marginRight: 8 }}>{(FX.runners as string[]).length} review runners</Label>
            {(FX.runners as string[]).map((r, i) => <Chip key={r} size={18} style={{ opacity: spr(t, a3 + i * 0.05) }}>{r}</Chip>)}
          </div>
          <div style={{ position: "absolute", left: 120, right: 120, top: 230, display: "flex", gap: 26 }}>
            {trails.map((tr, i) => {
              const e = spr(t, a3 + 0.15 + i * 0.12, { damping: 17, stiffness: 190 });
              return (
                <div key={tr.number} style={{ flex: 1, opacity: e, transform: `perspective(1400px) rotateY(${(1 - e) * 35}deg) translateY(${(1 - e) * 60}px)` }}>
                  <Shot file={`entire-card${4 + i}.png`} w={540} radius={14} />
                </div>
              );
            })}
          </div>
          <div style={{ position: "absolute", left: 120, right: 120, top: 640, display: "flex", gap: 26 }}>
            {trails.flatMap((tr) => (tr.findings || []).map((f: any) => ({ ...f, trail: tr.number }))).map((f, i) => {
              const e = spr(t, bt("ent3.bug") - 0.1 + i * 0.25, { damping: 12, stiffness: 240 });
              const fixed = t > bt("ent3.merged") - 0.2;
              return (
                <Panel key={i} style={{ flex: 1, padding: "20px 24px", opacity: e, transform: `scale(${0.85 + 0.15 * e})`, border: `1px solid ${fixed ? C.up : C.warn}` }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Chip size={15} color={C.warn} bg="rgba(227,176,75,0.12)">trail #{f.trail} · {f.severity}</Chip>
                    <Chip size={15} color={fixed ? C.up : C.text3} bg={fixed ? "rgba(61,191,85,0.12)" : C.chip}>{fixed ? `fixed ${f.fix} · before merge` : "open"}</Chip>
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 22, color: C.text2, marginTop: 12, lineHeight: 1.35 }}>{f.summary}</div>
                </Panel>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
export { map, inOut };
