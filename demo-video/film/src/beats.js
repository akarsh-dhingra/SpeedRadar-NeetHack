// Visual hits and sound effects, timed to the narration's own word timestamps (Whisper, see voice/align.py).
// The film reads these to time its animations; film/cues.mjs turns the `sfx` ones into build/cues.json for the mix.
// Plain JS so both Remotion (bundled) and Node (cues.mjs) can import it.

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, "");

// Time (s) of a word in a line: first match of any needle (whole token, normalised) at or after `nth` matches.
// Whisper may write numbers as digits or words, so callers pass both spellings; if nothing matches, falls back
// to `frac` of the way through the line.
export function wordT(line, needles, { nth = 0, frac = 0.5, end = false } = {}) {
  if (!line) return 0;
  const want = needles.map(norm);
  let seen = 0;
  for (const w of line.words || []) {
    if (want.includes(norm(w.w))) {
      if (seen === nth) return end ? w.t1 : w.t0;
      seen++;
    }
  }
  return line.start + line.dur * frac;
}

const S = (id, line, needles, sfx, opts = {}) => ({ id, line, needles, sfx, ...opts });

// id: "<line>.<name>"; needles; sfx (or null for a visual-only hit); options for wordT / gain.
const SPEC = [
  S("hook1.doubled", "hook1", ["doubled"], "pop"),
  S("hook2.quarter", "hook2", ["quarter"], "boom", { gain: 0.8 }),
  S("hook3.first", "hook3", ["first"], "riser", { gain: 0.9, shift: -0.6 }),
  S("title1.radar", "title1", ["radar"], "boom"),
  S("title1.files", "title1", ["files"], "tick"),
  S("title1.data", "title1", ["data"], "tick"),
  S("title1.wrong", "title1", ["wrong"], "glitch"),
  S("run1.real", "run1", ["real"], "ping"),
  S("run2.plan", "run2", ["plan"], "tick"),
  S("run2.tool", "run2", ["tool"], "tick"),
  S("run3.budget", "run3", ["budget"], "tick", { frac: 0.05 }),
  S("run3.invoices", "run3", ["invoices"], "tick", { frac: 0.3 }),
  S("run3.competitors", "run3", ["competitors"], "ping", { frac: 0.7 }),
  S("run4.checks", "run4", ["seventyone", "seventy", "71"], "pop", { frac: 0.35 }),
  S("run4.off", "run4", ["off"], "glitch", { frac: 0.75 }),
  S("run5.rule", "run5", ["rule"], "tick"),
  S("run5.reread", "run5", ["reread", "re", "read"], "stamp", { frac: 0.7 }),
  S("run6.scanned", "run6", ["scanned"], "tick"),
  S("run6.corrupt", "run6", ["corrupt"], "glitch", { frac: 0.4 }),
  S("run6.analysed", "run6", ["analysed", "analyzed"], "pop", { frac: 0.9 }),
  S("run7.half", "run7", ["half"], "tick", { frac: 0.05 }),
  S("run7.beat", "run7", ["beat"], "ding", { frac: 0.7 }),
  S("aud5.source", "aud5", ["source"], "ping", { frac: 0.9 }),
  S("how1.plans", "how1", ["plans"], "tick"),
  S("how1.budget", "how1", ["budget"], "tick"),
  S("how1.invoices", "how1", ["invoices"], "tick"),
  S("how1.policy", "how1", ["policy"], "tick"),
  S("how2.crust", "how2", ["crust", "crustdata"], "ping"),
  S("how3.python", "how3", ["python"], null),
  S("how3.source", "how3", ["source"], "pop"),
  S("rec1.scanned", "rec1", ["scanned"], "glitch"),
  S("rec1.rate", "rec1", ["rate"], "glitch"),
  S("rec1.add", "rec1", ["add"], "glitch"),
  S("rec2.recovery", "rec2", ["recovery"], "tick"),
  S("rec2.count", "rec2", ["hundred", "183"], null, { frac: 0.35 }),
  S("rec2.overrode", "rec2", ["overrode", "overrode"], "stamp", { frac: 0.85 }),
  S("aud1.part", "aud1", ["part"], "riser", { gain: 0.7, shift: -0.2 }),
  S("aud2.million", "aud2", ["million", "528", "5.28"], "boom", { frac: 0.55 }),
  S("aud3.argued", "aud3", ["argued"], "whoosh"),
  S("aud3.overturned", "aud3", ["overturned"], "stamp", { gain: 1.2 }),
  S("aud4.never", "aud4", ["never"], null),
  S("gen1.seven", "gen1", ["seven", "7"], "pop", { frac: 0.1 }),
  S("gen1.six", "gen1", ["six", "6"], "pop", { frac: 0.55 }),
  S("gen2.caught", "gen2", ["caught"], "ding"),
  S("gen2.zero", "gen2", ["zero", "0"], "pop"),
  S("gen3.purpose", "gen3", ["purpose"], "glitch"),
  S("nl1.call", "nl1", ["call"], "tick"),
  S("nl1.retry", "nl1", ["retry"], "tick"),
  S("nl1.decision", "nl1", ["decision"], "tick"),
  S("nl1.neatlogs", "nl1", ["neat", "neatlogs"], "ping"),
  S("nl2.three", "nl2", ["three", "3"], "glitch", { frac: 0.2 }),
  S("nl2.fix", "nl2", ["fix"], "whoosh"),
  S("nl2.five", "nl2", ["five", "5"], "ding", { nth: 1, frac: 0.6 }),
  S("nl2.cut", "nl2", ["cut"], null, { frac: 0.75 }),
  S("nl3.three", "nl3", ["three", "3"], "glitch", { frac: 0.55 }),
  S("nl3.one", "nl3", ["one", "1"], "stamp", { frac: 0.8 }),
  S("ent1.memory", "ent1", ["memory"], "ping"),
  S("ent1.sixty", "ent1", ["sixty", "60"], "pop", { frac: 0.5 }),
  S("ent2.span", "ent2", ["span"], "tick"),
  S("ent2.code", "ent2", ["code"], "tick"),
  S("ent2.commit", "ent2", ["commit"], "tick"),
  S("ent2.prompt", "ent2", ["prompt"], "ping"),
  S("ent3.bug", "ent3", ["bug"], "glitch"),
  S("ent3.merged", "ent3", ["merged"], "ding"),
  S("cfo1.plan", "cfo1", ["plan"], "ping"),
  S("cfo2.three", "cfo2", ["three", "3"], "pop", { frac: 0.15 }),
  S("cfo2.ninety", "cfo2", ["ninety", "ninetynine", "99"], "boom", { frac: 0.7, gain: 0.8 }),
  S("cfo3.january", "cfo3", ["january"], "ding", { frac: 0.35 }),
  S("cfo3.team", "cfo3", ["team"], "pop", { frac: 0.8 }),
  S("out1.source", "out1", ["source"], "boom"),
  S("out2.hack", "out2", ["hack", "neathack"], "ding", { frac: 0.8 }),
];

export function beats(tl) {
  const lines = Object.fromEntries(tl.lines.map((l) => [l.id, l]));
  const out = {};
  for (const s of SPEC) {
    if (!lines[s.line]) continue; // line not in this cut of the script
    const t = wordT(lines[s.line], s.needles, s) + (s.shift || 0);
    out[s.id] = { t: Math.max(0, t), sfx: s.sfx, gain: s.gain ?? 1 };
  }
  // A whoosh on every scene change after the first.
  tl.scenes.slice(1).forEach((sc) => { out[`cut.${sc.id}`] = { t: Math.max(0, sc.start - 0.12), sfx: "whoosh", gain: 0.7 }; });
  return out;
}
