// 03 A real run: run 1011-777bb7 on Acme's files, replayed from its saved state (src/data/run.json).
// Left: the loop, with the step being shown lit. Right: the agent console, one stage per narration line.
import React from "react";
import { C, MONO, SANS } from "../theme";
import { map, p, spr, win, inExpo, fmt } from "../anim";
import { bt, ls, le } from "../tl";
import { Chip, Count, Label, Panel, Serif, shake } from "../ui";
import run from "../data/run.json";

const R = run as any;
const STEPS = ["PLAN", "ACT", "OBSERVE", "VERIFY", "DECIDE", "AUDIT", "REPORT"];
const TOOL_C: Record<string, string> = { read_budget: C.warn, read_policy: C.text2, read_salary_table: C.text2, read_invoice: C.accent2, fetch_competitor: C.up, fetch_jobs: C.up, classify_titles: C.accent };

const typed = (s: string, t: number, a: number, cps = 90) => s.slice(0, Math.max(0, Math.floor((t - a) * cps)));

/** a stage of the console: visible from line `from` to line `to`, slides in from the right and out to the left */
const Stage: React.FC<{ t: number; a: number; b: number; children: React.ReactNode }> = ({ t, a, b, children }) => {
  if (t < a - 0.3 || t > b + 0.4) return null;
  const i = spr(t, a - 0.1, { damping: 20, stiffness: 190 });
  const o = p(t, b - 0.05, b + 0.3, inExpo);
  return <div style={{ position: "absolute", inset: 0, transform: `translateX(${(1 - i) * 120 - o * 160}px)`, opacity: i * (1 - o), filter: `blur(${o * 12}px)` }}>{children}</div>;
};

const Row: React.FC<{ t: number; at: number; task: any }> = ({ t, at, task }) => {
  const k = spr(t, at, { damping: 20, stiffness: 260 });
  const ok = task.status === "done";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, height: 46, opacity: k, transform: `translateY(${(1 - k) * 18}px)`, fontFamily: MONO, fontSize: 21, paddingLeft: task.recovery ? 36 : 0 }}>
      <span style={{ width: 70, color: C.text3 }}>{task.id}</span>
      <span style={{ padding: "3px 10px", border: `1px solid ${C.line2}`, borderRadius: 6, fontSize: 16, letterSpacing: 1, color: TOOL_C[task.tool] || C.text2 }}>{task.tool.toUpperCase()}</span>
      <span style={{ color: C.text, flex: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{task.target}</span>
      <span style={{ color: ok ? C.up : C.down, fontSize: 19 }}>{ok ? "✓ done" : "✗ check failed"}</span>
    </div>
  );
};

export const Run: React.FC<{ t: number }> = ({ t }) => {
  const s = ls("run1");
  const lines = ["run1", "run2", "run3", "run4", "run5", "run6", "run7"];
  const at = Object.fromEntries(lines.map((id) => [id, ls(id)]));
  const end = le("run7") + 0.3;
  const active = t < at.run2 ? -1 : t < at.run3 ? 0 : t < at.run4 ? 1 : t < at.run5 ? 3 : 4;
  const observe = t > at.run3 && t < at.run4 && Math.floor(t * 6) % 2 === 0;
  const enter = spr(t, s - 0.1, { damping: 22, stiffness: 140 });
  const tasks = R.tasks as any[];
  const firstFive = tasks.filter((x) => ["t02", "t03", "t04", "t05", "t06", "t07", "t08", "t09", "t10"].includes(x.id));
  const compTasks = tasks.filter((x) => x.tool === "fetch_competitor");
  const dec = (R.decisions as any[])[0];
  const scanned = (R.decisions as any[]).find((d) => d.task === "t15");
  const corrupt = (R.decisions as any[]).filter((d) => d.task.startsWith("t16"));
  const na = (R.not_analysed as any[])[0];
  const fx = shake(t, bt("run4.off"), 10);
  return (
    <div style={{ position: "absolute", inset: 0 }}>
      {/* the loop */}
      <div style={{ position: "absolute", left: 80, top: 190, width: 330, transform: `translateX(${(1 - enter) * -80}px)`, opacity: enter }}>
        <Label style={{ marginBottom: 22 }}>the loop</Label>
        {STEPS.map((st, i) => {
          const on = i === active || (i === 2 && observe);
          const done = i < active;
          return (
            <div key={st} style={{ display: "flex", alignItems: "center", gap: 16, height: 66 }}>
              <div style={{ width: 16, height: 16, borderRadius: "50%", border: `2px solid ${on ? C.accent : done ? C.up : C.line2}`, background: on ? C.accent : done ? C.up : "transparent", boxShadow: on ? `0 0 20px ${C.accent}` : "none" }} />
              <span style={{ fontFamily: MONO, fontSize: 26, letterSpacing: 3, color: on ? C.text : done ? C.text2 : C.text3, fontWeight: on ? 600 : 400 }}>{st}</span>
              {st === "PLAN" || st === "DECIDE" || st === "AUDIT" ? <Chip size={14} color={C.accent2} bg="rgba(143,141,240,0.12)">LLM</Chip> : <Chip size={14} color={C.text3} bg="transparent" style={{ border: `1px solid ${C.line}` }}>python</Chip>}
            </div>
          );
        })}
      </div>

      {/* the console */}
      <Panel style={{ position: "absolute", left: 470, top: 150, width: 1370, height: 710, overflow: "hidden", transform: `perspective(1800px) rotateY(${(1 - enter) * -18}deg) translateX(${fx}px)`, opacity: enter }}>
        <div style={{ height: 64, display: "flex", alignItems: "center", gap: 18, padding: "0 28px", borderBottom: `1px solid ${C.line}`, fontFamily: MONO, fontSize: 19, color: C.text2 }}>
          <span style={{ color: C.text }}>run {R.run_id}</span>
          <span>·</span><span>{R.company} <span style={{ color: C.text3 }}>(fictional)</span></span>
          <Chip size={15} color={C.up} bg="rgba(61,191,85,0.12)">● REAL DATA</Chip>
          <span style={{ marginLeft: "auto", color: C.text3 }}>neatlogs trace {R.trace.slice(0, 8)}…</span>
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 64, bottom: 0, padding: "34px 40px" }}>
          {/* run1: the goal */}
          <Stage t={t} a={at.run1} b={at.run2}>
            <div style={{ padding: "34px 40px" }}>
              <Label>goal · given to the agent</Label>
              <div style={{ fontFamily: SANS, fontSize: 40, lineHeight: 1.35, color: C.text, marginTop: 18, maxWidth: 1180 }}>{typed(R.goal, t, at.run1 + 0.2, 110)}<span style={{ opacity: Math.floor(t * 3) % 2 }}>▍</span></div>
              <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
                {["budget_fy27.xlsx", "policy.yaml", "salary_table.csv", "invoices/ ×13", "competitors.yaml"].map((f, i) => {
                  const k = spr(t, at.run1 + 0.5 + i * 0.08);
                  return <Chip key={f} size={20} style={{ opacity: k, transform: `translateY(${(1 - k) * 20}px)` }}>{f}</Chip>;
                })}
              </div>
            </div>
          </Stage>
          {/* run2: the plan */}
          <Stage t={t} a={at.run2} b={at.run3}>
            <div style={{ padding: "26px 40px", display: "flex", gap: 40 }}>
              <div style={{ flex: 1 }}>
                <Label color={C.accent2}>plan · written by gpt-5-nano, validated against a schema</Label>
                <div style={{ fontFamily: SANS, fontSize: 28, lineHeight: 1.45, color: C.text2, marginTop: 16 }}>{typed(R.plan, t, at.run2 + 0.1, 150).slice(0, 330)}</div>
              </div>
              <div style={{ width: 360, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 150, color: C.text, letterSpacing: -6, lineHeight: 1 }}><Count t={t} a={bt("run2.tool") - 0.6} b={bt("run2.tool") + 0.6} to={tasks.length} /></div>
                <Label>tool calls in this run</Label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(9, 22px)", gap: 7, marginTop: 18 }}>
                  {tasks.map((x, i) => { const k = spr(t, bt("run2.tool") - 0.6 + i * 0.025); return <div key={i} style={{ width: 22, height: 22, borderRadius: 5, background: x.status === "done" ? C.up : C.down, opacity: k * 0.85, transform: `scale(${k})` }} />; })}
                </div>
              </div>
            </div>
          </Stage>
          {/* run3: tool calls stream */}
          <Stage t={t} a={at.run3} b={at.run4}>
            <div style={{ padding: "6px 40px", display: "flex", gap: 36 }}>
              <div style={{ width: 860 }}>
                <Label style={{ marginBottom: 10 }}>act → observe · one tool call at a time</Label>
                {(() => {
                  const rows = [
                    ...firstFive.map((x, i) => ({ x, at: at.run3 + 0.1 + i * ((bt("run3.competitors") - at.run3 - 0.4) / firstFive.length) })),
                    ...compTasks.map((x, i) => ({ x, at: bt("run3.competitors") - 0.1 + i * 0.12 })),
                  ];
                  const shown = rows.filter((r) => t >= r.at).length;
                  const VIS = 10, RH = 46;
                  // keep the newest rows in view: the list scrolls up as tool calls stream in
                  const scroll = rows.reduce((acc, r, i) => acc + (i >= VIS ? spr(t, r.at, { damping: 22, stiffness: 240 }) * RH : 0), 0);
                  return (
                    <div style={{ height: VIS * RH, overflow: "hidden", maskImage: "linear-gradient(transparent, black 12%, black 100%)" }}>
                      <div style={{ transform: `translateY(${-scroll}px)` }}>{rows.map((r) => <Row key={r.x.id} t={t} at={r.at} task={r.x} />)}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
            <div style={{ position: "absolute", right: 40, top: 40, width: 330, display: "flex", flexDirection: "column", gap: 12 }}>
              <Label color={C.up} style={{ opacity: win(t, bt("run3.competitors") - 0.2, 999) }}>crustdata · real headcount</Label>
              {(R.competitors as any[]).map((c, i) => {
                const k = spr(t, bt("run3.competitors") + 0.1 + i * 0.1, { damping: 14, stiffness: 230 });
                return (
                  <div key={c.domain} style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", padding: "12px 18px", borderRadius: 12, background: C.field, border: `1px solid ${C.line}`, opacity: k, transform: `translateX(${(1 - k) * 60}px)` }}>
                    <span style={{ fontFamily: SANS, fontSize: 24, color: C.text }}>{c.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 24, color: C.up }}><Count t={t} a={bt("run3.competitors") + 0.1 + i * 0.1} b={bt("run3.competitors") + 1 + i * 0.1} to={c.headcount} /></span>
                  </div>
                );
              })}
            </div>
          </Stage>
          {/* run4: 71 checks, 9 failed; the budget row */}
          <Stage t={t} a={at.run4} b={at.run5}>
            <div style={{ padding: "6px 40px" }}>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 40 }}>
                <div>
                  <Label>verify · deterministic python checks</Label>
                  <div style={{ fontFamily: SANS, fontWeight: 800, fontSize: 130, letterSpacing: -5, lineHeight: 1.05 }}>
                    <Count t={t} a={at.run4 + 0.2} b={bt("run4.checks") + 0.4} to={R.checks_total} />
                    <span style={{ fontSize: 46, fontWeight: 500, color: C.text2, letterSpacing: -1 }}> checks · <span style={{ color: C.down }}>{R.checks_failed} failed</span></span>
                  </div>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(24, 1fr)", gap: 8, marginTop: 18, width: 1080 }}>
                {Array.from({ length: R.checks_total }).map((_, i) => {
                  const fail = !R.check_results[i];
                  const k = spr(t, at.run4 + 0.2 + i * 0.012);
                  return <div key={i} style={{ height: 22, borderRadius: 5, background: fail ? C.down : "rgba(61,191,85,0.75)", transform: `scale(${k})` }} />;
                })}
              </div>
              <div style={{ marginTop: 40, padding: "22px 26px", borderRadius: 14, border: `1px solid ${C.down}`, background: "rgba(236,95,90,0.08)", opacity: spr(t, bt("run4.off") - 0.5), transform: `scale(${0.96 + 0.04 * spr(t, bt("run4.off") - 0.5)})` }}>
                <div style={{ fontFamily: MONO, fontSize: 24, color: C.down, lineHeight: 1.5 }}>{dec.check}</div>
              </div>
            </div>
          </Stage>
          {/* run5: the decision */}
          <Stage t={t} a={at.run5} b={at.run6}>
            <div style={{ padding: "6px 40px" }}>
              <Label color={C.accent2}>decide:recovery · {dec.model}</Label>
              <div style={{ fontFamily: MONO, fontSize: 22, color: C.text3, marginTop: 12 }}>task {dec.task} · read_budget · budget_fy27.xlsx</div>
              <div style={{ display: "flex", gap: 22, marginTop: 40 }}>
                {dec.options.map((o: string) => {
                  const isDefault = o === dec.default, isChosen = o === dec.chosen;
                  const lit = t < bt("run5.reread") ? isDefault && t > bt("run5.rule") - 0.2 : isChosen;
                  const pop = isChosen ? spr(t, bt("run5.reread"), { damping: 9, stiffness: 260 }) : 0;
                  return (
                    <div key={o} style={{ position: "relative", padding: "22px 30px", borderRadius: 14, fontFamily: MONO, fontSize: 32,
                      border: `2px solid ${lit ? (isChosen && t >= bt("run5.reread") ? C.accent : C.text2) : C.line2}`,
                      background: lit && isChosen ? "rgba(143,141,240,0.16)" : C.field, color: lit ? C.text : C.text3,
                      transform: `scale(${1 + pop * 0.08 - (isDefault && t >= bt("run5.reread") ? 0.04 : 0)})`, boxShadow: lit && isChosen ? `0 0 50px ${C.accent}66` : "none" }}>
                      {o}{isDefault ? <span style={{ fontSize: 18, color: C.text3 }}>  · rule default</span> : null}
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 44, display: "flex", gap: 20, alignItems: "baseline", opacity: spr(t, bt("run5.reread") + 0.15) }}>
                <Chip size={22} color={C.accent2} bg="rgba(143,141,240,0.14)">OVERRIDE</Chip>
                <div style={{ fontFamily: SANS, fontSize: 30, color: C.text2, lineHeight: 1.4, maxWidth: 1050 }}>“{dec.reason}”</div>
              </div>
            </div>
          </Stage>
          {/* run6: scanned + corrupt invoices */}
          <Stage t={t} a={at.run6} b={at.run7}>
            <div style={{ padding: "6px 40px", display: "flex", gap: 30 }}>
              {[
                { at: bt("run6.scanned"), file: tasks.find((x) => x.id === "t15")?.target, err: scanned?.check.replace("tool_error: tool_error: ", ""), steps: [["reparse_alt", "LLM reader"], ["✓ read", ""]], ok: true },
                { at: bt("run6.corrupt"), file: na?.input, err: "No /Root object! — is this really a PDF?", steps: [[corrupt[0]?.chosen, "second parser"], [corrupt[1]?.chosen, ""], ["listed: Not analysed", ""]], ok: false },
              ].map((c, i) => {
                const k = spr(t, c.at - 0.1, { damping: 16, stiffness: 200 });
                return (
                  <div key={i} style={{ flex: 1, padding: 30, borderRadius: 16, background: C.field, border: `1px solid ${C.line2}`, opacity: k, transform: `translateY(${(1 - k) * 60}px) rotate(${(1 - k) * (i ? 3 : -3)}deg)` }}>
                    <Label>{i ? "corrupt pdf" : "scanned pdf"}</Label>
                    <div style={{ fontFamily: MONO, fontSize: 24, color: C.text, marginTop: 12 }}>{c.file}</div>
                    <div style={{ fontFamily: MONO, fontSize: 20, color: C.down, marginTop: 12 }}>✗ {c.err}</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 24 }}>
                      {c.steps.map(([a, b], j) => {
                        const kk = spr(t, c.at + 0.35 + j * (i ? 0.45 : 0.4));
                        const last = j === c.steps.length - 1;
                        return <div key={j} style={{ opacity: kk, transform: `translateX(${(1 - kk) * 30}px)`, fontFamily: MONO, fontSize: 24, color: last ? (c.ok ? C.up : C.warn) : C.accent2 }}>→ {a} <span style={{ color: C.text3 }}>{b}</span></div>;
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </Stage>
          {/* run7: 10 decisions, 5 overrides */}
          <Stage t={t} a={at.run7} b={end}>
            <div style={{ padding: "6px 40px" }}>
              <Label>every recovery decision in this run</Label>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16, marginTop: 24 }}>
                {(R.decisions as any[]).map((d, i) => {
                  const k = spr(t, at.run7 + 0.05 + i * 0.05);
                  const hot = d.overrode && t > bt("run7.beat") - 0.3;
                  return (
                    <div key={i} style={{ padding: "18px 18px", borderRadius: 12, background: hot ? "rgba(143,141,240,0.15)" : C.field, border: `1px solid ${hot ? C.accent : C.line}`, opacity: k, transform: `scale(${0.9 + 0.1 * k + (hot ? 0.03 : 0)})` }}>
                      <div style={{ fontFamily: MONO, fontSize: 17, color: C.text3 }}>{d.task}</div>
                      <div style={{ fontFamily: MONO, fontSize: 22, color: hot ? C.text : C.text2, marginTop: 6 }}>{d.chosen}</div>
                      <div style={{ fontFamily: MONO, fontSize: 15, color: hot ? C.accent2 : C.text3, marginTop: 6 }}>{d.overrode ? `rule said ${d.default}` : "= rule"}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 36, fontFamily: SANS, fontSize: 64, fontWeight: 700, letterSpacing: -2, opacity: spr(t, bt("run7.beat") - 0.2) }}>
                {(R.decisions as any[]).filter((d) => d.overrode).length} of {(R.decisions as any[]).length} <Serif color={C.accent2}>beat the default rule</Serif>
              </div>
            </div>
          </Stage>
        </div>
      </Panel>
    </div>
  );
};
export { fmt, map };
