// 04 Self-audit: the $5.28M ML/AI claim from run 1011-777bb7, the evidence against it, two auditors, overturned,
// and the report it never reaches (every number footnoted to its source). All values from src/data.
import React from "react";
import { C, MONO, SANS } from "../theme";
import { map, p, spr, win, inExpo } from "../anim";
import { bt, ls, le } from "../tl";
import { Chip, Count, Label, Panel, Serif, Stamp, Strike, center, shake } from "../ui";
import facts from "../data/facts.json";
import run from "../data/run.json";

const F = (facts as any).featured_finding;
const R = run as any;
const gap = 5280000; // from F.statement: "≈ $5,280,000 less … a year"
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export const Audit: React.FC<{ t: number }> = ({ t }) => {
  const a1 = ls("aud1"), a2 = ls("aud2"), a3 = ls("aud3"), a4 = ls("aud4"), a5 = ls("aud5");
  const ov = bt("aud3.overturned");
  const claimIn = spr(t, a2 - 0.15, { damping: 18, stiffness: 160 });
  // claim card: centre (aud2) -> left (aud3) -> flies into the report's overturned section (aud4)
  const toLeft = spr(t, a3 - 0.1, { damping: 20, stiffness: 150 });
  const toReport = p(t, a4 + 0.2, a4 + 1.0);
  const sx = shake(t, ov, 16);
  const notes: string[] = F.audit_notes || [];
  const showClaim = t > a2 - 0.3 && t < a5 + 0.2;
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* aud1: title card */}
      {t < a2 + 0.3 && (
        <div style={{ ...center, flexDirection: "column", gap: 24, opacity: 1 - p(t, a2 - 0.15, a2 + 0.25, inExpo), transform: `scale(${1 + p(t, a2 - 0.15, a2 + 0.3, inExpo) * 0.25})` }}>
          <Label color={C.accent2} style={{ opacity: spr(t, a1) }}>self-audit · runs on every finding before the report</Label>
          <div style={{ fontFamily: SANS, fontSize: 132, fontWeight: 800, letterSpacing: -6, opacity: spr(t, a1 + 0.05), transform: `translateY(${(1 - spr(t, a1 + 0.05)) * 40}px)` }}>
            It tries to <Serif color={C.down}>disprove</Serif> itself.
          </div>
        </div>
      )}

      {/* the claim */}
      {showClaim && (
        <div style={{ position: "absolute", left: 960, top: 500, transform: `translate(-50%,-50%) translate(${map(toLeft, 0, 1, 0, -470) + map(toReport, 0, 1, 0, 520) + sx}px, ${map(toReport, 0, 1, 0, 170)}px) scale(${(0.85 + 0.15 * claimIn) * map(toLeft, 0, 1, 1, 0.82) * map(toReport, 0, 1, 1, 0.38)})`, opacity: claimIn * (1 - p(t, a5 - 0.1, a5 + 0.2)) }}>
          <Panel style={{ width: 860, padding: "38px 46px", position: "relative" }} glow={t > ov ? "rgba(236,95,90,0.25)" : undefined}>
            <Label>finding f_ml_ai · {R.company} · ML/AI headcount</Label>
            <div style={{ display: "flex", alignItems: "baseline", gap: 26, marginTop: 18 }}>
              <span style={{ fontFamily: SANS, fontSize: 110, fontWeight: 800, letterSpacing: -4 }}>{pct(F.ours)}</span>
              <span style={{ fontFamily: SANS, fontSize: 30, color: C.text2 }}>of headcount vs competitor median {pct(F.theirs_low)}–{pct(F.theirs_high)}</span>
            </div>
            <div style={{ marginTop: 22, fontFamily: MONO, fontSize: 22, color: C.warn }}>✗ violates policy: ML/AI share within 20% of competitor median</div>
            <div style={{ marginTop: 26, display: "flex", alignItems: "baseline", gap: 18 }}>
              <span style={{ fontFamily: SANS, fontSize: 30, color: C.text2 }}>gap estimate, up to</span>
              <span style={{ position: "relative", fontFamily: SANS, fontSize: 78, fontWeight: 800, color: t > ov ? C.text3 : C.text, letterSpacing: -2 }}>
                <Count t={t} a={bt("aud2.million") - 0.8} b={bt("aud2.million") + 0.3} to={gap} prefix="$" />
                <Strike t={t} at={ov + 0.05} thick={8} />
              </span>
              <span style={{ fontFamily: SANS, fontSize: 30, color: C.text2 }}>a year</span>
            </div>
            <div style={{ position: "absolute", right: 40, top: 30 }}><Stamp t={t} at={ov} text="Overturned" size={54} style={{ position: "relative" }} /></div>
          </Panel>
        </div>
      )}

      {/* aud3: evidence + two auditors (right column) */}
      {t > a3 - 0.3 && t < a4 + 0.4 && (
        <div style={{ position: "absolute", left: 1010, top: 230, width: 820, display: "flex", flexDirection: "column", gap: 18, opacity: 1 - p(t, a4 - 0.05, a4 + 0.35, inExpo), transform: `translateX(${p(t, a4 - 0.05, a4 + 0.35, inExpo) * 200}px)` }}>
          {[
            ["signals that agree", String(F.confidence_inputs.agreement), C.down],
            ["checks passed", F.confidence_inputs.checks, C.warn],
            ["computed confidence", F.confidence.toFixed(2), C.down],
          ].map(([k, v, col], i) => {
            const e = spr(t, a3 + 0.05 + i * 0.12);
            return (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "14px 22px", borderRadius: 12, background: C.field, border: `1px solid ${C.line}`, opacity: e, transform: `translateX(${(1 - e) * 80}px)` }}>
                <span style={{ fontFamily: MONO, fontSize: 22, color: C.text2 }}>{k}</span>
                <span style={{ fontFamily: MONO, fontSize: 26, color: col }}>{v}</span>
              </div>
            );
          })}
          {notes.slice(0, 2).map((n, i) => {
            const [who, rest] = n.split(/:\s(.+)/s);
            const verdict = rest.split(" — ")[0];
            const e = spr(t, a3 + 0.5 + i * 0.35, { damping: 18, stiffness: 190 });
            return (
              <Panel key={i} style={{ padding: "18px 24px", opacity: e, transform: `translateY(${(1 - e) * 40}px)` }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <Chip size={16} color={C.accent2} bg="rgba(143,141,240,0.12)">{who}</Chip>
                  <span style={{ fontFamily: MONO, fontSize: 22, color: verdict.startsWith("overturn") ? C.down : C.warn }}>{verdict}</span>
                </div>
                <div style={{ fontFamily: SANS, fontSize: 21, color: C.text2, marginTop: 10, lineHeight: 1.4 }}>{(rest.split(" — ")[1] || "").slice(0, 150)}…</div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* aud4 + aud5: the report */}
      {t > a4 - 0.3 && (
        <div style={{ position: "absolute", left: 960, top: 520, transform: `translate(-50%,-50%) translateX(${(1 - spr(t, a4 - 0.1, { damping: 20, stiffness: 150 })) * 900}px) scale(${map(t, a5 - 0.1, a5 + 1.2, 1, 1.06)})`, opacity: spr(t, a4 - 0.1) }}>
          <Panel style={{ width: 1500, padding: "30px 40px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <span style={{ fontFamily: SANS, fontSize: 34, fontWeight: 700 }}>Spend Radar report</span>
              <span style={{ fontFamily: MONO, fontSize: 18, color: C.text3 }}>runs/{R.run_id}/report.md · data mode: real</span>
            </div>
            <div style={{ marginTop: 18, borderTop: `1px solid ${C.line}` }}>
              {(R.report_rows as any[]).map((f, i) => {
                const e = spr(t, a4 + 0.1 + i * 0.06);
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 18, height: 50, borderBottom: `1px solid ${C.line}`, opacity: e }}>
                    <span style={{ width: 190, fontFamily: MONO, fontSize: 18, color: C.text3 }}>{f.area}</span>
                    <span style={{ flex: 1, fontFamily: SANS, fontSize: 20, color: C.text2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.finding}</span>
                    <span style={{ display: "flex", gap: 6 }}>
                      {(f.refs as string[]).slice(0, 5).map((r, j) => {
                        const glow = t > a5 + 0.2 + (i * 5 + j) * 0.03;
                        const hot = r === "3";
                        return <span key={j} style={{ fontFamily: MONO, fontSize: 15, padding: "2px 7px", borderRadius: 6, color: glow ? C.ground : C.accent2, background: glow ? (hot ? C.text : C.accent2) : "rgba(143,141,240,0.12)" }}>[{r}]</span>;
                      })}
                      {f.refs.length > 5 ? <span style={{ fontFamily: MONO, fontSize: 15, color: C.text3 }}>+{f.refs.length - 5}</span> : null}
                    </span>
                    <Chip size={15} color={f.policy.includes("violated") ? C.warn : C.up} bg={f.policy.includes("violated") ? "rgba(227,176,75,0.12)" : "rgba(61,191,85,0.12)"}>{f.policy.replace(/\*/g, "").replace("—", "check")} · {f.audit}</Chip>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 16, opacity: p(t, a4 + 0.6, a4 + 1.0) }}>
              <Label color={C.down}>overturned claims</Label>
              <span style={{ position: "relative", fontFamily: SANS, fontSize: 20, color: C.text3 }}>ML/AI · {pct(F.ours)} vs {pct(F.theirs_low)}–{pct(F.theirs_high)} · ≈ $5,280,000 a year<Strike t={t} at={a4 + 0.9} thick={3} /></span>
            </div>
          </Panel>
          {/* aud5: one footnote opens onto its source */}
          {(() => {
            const src = (R.sources as any[])[0];
            const e = spr(t, bt("aud5.source") - 0.4, { damping: 16, stiffness: 200 });
            return (
              <div style={{ position: "absolute", right: -20, top: -150, opacity: e, transform: `translateY(${(1 - e) * 40}px) scale(${0.9 + 0.1 * e})` }}>
                <Panel style={{ padding: "18px 24px", border: `1px solid ${C.accent}` }} glow="rgba(143,141,240,0.3)">
                  <Label color={C.accent2}>[3] source</Label>
                  <div style={{ fontFamily: MONO, fontSize: 20, color: C.text, marginTop: 8 }}>{src.company} · {src.category} · {src.signal} = {Math.round(src.value)}</div>
                  <div style={{ fontFamily: MONO, fontSize: 18, color: C.text2, marginTop: 6 }}>crustdata {src.ref} · as of {src.as_of}</div>
                </Panel>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
export { win, le };
