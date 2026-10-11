/* Spend Radar site. Reads window.SPEND_RADAR_DATA (written by `python -m spendradar export`) and renders it.
 * Rule from the design system: show, never compute. Values are printed as exported; the page only picks,
 * sorts and formats them. */
(function () {
  "use strict";

  var D = window.SPEND_RADAR_DATA;
  var REPO = "https://github.com/akarsh-dhingra/SpeedRadar-NeetHack";
  var BLOB = REPO + "/blob/main/";
  var NL_TRACE = "https://app.neatlogs.com/traces/";
  var FX = window.SRFX || { on: function () { return false; }, after: function () {}, intro: function (d, done) { done(); }, setOrigin: function () {}, setMotion: function () {} };
  var WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];

  var VIEWS = [
    { id: "overview", label: "Overview", icon: "grid", group: "Evidence" },
    { id: "run", label: "Run detail", icon: "file", group: "Evidence" },
    { id: "disproved", label: "Disproved itself", icon: "shield", group: "Evidence" },
    { id: "recovery", label: "Recovery log", icon: "swap", group: "Evidence" },
    { id: "compare", label: "Before / after", icon: "split", group: "Evidence" },
    { id: "business", label: "cfo.ai business plan", icon: "briefcase", group: "Tools" },
    { id: "traces", label: "neatlogs", icon: "trace", group: "Tools" },
    { id: "entire", label: "Entire", icon: "branch", group: "Tools" }
  ];

  var ICONS = {
    pulse: '<polyline points="3 12 7 12 10 5 14 19 17 12 21 12"/>',
    grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
    file: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4"/><path d="M10 12h5M10 16h5"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M9 12l2 2 4-4"/>',
    swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
    split: '<rect x="3.5" y="5" width="7" height="14" rx="1.5"/><rect x="13.5" y="5" width="7" height="14" rx="1.5"/>',
    briefcase: '<rect x="4" y="7" width="16" height="12" rx="2"/><path d="M9 7V5h6v2"/>',
    trace: '<circle cx="6" cy="6" r="2"/><circle cx="18" cy="18" r="2"/><path d="M8 6h6a4 4 0 010 8h-4a4 4 0 000 8"/>',
    chevron: '<polyline points="9 6 15 12 9 18"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    up: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
    down: '<polyline points="3 7 9 13 13 9 21 17"/><polyline points="15 17 21 17 21 11"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3"/>',
    branch: '<circle cx="6" cy="6" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="18" cy="9" r="2"/><path d="M6 8v8M18 11c0 4-6 3-10 6"/>',
    play: '<path d="M8 5.5v13l10-6.5z"/>',
    plan: '<path d="M5 5h14M5 10h9M5 15h14M5 20h6"/>',
    act: '<path d="M14.5 4.5l5 5-10 10H4.5v-5z"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.5"/>',
    check: '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
    fork: '<path d="M6 4v6a4 4 0 004 4h4a4 4 0 014 4v2M18 4v6"/><path d="M15 7l3-3 3 3"/>',
    report: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h3"/>'
  };
  function icon(name, cls) { return '<svg class="ac-icon' + (cls ? " " + cls : "") + '" viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>"; }

  // ── small helpers ────────────────────────────────────────────────
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n(v) { return v == null ? '<span class="sr-muted">—</span>' : Number(v).toLocaleString("en-US"); }
  function word(v) { return WORDS[v] || String(v); }
  function score(m) { return m.planted_caught + " / " + m.planted_total; }
  function allCaught(m) { return m.planted_caught === m.planted_total; }
  function when(r) {
    var s = r.started_at || r.scored_at; if (!s) return "—";
    var d = new Date(r.started_at ? s : s + "+05:30");
    try { return d.toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) + " IST"; } catch (e) { return s; }
  }
  function shortId(id) { return String(id).split("-").pop(); }
  function company(key) { for (var i = 0; i < D.companies.length; i++) if (D.companies[i].key === key) return D.companies[i]; return null; }
  function runOf(c, id) { for (var i = 0; i < c.runs.length; i++) if (c.runs[i].run_id === id) return c.runs[i]; return null; }
  function latest(c) { return runOf(c, c.latest_run_id) || c.runs[c.runs.length - 1]; }
  function findRun(id) { for (var i = 0; i < D.companies.length; i++) { var r = runOf(D.companies[i], id); if (r) return { c: D.companies[i], r: r }; } return null; }
  function shortName(c) { return c.name.replace(/ Inc\.$/, ""); }
  function avatar(c, cls) { return '<span class="ac-avatar' + (cls ? " " + cls : "") + '" aria-hidden="true">' + esc(c.name.charAt(0)) + "</span>"; }
  function roleLabel(c) { return c.role === "development" ? "development set" : "held-out"; }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem("sr." + k); localStorage.setItem("sr." + k, v); } catch (e) { return null; } }

  function parseNote(note) {
    var m = /^(second opinion )?([^:]+?): (confirm|downgrade|overturn)\s+[—-]\s+([\s\S]*)$/.exec(note);
    if (!m) return { who: "", verdict: "", text: note, second: false };
    return { who: m[2], verdict: m[3], text: m[4], second: !!m[1] };
  }
  function firstSentence(t) { var m = /^[\s\S]*?[.!?](\s|$)/.exec(t); return m ? m[0].trim() : t; }
  var VERDICT_CLASS = { confirm: "ac-up", downgrade: "ac-warn", overturn: "ac-down" };
  var STATUS_BADGE = { confirmed: ["ac-badge--up", "✓ Confirmed"], downgraded: ["ac-badge--warn", "↘ Downgraded"], overturned: ["ac-badge--down", "✗ Overturned"] };
  function statusBadge(s) { var b = STATUS_BADGE[s] || ["ac-badge--neutral", s]; return '<span class="ac-badge ' + b[0] + '">' + b[1] + "</span>"; }

  // ── state ────────────────────────────────────────────────────────
  var S = {
    view: "overview",
    company: store("company") || D.featured.company,
    runId: null,
    metric: "caught",
    disproved: "overturned",
    recovery: "overrides",
    recoveryShown: 30
  };
  if (!company(S.company)) S.company = D.companies[0].key;

  // ── shell ────────────────────────────────────────────────────────
  var app = document.getElementById("app");
  function navLinks(cls) {
    var html = "", group = "";
    VIEWS.forEach(function (v) {
      if (cls === "nav" && v.group !== group) { group = v.group; html += '<div class="ac-overline">' + group + "</div>"; }
      html += '<a href="#' + v.id + '" data-view="' + v.id + '">' + (cls === "nav" ? icon(v.icon) : "") + v.label + "</a>";
    });
    return html;
  }
  app.innerHTML =
    '<div class="ac-app">' +
      '<nav class="ac-nav" aria-label="Main">' +
        '<div class="ac-brand">' + icon("pulse") + "<div>Spend Radar<small>by team qwep · neatHack 2026</small></div></div>" +
        navLinks("nav") +
        '<div class="sr-nav-foot">An agent that tells a finance team where competitors outspend them on people, then tries to disprove its own findings. <b>All company finance data here is fictional.</b> Competitors are real companies; their data comes from Crustdata.</div>' +
      "</nav>" +
      "<div>" +
        '<header class="ac-topbar"><div class="ac-crumbs" id="crumbs"></div>' +
          '<div class="ac-row" style="flex-wrap:nowrap"><span class="ac-pill" id="modepill">Real data</span><button type="button" class="ac-btn ac-btn--ghost sr-motion" id="motion" aria-pressed="' + FX.on() + '">' + icon("pulse") + "Motion</button>" +
          '<a class="ac-btn ac-btn--ghost" href="' + REPO + '" target="_blank" rel="noopener">' + icon("branch") + "Source</a></div>" +
        "</header>" +
        '<nav class="sr-tabs" aria-label="Sections">' + navLinks("tabs") + "</nav>" +
        '<main class="ac-main" id="main" tabindex="-1"></main>' +
      "</div>" +
    "</div>" +
    '<div class="sr-toast" id="toast" role="status" aria-live="polite"></div>';
  var main = document.getElementById("main");

  function toast(msg) {
    var t = document.getElementById("toast"); t.textContent = msg; t.classList.add("is-on");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("is-on"); }, 1600);
  }
  function copyBtn(value, label) { return '<button class="ac-copy" type="button" data-copy="' + esc(value) + '" aria-label="Copy ' + esc(label) + '">' + icon("copy") + "</button>"; }

  // ── shared pieces ────────────────────────────────────────────────
  function cells(r, row) {
    return r.planted.map(function (p, i) {
      return '<i class="' + (p.caught ? "" : "miss") + '" style="--r:' + (row || 0) + ";--c:" + i + '" title="' + esc(p.label) + (p.caught ? " — caught" : " — missed") + '">' + (p.caught ? "✓" : "✗") + "</i>";
    }).join("");
  }

  function badges(c, r) {
    var b = ['<span class="ac-badge ac-badge--neutral">Fictional company data</span>',
      '<span class="ac-badge ac-badge--neutral">' + (c.role === "development" ? "Development set" : "Held-out · never tuned on") + "</span>"];
    if (r) {
      if (r.data_mode === "fixture") b.push('<span class="ac-badge ac-badge--warn">FIXTURE · altered competitor data, eval only</span>');
      (r.injected_faults || []).forEach(function (f) { b.push('<span class="ac-badge ac-badge--accent">Injected · ' + esc(f) + "</span>"); });
      if (r.phase && r.phase !== "done") b.push('<span class="ac-badge ac-badge--down">✗ Did not finish · stopped in ' + esc(r.phase) + "</span>");
      if (r.metrics.fallback_hops > 0) b.push('<span class="ac-badge ac-badge--neutral">' + n(r.metrics.fallback_hops) + " fallback hops · not a clean comparison</span>");
    }
    return '<div class="ac-row sr-badges">' + b.join("") + "</div>";
  }

  function chart(c, metric, currentId, clickable) {
    var all = c.runs, LIMIT = 14, runs = all.slice(-LIMIT);
    if (currentId && !runs.some(function (r) { return r.run_id === currentId; })) {
      var idx = all.findIndex(function (r) { return r.run_id === currentId; });
      runs = all.slice(Math.max(0, idx - LIMIT + 1), idx + 1);
    }
    var W = 640, H = 250, top = 36, base = 214, x0 = 8, x1 = 604;
    function ghost(r) { return metric === "caught" ? r.metrics.planted_total : metric === "recovery" ? r.metrics.recovery_decisions : r.metrics.llm_calls; }
    function front(r) { return metric === "caught" ? r.metrics.planted_caught : metric === "recovery" ? r.metrics.recovery_non_default : r.metrics.llm_calls; }
    var max = Math.max.apply(null, runs.map(ghost).concat([1]));
    var steps = [1, 2, 5, 10, 20, 25, 50, 100], step = steps[steps.length - 1];
    for (var s = 0; s < steps.length; s++) if (max / steps[s] <= 4) { step = steps[s]; break; }
    var ceil = Math.ceil(max / step) * step;
    function y(v) { return base - (v / ceil) * (base - top); }
    var out = "";
    for (var t = 0; t <= ceil; t += step) out += '<line class="grid" x1="4" x2="610" y1="' + y(t).toFixed(1) + '" y2="' + y(t).toFixed(1) + '"/><text class="axis" x="618" y="' + (y(t) + 4).toFixed(1) + '">' + t + "</text>";
    var slot = (x1 - x0) / runs.length, bw = Math.min(28, slot * 0.46);
    runs.forEach(function (r, i) {
      var cx = x0 + slot * (i + 0.5), x = (cx - bw / 2).toFixed(1), g = ghost(r), f = front(r);
      var cls = metric === "caught" ? (f === g ? "bar-up" : "bar-down") : metric === "recovery" ? "bar-accent" : "bar-neutral";
      var cur = r.run_id === currentId;
      var label = metric === "caught" ? score(r.metrics) + " caught" : metric === "recovery" ? f + " of " + g + " recoveries differ from the rule" : f + " LLM calls";
      out += '<g class="col' + (cur ? " is-current" : "") + '" data-run="' + r.run_id + '"' + (clickable ? ' tabindex="0" role="button"' : "") + ' aria-label="Run ' + r.run_id + ": " + esc(label) + '">' +
        "<title>" + r.run_id + " · " + esc(label) + "</title>" +
        '<rect class="ghost" x="' + x + '" y="' + y(g).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (base - y(g)).toFixed(1) + '" rx="3"/>' +
        (f > 0 ? '<rect class="' + cls + '" style="--i:' + i + '" x="' + x + '" y="' + y(f).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + (base - y(f)).toFixed(1) + '" rx="3"/>' : "") +
        '<text class="' + (cur ? "axis-now" : "axis") + '" x="' + cx.toFixed(1) + '" y="234" text-anchor="middle">' + shortId(r.run_id) + "</text></g>";
    });
    var first = all[0], last = latest(c);
    var head = metric === "caught" ? "FIRST <tspan class=\"ohlc-v\">" + score(first.metrics) + "</tspan>   LATEST <tspan class=\"ohlc-v\">" + score(last.metrics) + "</tspan>   RUNS <tspan class=\"ohlc-v\">" + all.length + "</tspan>"
      : metric === "recovery" ? "GHOST = DECISIONS   FRONT = <tspan class=\"ohlc-v\">OVERRIDES OF THE RULE</tspan>" : "LLM CALLS PER RUN";
    var note = all.length > runs.length ? '<div class="sr-chart-note">Showing ' + runs.length + " of " + all.length + " runs, oldest on the left. Run IDs are shortened to their last six characters.</div>" : '<div class="sr-chart-note">Oldest on the left. Run IDs are shortened to their last six characters.</div>';
    return '<svg class="ac-chart" viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="' + esc(shortName(c)) + ' runs"><text class="ohlc" x="4" y="12">' + head + "</text>" + out + "</svg>" + note;
  }

  function heroCard(c, r, clickable) {
    var m = r.metrics;
    var seg = [["caught", "Caught"], ["llm", "LLM calls"], ["recovery", "Recoveries"]].map(function (s) {
      return '<button type="button" data-metric="' + s[0] + '" aria-pressed="' + (S.metric === s[0]) + '">' + s[1] + "</button>";
    }).join("");
    return '<section class="ac-card">' +
      '<div class="ac-card-head" style="align-items:flex-start">' +
        '<div class="ac-hero-id">' + avatar(c) + '<div><div class="ac-hero-name">' + esc(c.name) + " " + modePill(r) + '</div><div class="ac-hero-sub">' + esc(c.industry) + " · " + roleLabel(c) + "</div></div></div>" +
        '<div class="ac-seg" role="group" aria-label="Chart metric">' + seg + "</div>" +
      "</div>" +
      '<div class="ac-hero-figure"><span class="ac-display">' + score(m) + '</span><span class="ac-delta" style="margin:0">' +
        (m.false_alarms === 0 ? '<b class="ac-up">' + icon("up") + "0 false alarms</b>" : m.false_alarms == null ? '<b>—</b> false alarms not counted yet' : '<b class="ac-down">' + icon("down") + n(m.false_alarms) + " false alarms</b>") +
        ' run <span class="sr-mono">' + r.run_id + "</span></span></div>" +
      '<div id="chart">' + chart(c, S.metric, r.run_id, clickable) + "</div>" +
    "</section>";
  }
  function modePill(r) { return r.data_mode === "fixture" ? '<span class="ac-pill ac-pill--fixture">Fixture</span>' : '<span class="ac-pill">Real</span>'; }

  function companyList(activeKey) {
    return '<section class="ac-card"><div class="ac-card-head"><h3 class="ac-card-title">Companies</h3><span class="ac-card-meta">latest finished run</span></div><ul class="ac-list">' +
      D.companies.map(function (c) {
        var r = latest(c), m = r.metrics, ok = allCaught(m);
        return '<li class="ac-li sr-company" data-company="' + c.key + '" tabindex="0" role="button" aria-label="Open ' + esc(c.name) + '" style="cursor:pointer' + (c.key === activeKey ? ";background:var(--bg-field)" : "") + '">' +
          avatar(c) + '<div class="ac-li-main"><div class="ac-li-name">' + esc(c.name) + '</div><div class="ac-li-sub">' + esc(c.industry) + (c.role === "development" ? " · development" : "") + "</div></div>" +
          '<div class="ac-li-end"><div class="ac-li-name">' + score(m) + '</div><small class="' + (ok ? "ac-up" : "ac-down") + '">' + (ok ? "✓ all caught" : "✗ missed " + (m.planted_total - m.planted_caught)) + "</small></div></li>";
      }).join("") + "</ul></section>";
  }

  function proofChain(c, r, f, opts) {
    opts = opts || {};
    var stmt = f.statement, pct = /(\d+(?:\.\d+)?%)/.exec(stmt), money = /\$[\d,]+/.exec(stmt);
    var claim = pct ? pct[1] : money ? money[0] : "—";
    var firstClause = stmt.split(";")[0].replace(c.name + " ", "").replace(/^ml_ai/, "ML/AI").replace(/^(engineering|sales|marketing) /, function (s) { return s.charAt(0).toUpperCase() + s.slice(1); });
    var ci = f.confidence_inputs || {};
    var notes = (f.audit_notes || []).map(parseNote).filter(function (x) { return x.who; });
    var status = f.status, verdictCls = status === "overturned" ? "ac-step--verdict" : status === "downgraded" ? "ac-step--warn" : "ac-step--up";
    var auditors = notes.map(function (x) {
      return '<p class="sr-quote"><b>' + esc(x.who) + (x.second ? " (second opinion)" : "") + ':</b> <span class="sr-verdict-word ' + (VERDICT_CLASS[x.verdict] || "") + '">' + esc(x.verdict) + ".</span> " + esc(firstSentence(x.text)) + "</p>";
    }).join("") || '<p class="sr-quote">No LLM audit note on this finding.</p>';
    var evidence = ci.checks
      ? '<p>Signals that agree: <strong>' + esc(ci.agreement != null ? ci.agreement : "—") + "</strong> · checks passed: <strong>" + esc(ci.checks) + "</strong> · independent signals: <strong>" + esc(ci.n_signals != null ? ci.n_signals : "—") + "</strong>" + (ci.oldest_input_days != null ? " · oldest input: <strong>" + esc(ci.oldest_input_days) + (ci.oldest_input_days === 1 ? " day" : " days") + "</strong>" : "") + ".</p><p>Its own confidence formula scored the finding <strong>" + esc(f.confidence) + "</strong>.</p>"
      : "<p>" + esc(f.statement) + "</p>";
    var verdictText = status === "overturned" ? (money ? "Overturned. The " + esc(money[0]) + " gap estimate stays out of the report." : "Overturned. The claim stays out of the report.")
      : status === "downgraded" ? "Downgraded. The claim stays in the report with its confidence cut." : "Confirmed after the audit.";
    return '<section class="ac-card' + (opts.lift ? " sr-lift" : "") + '">' +
      '<div class="ac-card-head"><div><span class="ac-overline-inline">' + (opts.overline || "The agent disproved itself") + '</span><h3 class="ac-card-title" style="margin-top:var(--space-1)">' + esc(shortName(c)) + " · " + esc(f.category === "ml_ai" ? "ML/AI" : f.category) + " headcount · run " + r.run_id + '</h3></div><span class="sr-stamp">' + statusBadge(status) + "</span></div>" +
      '<div class="ac-chain">' +
        '<div class="ac-step sr-tilt" style="--s:0"><span class="ac-step-n"><b>1</b>Analyst claim</span><span class="ac-claimnum">' + esc(claim) + "</span><p>" + esc(firstClause) + "." + (money ? '</p><p class="sr-claim-sub">Gap estimate in the claim: ' + esc(money[0]) + " a year." : "") + "</p></div>" +
        '<div class="ac-step sr-tilt" style="--s:1"><span class="ac-step-n"><b>2</b>Evidence</span>' + evidence + "</div>" +
        '<div class="ac-step sr-tilt" style="--s:2"><span class="ac-step-n"><b>3</b>' + (notes.length > 1 ? "Two auditors" : "Auditor") + "</span>" + auditors + "</div>" +
        '<div class="ac-step sr-tilt ' + verdictCls + '" style="--s:3"><span class="ac-step-n"><b>4</b>Verdict</span><span class="ac-claimnum">' + (status === "overturned" ? '<span class="ac-struck">' + esc(claim) + "</span>" : esc(claim)) + "</span><p>" + verdictText + "</p></div>" +
      "</div>" +
      (opts.foot ? '<div class="sr-chain-foot"><span>Quoted from the run\'s audit notes. Trace <span class="sr-mono">' + esc(r.neatlogs_trace_id) + "</span></span>" + opts.foot + "</div>" : "") +
    "</section>";
  }

  function provenance(r) {
    return '<section class="ac-card"><div class="ac-prov">' +
      '<div><div class="ac-prov-k">neatlogs trace</div><div class="ac-prov-v"><span>' + esc(r.neatlogs_trace_id) + "</span>" + copyBtn(r.neatlogs_trace_id, "trace ID") + "</div></div>" +
      '<div><div class="ac-prov-k">Commit</div><div class="ac-prov-v"><span>' + esc(r.git_sha) + "</span>" + copyBtn(r.git_sha, "commit") + "</div></div>" +
      '<div><div class="ac-prov-k">Scorecard</div><div class="ac-prov-v"><span><a href="' + BLOB + esc(r.scorecard) + '" target="_blank" rel="noopener">' + esc(r.scorecard) + "</a></span>" + copyBtn(r.scorecard, "scorecard path") + "</div></div>" +
      (r.code && r.code.checkpoint ? '<div><div class="ac-prov-k">Code · Entire checkpoint</div><div class="ac-prov-v"><span><a href="' + esc(r.code.entire_url) + '" target="_blank" rel="noopener">' + esc(r.code.checkpoint) + "</a></span>" + copyBtn(r.code.checkpoint, "checkpoint ID") + "</div></div>" : "") +
      '<div><div class="ac-prov-k">Started · models</div><div class="ac-prov-v"><span>' + esc(when(r)) + " · " + esc((r.metrics.models || []).join(", ") || "—") + "</span></div></div>" +
    "</div></section>";
  }

  function enter(html) { // wraps blocks so each lands in order
    var i = 0;
    return html.replace(/<(section|div) data-enter/g, function (m, tag) { return "<" + tag + ' style="--i:' + (i++) + '"'; });
  }

  // ── views ────────────────────────────────────────────────────────
  function toolsStrip() {
    var N = D.neatlogs || {}, E = D.entire || {}, B = (D.business || {}).headlines || {};
    function card(view, title, big, small, lines) {
      return '<a class="ac-card sr-tilt sr-tool" href="#' + view + '" data-view-link="' + view + '"><div class="ac-card-head"><h3 class="ac-card-title">' + title + '</h3>' + icon("arrow") + '</div><div class="ac-stat-value">' + big + '</div><div class="ac-delta">' + small + '</div><ul class="sr-tool-lines">' + lines.map(function (l) { return "<li>" + l + "</li>"; }).join("") + "</ul></a>";
    }
    var caught = (E.trails || []).reduce(function (a, t) { return a + (t.findings || []).length; }, 0);
    return '<div class="sr-section-title" data-enter><h2>Built with neatlogs, Entire and cfo.ai</h2><p>Each tool has a job in the loop, not a logo on a slide.</p></div>' +
      '<div class="sr-tools" data-enter>' +
        card("traces", "neatlogs", n(D.summary.runs_scored), "traced runs", [
          "Debugger: case studies 01\u201305 each start from a trace or a scorecard",
          "Auto-triage found the corrupt-PDF bug; fixed and resolved over the MCP",
          n((N.detections || []).length) + " detections and evals published as traces",
          n((N.prompts || []).length) + " prompt templates, versioned on every LLM span"]) +
        card("entire", "Entire", n(E.checkpoints), "checkpoints", [
          "Every run links to the checkpoint and agent session behind its code",
          n((E.trails || []).length) + " trails reviewed by " + n((E.runners || []).length) + " repo-tailored runners; " + n(caught) + " real issues caught before merge",
          "<span class=\"ac-code\">spendradar explain</span>: neatlogs span \u2192 code \u2192 checkpoint \u2192 prompt",
          "entire-graph search / impact used to locate and size changes"]) +
        card("business", "cfo.ai", esc(B.llm_cost_per_run || ""), "LLM cost per run, measured", [
          "Plan built from neatlogs token counts at paid-equivalent prices",
          "Pricing, costs, revenue and runway; base and growth scenarios",
          "Finding: competitor data is ~99% of run cost, so caching decides margin",
          "Team tier fixed with a fresh-run cap: 76.6% margin"]) +
      "</div>";
  }

  function judgeChecklist() {
    var rows = [
      ["The agent improved", "Before/after runs with traces and numbers, n = 5 per side for case study 05", "#compare", "Before / after"],
      ["Used neatlogs", "Trace IDs for every run, detections, evals, the auto-triage fix", "#traces", "neatlogs"],
      ["Used Entire", "Checkpoints, trails with runner findings, explain dossiers", "#entire", "Entire"],
      ["Used cfo.ai", "Pricing, costs, revenue and runway from measured costs", "#business", "cfo.ai plan"],
      ["Recovers from failure", "Every recovery decision with the menu, the choice and the rule default", "#recovery", "Recovery log"],
      ["Checks its own work", "Findings the self-audit overturned or downgraded, with reasons", "#disproved", "Disproved itself"],
      ["Built in public", "#neatHack posts with timestamps", BLOB + "evidence/build-in-public.md", "Posts"],
      ["Code written during the hackathon", "Dated commits from 10 Oct 12:30 IST, each with an Entire checkpoint", REPO + "/commits/main", "Commits"]
    ];
    return '<div class="sr-section-title" data-enter><h2>For judges: where each piece of evidence is</h2><p>Every number on this site comes from a saved scorecard or trace.</p></div>' +
      '<section class="ac-card" data-enter><div class="ac-scroll"><table class="ac-table"><thead><tr><th>You asked for</th><th>What is here</th><th>Open</th></tr></thead><tbody>' +
      rows.map(function (r) {
        var ext = r[2].charAt(0) !== "#";
        return "<tr><td>" + esc(r[0]) + '</td><td class="ac-muted">' + esc(r[1]) + '</td><td><a class="ac-link" href="' + esc(r[2]) + '"' + (ext ? ' target="_blank" rel="noopener"' : "") + ">" + esc(r[3]) + " " + icon("arrow") + "</a></td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }

  function viewOverview() {
    var sm = D.summary, nC = sm.companies, held = sm.held_out_companies;
    var allLatest = sm.latest_runs_all_caught === nC;
    var head = allLatest
      ? "Every planted error caught on the latest run of <em>all " + word(nC) + " companies</em>"
      : word(sm.latest_runs_all_caught).replace(/^./, function (s) { return s.toUpperCase(); }) + " of " + word(nC) + " companies have every planted error caught on their latest run. <em>The misses are on the board too.</em>";
    var w = 0;
    var headWords = head.replace(/(<em>|<\/em>)|([^\s<]+)/g, function (m, tag, wd) { return tag ? tag : '<span class="w"><span style="--w:' + (w++) + '">' + wd + "</span></span>"; });
    var injAll = sm.injected_runs.length && sm.injected_runs.every(function (x) { return x.planted_caught === x.planted_total; });
    var rows = "", r0 = 0;
    D.companies.forEach(function (c, i) {
      if (i === 1) rows += '<div class="ac-msplit"><span class="ac-overline-inline">Held out · never tuned on</span></div>';
      var r = latest(c), ok = allCaught(r.metrics);
      rows += '<div class="ac-mrow" data-company="' + c.key + '" tabindex="0" role="button" aria-label="' + esc(c.name) + ", " + score(r.metrics) + ' caught. Open run detail">' + avatar(c) +
        '<span class="ac-mname">' + esc(c.name) + "<small>" + esc(c.industry) + '</small></span><span class="ac-cells" aria-hidden="true">' + cells(r, r0++) + '</span><span class="ac-mscore ' + (ok ? "ac-up" : "ac-down") + '" style="--r:' + (r0 - 1) + '">' + score(r.metrics) + "</span></div>";
    });
    var f = D.featured, fc = company(f.company), fr = fc && runOf(fc, f.run_id), ff = fr && fr.findings.filter(function (x) { return x.id === f.finding_id; })[0];
    var loop = [
      ["plan", "Plan", "LLM", "Reads the files and the competitor list; writes a typed task list."],
      ["act", "Act", "Python", "Runs the next task: exactly one tool call."],
      ["eye", "Observe", "Python", "Stores each result with its source: file, row, page or API request."],
      ["check", "Verify", "Python", "Deterministic checks: totals add up, every number has a source."],
      ["fork", "Decide", "LLM", "On a failed check, picks one recovery from a fixed menu, with a reason."],
      ["shield", "Self-audit", "LLM", "Tries to disprove every finding; a second model checks doubtful ones."],
      ["report", "Report", "Python", "Every number links to its source; overturned claims listed apart."]
    ].map(function (s, i) {
      return '<div class="sr-node' + (s[2] === "LLM" ? " sr-node--llm" : "") + '"><span class="sr-node-dot" style="--n:' + i + '">' + icon(s[0]) + "</span><h4>" + s[1] + '</h4><span class="ac-tag sr-who">' + s[2] + "</span><p>" + s[3] + "</p></div>";
    }).join("");
    var bastion = company(sm.injected_runs.length ? sm.injected_runs[sm.injected_runs.length - 1].company : D.companies[1].key) || D.companies[1];
    return enter(
      '<section class="ac-verdict" data-enter id="verdict"><div class="ac-verdict-grid"><div>' +
        '<span class="ac-overline-inline">Generalisation · latest finished run per company</span>' +
        '<h1 class="ac-hero-xl">' + headWords + "</h1>" +
        '<p class="ac-lede">' + word(held).replace(/^./, function (s) { return s.toUpperCase(); }) + " of them were never used to tune the agent. Acme is the one it was built against; the others were created later, across " + word(sm.industries.length) + " industries. All " + word(nC) + " are fictional. Each square is one error planted in that company's books.</p>" +
        '<div class="ac-figures">' +
          '<div class="ac-figure"><b>' + n(sm.runs_scored) + "</b><span>scored runs behind this page</span></div>" +
          '<div class="ac-figure"><b class="' + (sm.latest_runs_false_alarms === 0 ? "ac-up" : "ac-down") + '">' + n(sm.latest_runs_false_alarms) + "</b><span>false alarms across the latest runs</span></div>" +
          '<div class="ac-figure"><b class="ac-accent">' + n(sm.injected_runs.length) + "</b><span>runs with failures injected" + (injAll ? "; every planted error still caught" : "") + "</span></div>" +
        "</div></div>" +
        '<div class="ac-matrix" aria-label="Planted errors caught, latest run per company">' + rows + "</div>" +
      "</div></section>" +

      '<div class="sr-section-title" data-enter><h2>How one run works</h2><p>The LLM plans, picks recoveries and audits. Python runs every tool, does all the maths and enforces the limits.</p></div>' +
      '<section class="ac-card sr-scroll" data-enter><div class="sr-loop"><span class="sr-pulse" aria-hidden="true"></span>' + loop + "</div>" +
        '<div class="sr-loop-foot"><span><i class="sr-key sr-key--llm"></i>LLM decides</span><span><i class="sr-key"></i>Python decides</span><span>State is saved after every step; a crashed run resumes where it stopped.</span></div></section>' +

      (ff ? '<div class="sr-section-title" data-enter><h2>It argues with itself</h2><p>Before reporting, the agent tries to disprove each finding. This one did not survive.</p></div><div data-enter id="featured">' +
        proofChain(fc, fr, ff, { foot: '<button class="ac-btn ac-btn--ghost" type="button" data-replay-chain>' + icon("play") + "Replay</button>" }) + "</div>" : "") +

      toolsStrip() + judgeChecklist() +
      '<div class="sr-section-title" data-enter><h2>Run history</h2><p>Each column is one scored run. Pick a company to see its runs.</p></div>' +
      '<div class="ac-grid-2 sr-scroll" data-enter style="margin-top:0">' + heroCard(company(S.company) || bastion, latest(company(S.company) || bastion), false) + companyList(S.company) + "</div>"
    );
  }

  function viewRun() {
    var c = company(S.company), r = (S.runId && runOf(c, S.runId)) || latest(c); S.runId = r.run_id;
    var m = r.metrics, idx = c.runs.indexOf(r);
    var switcher = '<div class="sr-switch" role="group" aria-label="Company">' + D.companies.map(function (x) {
      return '<button type="button" class="sr-chip" data-company="' + x.key + '" aria-pressed="' + (x.key === c.key) + '">' + avatar(x) + esc(shortName(x)) + "</button>";
    }).join("") + "</div>";
    var picker = '<div class="sr-runpick"><div class="ac-seg ac-seg--plain" role="group" aria-label="Step through runs">' +
      '<button type="button" data-step="first"' + (idx === 0 ? " disabled" : "") + ">First</button>" +
      '<button type="button" data-step="prev"' + (idx === 0 ? " disabled" : "") + ">Previous</button>" +
      '<button type="button" data-step="next"' + (idx === c.runs.length - 1 ? " disabled" : "") + ">Next</button>" +
      '<button type="button" data-step="latest" aria-pressed="' + (r.run_id === c.latest_run_id) + '">Latest</button></div>' +
      '<label class="ac-label" for="runselect" style="position:absolute;left:-9999px">Run</label><select class="sr-select" id="runselect">' + c.runs.slice().reverse().map(function (x) {
        return '<option value="' + x.run_id + '"' + (x.run_id === r.run_id ? " selected" : "") + ">" + x.run_id + " · " + esc(x.variant) + " · " + score(x.metrics) + (x.phase !== "done" ? " · unfinished" : "") + "</option>";
      }).join("") + "</select></div>";

    var stats = '<div class="ac-stats">' +
      stat("Planted errors caught", score(m), m.false_alarms == null ? "<b>—</b> false alarms not counted on this scorecard" : '<b class="' + (m.false_alarms ? "ac-down" : "ac-up") + '">' + icon(m.false_alarms ? "down" : "up") + n(m.false_alarms) + "</b> false alarms", 0) +
      stat("LLM calls", n(m.llm_calls), "<b>" + n(m.llm_tokens_out) + "</b> tokens out · " + n(m.llm_latency_s) + " s waiting", 1) +
      stat("Recovery decisions", n(m.recovery_decisions), '<b class="ac-accent">' + n(m.recovery_non_default) + "</b> differ from the rule", 2) +
      stat("Findings overturned", n(m.findings_overturned), '<b class="ac-warn">' + n(m.findings_downgraded) + "</b> downgraded · " + n(m.unsupported_numbers_in_report) + " unsupported numbers", 3) +
    "</div>";

    var planted = '<section class="ac-card"><div class="ac-card-head"><h3 class="ac-card-title">Planted errors</h3><span class="ac-card-meta">from the ground-truth file; the agent never sees it</span></div><div class="ac-planted sr-play-cells">' +
      r.planted.map(function (p, i) {
        return '<div class="ac-cell ' + (p.caught ? "ac-cell--caught" : "ac-cell--missed") + '" style="--i:' + i + '"><span class="ac-cell-mark">' + (p.caught ? "✓" : "✗") + "</span><div>" + esc(p.label) + '<span class="ac-cell-state">' + (p.caught ? "Caught" : "Missed") + "</span></div></div>";
      }).join("") + "</div>" +
      (r.false_alarm_detail && r.false_alarm_detail.length ? '<p class="sr-chart-note ac-down">False alarms: ' + esc(r.false_alarm_detail.join("; ")) + "</p>" : "") +
      (c.negative_controls.length ? '<p class="sr-chart-note">Negative control (must not be flagged): ' + esc(c.negative_controls.join(", ")) + "</p>" : "") + "</section>";

    return enter(
      '<div class="ac-pagehead" data-enter><div><h1 class="ac-title">' + esc(c.name) + '</h1><p class="ac-subtitle">' + esc(c.industry) + " · run <span class=\"sr-mono\">" + r.run_id + "</span> · " + esc(r.variant) + " · started " + esc(when(r)) + "</p></div>" + picker + "</div>" +
      '<div data-enter>' + badges(c, r) + switcher + "</div>" +
      '<div data-enter>' + stats + "</div>" +
      '<div class="ac-grid-2" data-enter>' + heroCard(c, r, true) + planted + "</div>" +
      '<div class="sr-section" data-enter>' + replayCard(r) + "</div>" +
      '<div class="sr-section" data-enter>' + findingsCard(c, r) + "</div>" +
      '<div class="sr-section" data-enter>' + recoveryCard(r) + "</div>" +
      '<div class="sr-section" data-enter>' + provenance(r) + "</div>"
    );
  }
  function stat(label, value, delta, i) { return '<div class="ac-card sr-tilt"><div class="ac-stat-label">' + label + '</div><div class="ac-stat-value">' + value + '</div><div class="ac-delta">' + delta + "</div></div>"; }

  function replayCard(r) {
    if (!r.tasks || !r.tasks.length) return '<section class="ac-card"><div class="ac-card-head"><h3 class="ac-card-title">How the agent worked this run</h3></div><p class="sr-empty">The step log for this run was not exported: its run folder is not on the machine that built this page. The scorecard numbers above are complete.</p></section>';
    var byTask = {}; (r.recovery || []).forEach(function (d) { (byTask[d.task_id] = byTask[d.task_id] || []).push(d); });
    var rows = r.tasks.map(function (t) {
      var failed = t.status === "failed", child = !!t.parent;
      var dec = (byTask[t.id] || []).map(function (d) {
        var override = d.chosen !== d.rule_default;
        return '<div class="sr-decision">' +
          '<div class="sr-decision-check">' + esc(d.failed_check || "check failed") + "</div>" +
          '<div class="sr-opts">' + (d.options || [d.chosen]).map(function (o) {
            return '<span class="sr-opt' + (o === d.chosen ? " sr-opt--chosen" + (override ? "" : " is-rule") : "") + '">' + esc(o) + (o === d.rule_default ? " <small>rule</small>" : "") + "</span>";
          }).join("") + "</div>" +
          '<div class="sr-decision-why"><b>' + (override ? '<span class="ac-accent">Override</span> by ' : "Chosen by ") + esc(d.model || "rule") + ":</b> " + esc(d.reason || "—") + "</div></div>";
      }).join("");
      return '<div class="sr-tl-row' + (failed ? " sr-tl-row--failed" : "") + (child ? " sr-tl-row--child" : "") + '"><span class="sr-tl-dot"></span><div>' +
        '<div class="sr-tl-head"><span class="sr-mono sr-muted">' + esc(t.id) + '</span><span class="ac-tag">' + esc(t.tool) + "</span>" + (t.target ? '<span class="sr-tl-target">' + esc(t.target) + "</span>" : "") + (failed ? '<span class="ac-badge ac-badge--down">✗ check failed</span>' : "") + "</div>" +
        '<div class="sr-tl-reason">' + esc(t.reason) + "</div>" + dec + "</div></div>";
    }).join("");
    return '<section class="ac-card"><div class="ac-card-head"><div><h3 class="ac-card-title">How the agent worked this run</h3><span class="ac-card-meta">' + n(r.tasks.length) + " tasks in the order they ran · failed checks open the recovery the agent chose</span></div>" +
      '<button class="ac-btn" type="button" data-replay-run>' + icon("play") + "Replay run</button></div>" +
      (r.plan_rationale ? '<div class="sr-plan"><b>The plan, in the agent\'s words</b>' + esc(r.plan_rationale) + "</div>" : "") +
      '<div class="sr-tl-scroll"><div class="sr-tl" id="timeline"><span class="sr-tl-progress"></span>' + rows + "</div></div></section>";
  }

  function findingsCard(c, r) {
    if (!r.findings.length) return '<section class="ac-card"><div class="ac-card-head"><h3 class="ac-card-title">Findings and audit</h3></div><p class="sr-empty">Findings were not exported for this run.</p></section>';
    var order = { overturned: 0, downgraded: 1, confirmed: 2 };
    var list = r.findings.slice().sort(function (a, b) { return order[a.status] - order[b.status]; }).map(function (f) {
      var notes = (f.audit_notes || []).map(function (raw) {
        var x = parseNote(raw);
        return '<div class="ac-note"><div class="ac-note-who"><span>' + esc(x.who || "deterministic") + (x.second ? " · second opinion" : "") + "</span>" + (x.verdict ? '<span class="' + VERDICT_CLASS[x.verdict] + '">' + esc(x.verdict) + "</span>" : "") + "</div>" + esc(x.text) + "</div>";
      }).join("");
      var pct = Math.round(Math.max(0, Math.min(1, f.confidence)) * 100);
      return '<details class="sr-finding"><summary>' + statusBadge(f.status) + '<span class="sr-finding-text">' + esc(f.statement) + '</span><span class="sr-finding-conf">conf ' + esc(f.confidence) + '<span class="ac-meter"><i style="width:' + pct + '%"></i></span></span></summary>' +
        (notes ? '<div class="ac-notes">' + notes + "</div>" : "") + "</details>";
    }).join("");
    return '<section class="ac-card"><div class="ac-card-head"><h3 class="ac-card-title">Findings and audit</h3><span class="ac-card-meta">open one for the auditors\' notes</span></div><div class="sr-findings">' + list + "</div></section>";
  }

  function recoveryCard(r) {
    var head = '<div class="ac-card-head"><h3 class="ac-card-title">Recovery log</h3><div class="ac-row">' + (r.injected_faults || []).map(function (f) { return '<span class="ac-badge ac-badge--accent">Injected · ' + esc(f) + "</span>"; }).join("") + "</div></div>";
    if (!r.recovery.length) return '<section class="ac-card">' + head + '<p class="sr-empty">' + (r.findings.length ? "No check failed in this run, so no recovery was needed." : "Recovery decisions were not exported for this run.") + "</p></section>";
    return '<section class="ac-card">' + head + '<div class="ac-scroll"><table class="ac-table"><thead><tr><th>Decision</th><th>Task</th><th>Chosen</th><th>Rule default</th><th>Reason</th></tr></thead><tbody>' +
      r.recovery.map(function (d) {
        var o = d.chosen !== d.rule_default;
        return "<tr><td>" + (o ? '<span class="ac-badge ac-badge--accent">Override</span>' : '<span class="ac-badge ac-badge--neutral">Rule</span>') + '</td><td class="ac-code">' + esc(d.task_id) + '</td><td class="ac-code">' + esc(d.chosen) + '</td><td class="ac-code ac-muted">' + esc(d.rule_default) + '</td><td class="sr-wrap">' + esc(d.reason || "—") + "</td></tr>";
      }).join("") + "</tbody></table></div></section>";
  }

  function viewDisproved() {
    var items = [];
    D.companies.forEach(function (c) { c.runs.forEach(function (r) { r.findings.forEach(function (f) { if (f.status !== "confirmed") items.push({ c: c, r: r, f: f }); }); }); });
    items.reverse();
    var shown = items.filter(function (x) { return S.disproved === "all" || x.f.status === S.disproved; });
    var seg = [["overturned", "Overturned"], ["downgraded", "Downgraded"], ["all", "All"]].map(function (s) { return '<button type="button" data-disproved="' + s[0] + '" aria-pressed="' + (S.disproved === s[0]) + '">' + s[1] + "</button>"; }).join("");
    var body = shown.map(function (x) {
      if (x.f.status === "overturned") return proofChain(x.c, x.r, x.f, { overline: shortName(x.c) + " · " + x.r.run_id, lift: true });
      return '<section class="ac-card sr-lift"><div class="ac-card-head"><div><span class="ac-overline-inline">' + esc(shortName(x.c)) + " · run " + x.r.run_id + '</span></div>' + statusBadge(x.f.status) + '</div><p style="margin:0 0 var(--space-4);font-size:15px;line-height:23px">' + esc(x.f.statement) + '</p><div class="ac-notes">' +
        (x.f.audit_notes || []).map(function (raw) { var p = parseNote(raw); return '<div class="ac-note"><div class="ac-note-who"><span>' + esc(p.who || "deterministic") + (p.second ? " · second opinion" : "") + "</span>" + (p.verdict ? '<span class="' + VERDICT_CLASS[p.verdict] + '">' + esc(p.verdict) + "</span>" : "") + "</div>" + esc(p.text) + "</div>"; }).join("") + "</div></section>";
    }).join('<div style="height:var(--space-5)"></div>');
    return enter(
      '<div class="ac-pagehead" data-enter><div><h1 class="ac-title">The agent disproved itself</h1><p class="ac-subtitle">Every finding the self-audit overturned or downgraded, newest first, with the auditors\' own words. The ML/AI verdicts here once varied between runs on identical data; since <a href="' + BLOB + 'evidence/case-studies/05-audit-verdict-variance.md" target="_blank" rel="noopener">case study 05</a> that finding is downgraded the same way every time, because its competitor signals disagree.</p></div><div class="ac-seg" role="group" aria-label="Filter">' + seg + "</div></div>" +
      '<div class="ac-stats" data-enter>' +
        stat("Findings overturned", n(D.summary.findings_overturned), "kept out of the report") +
        stat("Findings downgraded", n(D.summary.findings_downgraded), "kept, with confidence cut") +
        stat("Runs with exported findings", n(D.companies.reduce(function (a, c) { return a + c.runs.filter(function (r) { return r.findings.length; }).length; }, 0)), "of " + n(D.summary.runs_scored) + " scored runs") +
      "</div>" +
      '<div class="sr-section" data-enter>' + (body || '<p class="sr-empty">Nothing here.</p>') + "</div>"
    );
  }

  function viewRecovery() {
    var rows = [];
    D.companies.forEach(function (c) { c.runs.forEach(function (r) { r.recovery.forEach(function (d) { rows.push({ c: c, r: r, d: d }); }); }); });
    rows.reverse();
    var shown = rows.filter(function (x) { return S.recovery === "all" || x.d.chosen !== x.d.rule_default; });
    var seg = [["overrides", "Overrides only"], ["all", "All decisions"]].map(function (s) { return '<button type="button" data-recovery="' + s[0] + '" aria-pressed="' + (S.recovery === s[0]) + '">' + s[1] + "</button>"; }).join("");
    var inj = D.summary.injected_runs.map(function (x) {
      var c = company(x.company);
      return '<button type="button" class="ac-card sr-tilt" data-open-run="' + x.run_id + '" data-company="' + x.company + '"><div class="ac-row">' + avatar(c) + '<div><div class="ac-li-name">' + esc(c.name) + '</div><div class="ac-li-sub sr-mono">' + x.run_id + "</div></div></div>" +
        '<div class="ac-row">' + x.faults.map(function (f) { return '<span class="ac-badge ac-badge--accent">Injected · ' + esc(f) + "</span>"; }).join("") + "</div>" +
        '<div class="ac-stat-value" style="margin:0">' + x.planted_caught + " / " + x.planted_total + '</div><div class="ac-delta" style="margin:0"><b class="' + (x.planted_caught === x.planted_total ? "ac-up" : "ac-down") + '">' + (x.planted_caught === x.planted_total ? "✓ every planted error still caught" : "✗ missed some") + "</b></div></button>";
    }).join("");
    var table = '<div class="ac-scroll"><table class="ac-table"><thead><tr><th>Run</th><th>Failed check</th><th>Options offered</th><th>Chosen by</th><th>Reason</th></tr></thead><tbody>' +
      shown.slice(0, S.recoveryShown).map(function (x) {
        var d = x.d, o = d.chosen !== d.rule_default;
        return '<tr><td><a href="#run" data-open-run="' + x.r.run_id + '" data-company="' + x.c.key + '"><div class="ac-li-name" style="font-size:14px">' + esc(shortName(x.c)) + '</div><div class="ac-code ac-muted">' + x.r.run_id + " · " + esc(d.task_id) + "</div></a></td>" +
          '<td class="sr-check">' + esc(d.failed_check || "—") + "</td>" +
          '<td><div class="sr-opts" style="flex-wrap:nowrap">' + (d.options.length ? d.options : [d.chosen]).map(function (op) { return '<span class="sr-opt' + (op === d.chosen ? " sr-opt--chosen" + (o ? "" : " is-rule") : "") + '">' + esc(op) + (op === d.rule_default ? " <small>rule</small>" : "") + "</span>"; }).join("") + "</div></td>" +
          '<td class="ac-code">' + (o ? '<span class="ac-accent">' + esc(d.model || "—") + "</span>" : esc(d.model || "rule")) + "</td>" +
          '<td class="sr-wrap">' + esc(d.reason || "—") + "</td></tr>";
      }).join("") + "</tbody></table></div>" +
      (shown.length > S.recoveryShown ? '<div class="sr-more"><button class="ac-btn ac-btn--ghost" type="button" data-more>Show 30 more · ' + n(shown.length - S.recoveryShown) + " left</button></div>" : "");
    return enter(
      '<div class="ac-pagehead" data-enter><div><h1 class="ac-title">Recovery log</h1><p class="ac-subtitle">When a check fails, the LLM picks one action from a fixed menu. Python enforces retry caps and budgets. An override is a choice that differs from the rule\'s default.</p></div></div>' +
      '<div class="ac-stats" data-enter>' +
        stat("Recovery decisions", n(D.summary.recovery_decisions), "across runs with exported logs") +
        stat("Overrides of the rule", '<span class="ac-accent">' + n(D.summary.recovery_overrides) + "</span>", "the LLM chose something else") +
        stat("Runs with injected failures", n(D.summary.injected_runs.length), "Crustdata 429 and LLM 429") +
      "</div>" +
      '<div class="sr-section-title" data-enter><h2>Failures injected on purpose</h2><p>Each run below was started with a forced Crustdata 429 and LLM 429. Open one to see what it did next.</p></div>' +
      '<div class="sr-inject" data-enter>' + inj + "</div>" +
      '<div class="sr-section-title" data-enter><h2>Every decision</h2><div class="ac-seg" role="group" aria-label="Filter">' + seg + "</div></div>" +
      '<section class="ac-card" data-enter>' + table + "</section>"
    );
  }

  function viewCompare() {
    var cards = D.comparisons.map(function (cmp) {
      var c = company(cmp.company);
      function side(ids, label) {
        return '<div class="ac-ba-side"><div class="sr-ba-side-label">' + label + '</div><div class="sr-ba-runs">' + ids.map(function (id) {
          var r = runOf(c, id); if (!r) return "";
          var m = r.metrics, ok = allCaught(m);
          var fnd = cmp.finding && (r.findings || []).filter(function (f) { return f.id === cmp.finding; })[0];
          var verdict = fnd ? '<div class="sr-ba-verdict">ML/AI audit verdict: ' + statusBadge(fnd.status) + "</div>" : "";
          return '<a class="sr-ba-run sr-tilt" href="#run" data-open-run="' + id + '" data-company="' + c.key + '"><div><div class="ac-code ac-muted">' + id + " · " + esc(r.variant) + '</div><div class="ac-cells" style="margin-top:6px">' + cells(r, 0) + "</div>" + verdict + '</div><span class="sr-ba-score ' + (ok ? "ac-up" : "ac-down") + '">' + score(m) + '</span><span class="sr-ba-meta">' +
            (m.false_alarms == null ? "false alarms not counted" : n(m.false_alarms) + " false alarms") + " · " + n(m.fallback_hops) + " fallback hops" + (r.phase !== "done" ? " · did not finish" : "") + "</span></a>";
        }).join("") + "</div></div>";
      }
      return '<section class="ac-card" data-enter><div class="ac-card-head"><div class="ac-hero-id">' + avatar(c) + '<div><div class="ac-hero-name">' + esc(cmp.title) + '</div><div class="ac-hero-sub">' + esc(c.name) + " · " + esc(cmp.note) + "</div></div></div>" +
        '<a class="ac-link" href="' + BLOB + esc(cmp.case_study) + '" target="_blank" rel="noopener">Case study ' + icon("arrow") + "</a></div>" +
        '<div class="ac-ba">' + side(cmp.before, "Before") + '<span class="ac-ba-mid">' + icon("arrow") + "</span>" + side(cmp.after, "After") + "</div></section>";
    }).join("");
    return enter('<div class="ac-pagehead" data-enter><div><h1 class="ac-title">Before / after</h1><p class="ac-subtitle">Each bug was found in a neatlogs trace or a scorecard, fixed, and run again. The two sides are shown as they were scored; the page computes no difference.</p></div></div>' +
      '<div class="sr-ba-list">' + cards + "</div>");
  }

  function viewBusiness() {
    var b = D.business.headlines;
    var scen = b.scenarios.map(function (s) {
      return '<section class="ac-card sr-tilt" data-enter><div class="ac-card-head"><h3 class="ac-card-title">' + esc(s.name) + ' scenario</h3><span class="ac-card-meta">24 months</span></div><dl class="sr-dl">' +
        "<dt>First cash-flow-positive month</dt><dd>" + esc(s.first_positive_month) + "</dd>" +
        "<dt>Lowest cash balance</dt><dd>" + esc(s.lowest_cash) + "</dd>" +
        "<dt>Revenue in month 24</dt><dd>" + esc(s.revenue_month_24) + "</dd>" +
        "<dt>Gross margin in month 24</dt><dd>" + esc(s.gross_margin_month_24) + "</dd>" +
        "<dt>Cash in month 24</dt><dd>" + esc(s.cash_month_24) + "</dd></dl></section>";
    }).join("");
    var tiers = '<div class="ac-scroll"><table class="ac-table"><thead><tr><th>Tier</th><th>Price</th><th>Includes</th><th class="ac-r">Margin, half the runs cached</th><th class="ac-r">Margin, nothing cached</th><th class="ac-r">With a 10 fresh-run cap</th></tr></thead><tbody>' +
      b.tiers.map(function (t) { return '<tr><td class="ac-li-name" style="font-size:15px">' + esc(t.name) + "</td><td>" + esc(t.price) + " / month</td><td>" + esc(t.runs) + '</td><td class="ac-r ac-up">' + esc(t.margin_base_50pct_cached) + '</td><td class="ac-r ac-down">' + esc(t.margin_base_uncached) + '</td><td class="ac-r">' + (t.margin_with_cap ? '<span class="ac-up">' + esc(t.margin_with_cap) + "</span>" : '<span class="sr-muted">—</span>') + "</td></tr>"; }).join("") +
      "</tbody></table></div>";
    // The live cfo.ai workspace (read over its MCP, read-only): six scenarios, 24 months of ending cash each.
    var M = D.business.cfoai_model, live = "";
    if (M && M.scenarios) {
      var money = function (v) { return (v < 0 ? "−$" : "$") + Math.round(Math.abs(v)).toLocaleString("en-US"); };
      var COLS = { "Base": "var(--accent)", "Growth": "var(--up)", "Downside": "var(--down)", "Team uncached cap": "#6fb6d6", "Team repriced": "#c9a3e8", "Industry mix": "var(--text-tertiary)" };
      var all = []; M.scenarios.forEach(function (x) { all = all.concat(x.ending_cash); });
      var hi = Math.max.apply(null, all), lo = Math.min(0, Math.min.apply(null, all)), W = 920, H = 260;
      var X = function (i) { return (i / 23) * W; }, Y = function (v) { return H - ((v - lo) / (hi - lo)) * H; };
      var lines = M.scenarios.map(function (x) {
        var d = x.ending_cash.map(function (v, i) { return (i ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); }).join(" ");
        var major = x.name === "Base" || x.name === "Growth" || x.name === "Downside";
        return '<path d="' + d + '" fill="none" stroke="' + (COLS[x.name] || "currentColor") + '" stroke-width="' + (major ? 3 : 1.75) + '" opacity="' + (major ? 1 : 0.75) + '"/>';
      }).join("");
      var chart = '<div class="ac-scroll"><svg viewBox="-60 -10 ' + (W + 80) + " " + (H + 40) + '" style="width:100%;min-width:560px;height:auto;display:block" role="img" aria-label="Ending cash by scenario, 24 months">' +
        '<line x1="0" x2="' + W + '" y1="' + Y(0) + '" y2="' + Y(0) + '" stroke="var(--border-control)" stroke-dasharray="4 4"/>' +
        '<text x="-10" y="' + (Y(0) + 4) + '" text-anchor="end" font-size="12" fill="var(--text-tertiary)">$0</text>' +
        '<text x="-10" y="' + (Y(hi) + 4) + '" text-anchor="end" font-size="12" fill="var(--text-tertiary)">' + money(hi) + "</text>" + lines +
        '<text x="0" y="' + (H + 26) + '" font-size="12" fill="var(--text-tertiary)">' + esc(M.months[0]) + '</text><text x="' + W + '" y="' + (H + 26) + '" text-anchor="end" font-size="12" fill="var(--text-tertiary)">' + esc(M.months[23]) + "</text></svg></div>";
      var rows = M.scenarios.map(function (x) {
        return '<tr><td class="ac-li-name" style="font-size:15px"><span style="display:inline-block;width:12px;height:3px;border-radius:2px;margin-right:8px;vertical-align:middle;background:' + (COLS[x.name] || "currentColor") + '"></span>' + esc(x.name) + "</td>" +
          "<td>" + esc(x.first_cash_flow_positive_month || "not within 24 months") + "</td>" +
          '<td class="ac-r">' + money(x.lowest_ending_cash) + ' <span class="ac-muted">' + esc(x.lowest_ending_cash_month) + "</span></td>" +
          '<td class="ac-r">' + money(x.revenue_month_24) + "</td>" +
          '<td class="ac-r">' + (x.gross_margin_month_24 * 100).toFixed(1) + "%</td>" +
          '<td class="ac-r ' + (x.ending_cash_month_24 < 0 ? "ac-down" : "ac-up") + '">' + money(x.ending_cash_month_24) + "</td></tr>";
      }).join("");
      live = '<section class="ac-card sr-section" data-enter><div class="ac-card-head"><h3 class="ac-card-title">The live cfo.ai model · ' + M.scenarios.length + ' scenarios</h3>' +
        '<span class="ac-card-meta">read over the cfo.ai MCP, read-only · ' + esc(String(M.changelog_entries)) + " model changes · " + esc(String(M.canvas_blocks)) + " canvas blocks</span></div>" + chart +
        '<div class="ac-scroll"><table class="ac-table"><thead><tr><th>Scenario</th><th>First cash-flow-positive month</th><th class="ac-r">Lowest cash</th><th class="ac-r">Revenue, month 24</th><th class="ac-r">Gross margin, month 24</th><th class="ac-r">Cash, month 24</th></tr></thead><tbody>' + rows + "</tbody></table></div>" +
        '<p class="ac-muted" style="margin:10px 0 0">Pages: ' + M.pages.map(esc).join(" · ") + '. Export: <a class="ac-link" href="' + BLOB + esc(M.source) + '" target="_blank" rel="noopener">' + esc(M.source) + "</a></p></section>";
    }
    return enter(
      '<div class="ac-pagehead" data-enter><div><h1 class="ac-title">cfo.ai business plan</h1><p class="ac-subtitle">Built in cfo.ai from measured costs: tokens per run from neatlogs traces at the same models\' published paid prices, plus Crustdata usage at its published prices. Development ran on free tiers.</p></div>' +
        '<a class="ac-btn ac-btn--ghost" href="' + BLOB + esc(b.source) + '" target="_blank" rel="noopener">' + icon("file") + "Full plan</a></div>" +
      '<div class="sr-callout" data-enter>' + esc(b.finding).replace("about 99%", "<b>about 99%</b>").replace("76.6%", "<b>76.6%</b>") + "<small>From " + esc(b.source) + ". Prices are proposals; scenarios are labelled assumptions in the plan.</small></div>" +
      '<div class="ac-stats sr-section" data-enter>' +
        stat("LLM cost per run", esc(b.llm_cost_per_run), "measured, paid-equivalent") +
        stat("Competitor data per uncached run", esc(b.crustdata_cost_per_uncached_run), "Crustdata, published prices") +
      "</div>" +
      '<div class="sr-biz sr-section">' + scen + "</div>" + live +
      '<section class="ac-card sr-section" data-enter><div class="ac-card-head"><h3 class="ac-card-title">Pricing tiers</h3><span class="ac-card-meta">Base scenario, gross margin per customer</span></div>' + tiers + "</section>"
    );
  }

  function trLink(id) { return '<a class="ac-code" href="' + NL_TRACE + esc(id) + '" target="_blank" rel="noopener">' + esc(String(id).slice(0, 12)) + "…</a>" + copyBtn(id, "trace ID"); }
  function docLink(path, label) { return '<a class="ac-link" href="' + BLOB + esc(path) + '" target="_blank" rel="noopener">' + esc(label) + " " + icon("arrow") + "</a>"; }

  function viewTraces() {
    var N = D.neatlogs || {}, t = N.triage || {};
    var rows = [];
    D.companies.forEach(function (c) { c.runs.forEach(function (r) { rows.push({ c: c, r: r }); }); });
    function runTime(r) { var v = Date.parse(r.started_at || r.scored_at); return isNaN(v) ? 0 : v; }
    rows.sort(function (a, b) { return runTime(b.r) - runTime(a.r); });  // newest first; timestamps come in mixed formats
    var evals = (N.eval_traces || []).slice().reverse();
    return enter(
      '<div class="ac-pagehead" data-enter><div><h1 class="ac-title">neatlogs</h1><p class="ac-subtitle">The debugger, the eval board and the alarm system. Every run is one trace: each LLM call (with its versioned prompt template), tool call, retry, recovery decision, fallback hop and audit verdict is a span with its input and output.</p></div>' +
        '<div class="ac-row">' + docLink(N.docs && N.docs.coverage || "evidence/neatlogs/coverage.md", "Feature coverage") + "</div></div>" +
      '<div class="ac-stats sr-section" data-enter>' +
        stat("Traced runs", n(rows.length), "one trace per run, tagged sha / run / variant") +
        stat("Detections", n((N.detections || []).length), "group \u201cSpend Radar\u201d, created over the MCP") +
        stat("Eval traces", n(evals.length), "scorecards published as spendradar_eval") +
        stat("Prompt templates", n((N.prompts || []).length), "versioned on every LLM span") +
      "</div>" +
      (t.id ? '<section class="ac-card sr-section" data-enter><div class="ac-card-head"><h3 class="ac-card-title">A bug neatlogs found on its own</h3><span class="ac-badge ac-badge--up">' + esc(t.status) + '</span></div>' +
        '<dl class="sr-dl"><dt>Fix</dt><dd>' + esc(t.title) + "</dd><dt>Found by</dt><dd>" + esc(t.found_by) + "</dd>" +
        "<dt>Before</dt><dd>" + trLink(t.before_trace) + " · Gemini 400 on a corrupt PDF sent to the LLM reader</dd>" +
        "<dt>Fix commit</dt><dd class=\"ac-code\">" + esc(t.fix_commit) + "</dd><dt>After</dt><dd>" + trLink(t.after_trace) + " · " + esc(t.result) + "</dd></dl>" +
        '<p class="ac-muted" style="margin:10px 0 0">Investigated and closed over the neatlogs MCP. The <a href="#entire">Entire</a> page follows this fix back to the coding-agent prompt that produced it.</p></section>' : "") +
      '<section class="ac-card sr-section" data-enter><div class="ac-card-head"><h3 class="ac-card-title">Detections</h3>' + docLink(N.docs && N.docs.evals || "", "How they were built") + '</div><div class="ac-scroll"><table class="ac-table"><thead><tr><th>Detection</th><th>Runs on</th><th>Why</th></tr></thead><tbody>' +
        (N.detections || []).map(function (d) { return "<tr><td>" + esc(d.name) + '</td><td class="ac-code ac-muted">' + esc(d.on) + "</td><td>" + esc(d.why) + "</td></tr>"; }).join("") + "</tbody></table></div></section>" +
      '<section class="ac-card sr-section" data-enter><div class="ac-card-head"><h3 class="ac-card-title">Evals inside neatlogs</h3><span class="ac-card-meta">one eval:run span per run, PASS/FAIL, linked to the run\u2019s trace</span></div><div class="ac-scroll"><table class="ac-table"><thead><tr><th>Eval trace</th><th>Variant</th><th class="ac-r">Runs passed</th><th style="padding-left:28px">Scorecard</th></tr></thead><tbody>' +
        evals.map(function (e) { var ok = e.passed === e.runs; return "<tr><td>" + trLink(e.trace_id) + '</td><td class="ac-code ac-muted">' + esc(e.variant) + '</td><td class="ac-r ' + (ok ? "ac-up" : "ac-down") + '">' + e.passed + " / " + e.runs + '</td><td class="ac-code" style="padding-left:28px"><a href="' + BLOB + esc(e.scorecard) + '" target="_blank" rel="noopener">' + esc(e.scorecard.split("/").pop()) + "</a></td></tr>"; }).join("") +
        '</tbody></table></div><p class="ac-muted" style="margin:10px 0 0">PASS = every planted error caught, no unsupported numbers, run finished. <span class="ac-code">history-all-acme-runs</span> and <span class="ac-code">before-fix-misses</span> re-score early runs, including runs killed on purpose and runs from before a fix, so their misses are real and expected.</p></section>' +
      '<section class="ac-card sr-section" data-enter><div class="ac-card-head"><h3 class="ac-card-title">Every scored run</h3><span class="ac-card-meta">trace IDs open in the neatlogs dashboard (project members)</span></div><div class="ac-scroll"><table class="ac-table"><thead><tr><th>Company</th><th>Run</th><th>Variant</th><th>Score</th><th>Mode</th><th>neatlogs trace</th><th>Code</th></tr></thead><tbody>' +
      rows.map(function (x) {
        var r = x.r, ok = allCaught(r.metrics);
        var code = r.code && r.code.checkpoint ? '<a class="ac-code" href="' + esc(r.code.entire_url) + '" target="_blank" rel="noopener" title="Entire checkpoint ' + esc(r.code.checkpoint) + '">' + esc(r.git_sha) + "</a>" : '<span class="ac-code">' + esc(r.git_sha) + "</span>";
        return '<tr><td><span class="ac-cellid">' + avatar(x.c, "ac-avatar--sm") + esc(shortName(x.c)) + '</span></td><td class="ac-code"><a href="#run" data-open-run="' + r.run_id + '" data-company="' + x.c.key + '">' + r.run_id + '</a></td><td class="ac-code ac-muted">' + esc(r.variant) + '</td><td class="' + (ok ? "ac-up" : "ac-down") + '">' + score(r.metrics) + (r.phase !== "done" ? ' <span class="ac-badge ac-badge--down">unfinished</span>' : "") + "</td><td>" + (r.data_mode === "fixture" ? '<span class="ac-badge ac-badge--warn">Fixture</span>' : '<span class="ac-badge ac-badge--neutral">Real</span>') + (r.injected_faults.length ? ' <span class="ac-badge ac-badge--accent">Injected</span>' : "") +
          '</td><td><span class="ac-row" style="flex-wrap:nowrap">' + trLink(r.neatlogs_trace_id) + "</span></td><td>" + code + "</td></tr>";
      }).join("") + "</tbody></table></div></section>"
    );
  }

  function viewEntire() {
    var E = D.entire || {};
    var trails = (E.trails || []).map(function (t) {
      var fs = (t.findings || []).map(function (f) {
        return '<li class="sr-finding"><span class="ac-badge ' + (f.severity === "medium" ? "ac-badge--warn" : "ac-badge--neutral") + '">' + esc(f.severity) + '</span> <span class="ac-badge ac-badge--up">' + esc(f.status) + "</span> " + esc(f.summary) + ' <span class="ac-code ac-muted">fix ' + esc(f.fix) + "</span></li>";
      }).join("");
      return '<section class="ac-card sr-tilt" data-enter><div class="ac-card-head"><h3 class="ac-card-title">Trail #' + t.number + " · " + esc(t.title) + '</h3><a class="ac-link" href="' + esc(E.repo) + "/trails/" + t.number + '" target="_blank" rel="noopener">Open trail ' + icon("arrow") + "</a></div>" +
        '<p class="ac-muted" style="margin:0 0 8px"><span class="ac-code">' + esc(t.branch) + "</span> · runners: " + esc(t.runner_result) + "</p>" +
        (fs ? '<ul class="sr-findings">' + fs + "</ul>" : '<p class="sr-empty" style="margin:0">No findings.</p>') + "</section>";
    }).join("");
    var caught = (E.trails || []).reduce(function (a, t) { return a + (t.findings || []).length; }, 0);
    var dossiers = (E.explain || []).map(function (d) {
      var spans = (d.spans || []).filter(function (s) { return s.commit_checkpoint; }).slice(0, 3).map(function (s) {
        var cp = /checkpoint \[`([^`]+)`\]\(([^)]+)\)/.exec(s.commit_checkpoint || "");
        var commit = /Commit `([^`]+)`/.exec(s.commit_checkpoint || "");
        return '<ol class="sr-chain">' +
          "<li><b>neatlogs span</b> <span class=\"ac-code\">" + esc(s.span) + "</span> " + ('<span class="ac-badge ' + (s.status === "ERROR" ? "ac-badge--down" : "ac-badge--neutral") + '">' + esc(s.status) + "</span>") + (s.via ? ' <span class="ac-muted">inside ' + esc(s.via) + "</span>" : "") + "</li>" +
          "<li><b>Code</b> " + esc((s.code || "").replace(/`/g, "")) + "</li>" +
          "<li><b>Written by</b> " + esc((s.written_by || "").replace(/`/g, "")) + "</li>" +
          "<li><b>Commit · checkpoint</b> <span class=\"ac-code\">" + esc(commit ? commit[1] : "") + "</span> · " + (cp ? '<a class="ac-code" href="' + esc(cp[2]) + '" target="_blank" rel="noopener">' + esc(cp[1]) + "</a>" : "") + "</li>" +
          "<li><b>Prompt</b> <span class=\"ac-muted\">" + esc((s.prompt || "").slice(0, 160)) + "</span></li></ol>";
      }).join("");
      return '<section class="ac-card sr-section" data-enter><div class="ac-card-head"><h3 class="ac-card-title">spendradar explain ' + esc(d.trace_id.slice(0, 12)) + "…</h3>" + docLink(d.file, "Full dossier") + "</div>" + spans + "</section>";
    }).join("");
    return enter(
      '<div class="ac-pagehead" data-enter><div><h1 class="ac-title">Entire</h1><p class="ac-subtitle">Spend Radar cites a source for every number. Entire extends that to the agent\u2019s own code: every run records its commit and Entire checkpoint, every change since 11 Oct went through a trail reviewed by repo-tailored runners, and <span class="ac-code">spendradar explain</span> follows a neatlogs span back to the coding-agent session and prompt that wrote the line.</p></div>' +
        '<a class="ac-btn ac-btn--ghost" href="' + esc(E.repo) + '" target="_blank" rel="noopener">' + icon("branch") + "Repo on Entire</a></div>" +
      '<div class="ac-stats sr-section" data-enter>' +
        stat("Checkpoints", n(E.checkpoints), "commits linked to the agent session behind them") +
        stat("Trails", n((E.trails || []).length), "one per change, each reviewed by runners") +
        stat("Issues runners caught", n(caught), "both fixed before merge") +
        stat("Runners", n((E.runners || []).length), esc((E.runners || []).join(", "))) +
      "</div>" +
      '<div class="sr-callout" data-enter>Closed loop on the corrupt-PDF bug: neatlogs auto-triage flagged a Gemini 400 \u2192 <span class="ac-code">read_pdf</span> \u2192 the guard at <span class="ac-code">files.py:139</span> \u2192 Entire checkpoint <span class="ac-code">01M4K4TJ\u2026</span>, whose prompt <b>is the neatlogs triage task</b>.<small>From <span class="ac-code">spendradar explain</span>; dossiers below.</small></div>' +
      '<div class="sr-biz sr-section">' + trails + "</div>" + dossiers
    );
  }

  var RENDER = { overview: viewOverview, run: viewRun, disproved: viewDisproved, recovery: viewRecovery, compare: viewCompare, business: viewBusiness, traces: viewTraces, entire: viewEntire };

  // ── render + routing ─────────────────────────────────────────────
  function render(opts) {
    opts = opts || {};
    var v = S.view;
    document.querySelectorAll("[data-view]").forEach(function (a) { if (a.getAttribute("data-view") === v) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
    var label = VIEWS.filter(function (x) { return x.id === v; })[0].label;
    var crumbs = '<span>Spend Radar</span>' + icon("chevron");
    if (v === "run") { var c = company(S.company); crumbs += "<span>" + esc(shortName(c)) + "</span>" + icon("chevron") + "<b>" + esc(S.runId || c.latest_run_id) + "</b>"; }
    else crumbs += "<b>" + label + "</b>";
    document.getElementById("crumbs").innerHTML = crumbs;
    var pill = document.getElementById("modepill");
    var r = v === "run" ? ((S.runId && runOf(company(S.company), S.runId)) || latest(company(S.company))) : null;
    if (r && r.data_mode === "fixture") { pill.className = "ac-pill ac-pill--fixture"; pill.textContent = "Fixture data"; } else { pill.className = "ac-pill"; pill.textContent = "Real data"; }
    document.title = (v === "overview" ? "Spend Radar" : label + " · Spend Radar");

    var swap = function () {
      main.innerHTML = '<div class="sr-enter' + (opts.play ? " sr-play" : "") + '">' + RENDER[v]() + "</div>";
      var chain = main.querySelector("#featured .ac-card");
      if (chain && opts.play) chain.classList.add("sr-chain-play");
      if (!opts.keepScroll) window.scrollTo(0, 0);
      FX.after(main, v, opts);
    };
    if (opts.transition && document.startViewTransition && FX.on()) document.startViewTransition(swap); else swap();
  }

  function go(view, opts) {
    if (!RENDER[view]) view = "overview";
    S.view = view;
    if (location.hash.slice(1) !== view) history.replaceState(null, "", "#" + view);
    render(Object.assign({ transition: true }, opts || {}));
  }
  function openRun(key, runId) {
    S.company = key; S.runId = runId || null; store("company", key);
    go("run");
  }

  window.addEventListener("hashchange", function () { var v = location.hash.slice(1); if (v !== S.view) go(v); });

  // ── events ───────────────────────────────────────────────────────
  document.addEventListener("click", function (e) {
    var t = e.target.closest("button, a, [role=button], g.col");
    if (!t) return;
    FX.setOrigin(e.clientX, e.clientY);
    if (t.id === "motion") { var onNow = !FX.on(); FX.setMotion(onNow); t.setAttribute("aria-pressed", String(onNow)); toast(onNow ? "Motion on" : "Motion off"); return; }
    if (t.matches("[data-copy]")) {
      var v = t.getAttribute("data-copy");
      var done = function () { toast("Copied " + v.slice(0, 32)); };
      try { navigator.clipboard.writeText(v).then(done, function () { toast(v); }); } catch (err) { toast(v); }
      return;
    }
    if (t.matches("[data-view]")) { e.preventDefault(); go(t.getAttribute("data-view")); return; }
    if (t.matches("[data-open-run]")) { e.preventDefault(); openRun(t.getAttribute("data-company"), t.getAttribute("data-open-run")); return; }
    if (t.matches(".ac-mrow, .sr-company")) { var k = t.getAttribute("data-company"); if (S.view === "overview" && t.matches(".sr-company")) { S.company = k; store("company", k); render({ keepScroll: true }); } else openRun(k); return; }
    if (t.matches(".sr-chip[data-company]")) { openRun(t.getAttribute("data-company")); return; }
    if (t.matches("[data-metric]")) { S.metric = t.getAttribute("data-metric"); var c = company(S.company), r = S.view === "run" ? runOf(c, S.runId) : latest(c);
      t.parentNode.querySelectorAll("button").forEach(function (b) { b.setAttribute("aria-pressed", String(b === t)); });
      document.getElementById("chart").innerHTML = chart(c, S.metric, r.run_id, S.view === "run"); return; }
    if (t.matches("g.col") && S.view === "run") { S.runId = t.getAttribute("data-run"); render({ transition: true, keepScroll: true }); return; }
    if (t.matches("[data-step]")) { var cc = company(S.company), i = cc.runs.findIndex(function (x) { return x.run_id === S.runId; }), s = t.getAttribute("data-step");
      var j = s === "first" ? 0 : s === "prev" ? i - 1 : s === "next" ? i + 1 : cc.runs.indexOf(latest(cc));
      S.runId = cc.runs[Math.max(0, Math.min(cc.runs.length - 1, j))].run_id; render({ transition: true, keepScroll: true }); return; }
    if (t.matches("[data-disproved]")) { S.disproved = t.getAttribute("data-disproved"); render({ keepScroll: true }); return; }
    if (t.matches("[data-recovery]")) { S.recovery = t.getAttribute("data-recovery"); S.recoveryShown = 30; render({ keepScroll: true }); return; }
    if (t.matches("[data-more]")) { S.recoveryShown += 30; render({ keepScroll: true }); return; }
    if (t.matches("[data-replay-chain]")) { var ch = main.querySelector("#featured .ac-card"); ch.classList.remove("sr-chain-play"); void ch.offsetWidth; ch.classList.add("sr-chain-play"); return; }
    if (t.matches("[data-replay-run]")) { replayRun(t); return; }
  });
  document.addEventListener("keydown", function (e) {
    if ((e.key === "Enter" || e.key === " ") && e.target.matches("[role=button]")) { e.preventDefault(); e.target.click(); }
  });
  document.addEventListener("change", function (e) { if (e.target.id === "runselect") { S.runId = e.target.value; render({ transition: true, keepScroll: true }); } });

  // The verdict's dot grid follows the pointer.
  document.addEventListener("pointermove", function (e) {
    var v = e.target.closest && e.target.closest(".ac-verdict"); if (!v) return;
    var b = v.getBoundingClientRect(); v.style.setProperty("--mx", (e.clientX - b.left) + "px"); v.style.setProperty("--my", (e.clientY - b.top) + "px");
  });

  // Replay: light each task in order; failed checks pause a beat so their recovery can be read.
  var replayTimer = null;
  function replayRun(btn) {
    var tl = document.getElementById("timeline"); if (!tl) return;
    var rows = Array.prototype.slice.call(tl.querySelectorAll(".sr-tl-row")), bar = tl.querySelector(".sr-tl-progress"), scroller = tl.parentNode;
    clearTimeout(replayTimer);
    rows.forEach(function (r) { r.classList.remove("is-lit"); });
    if (!FX.on()) { rows.forEach(function (r) { r.classList.add("is-lit"); }); return; }
    tl.classList.add("is-replaying"); btn.setAttribute("data-state", "loading"); scroller.scrollTop = 0;
    var i = 0;
    (function step() {
      if (i >= rows.length) { tl.classList.remove("is-replaying"); btn.removeAttribute("data-state"); bar.style.height = "0"; return; }
      var row = rows[i++]; row.classList.add("is-lit");
      bar.style.height = (row.offsetTop + 14) + "px";
      var top = row.offsetTop - scroller.clientHeight / 2; if (top > scroller.scrollTop) scroller.scrollTo({ top: top, behavior: "smooth" });
      replayTimer = setTimeout(step, row.querySelector(".sr-decision") ? 1100 : 160);
    })();
  }

  // ── boot ─────────────────────────────────────────────────────────
  var first = location.hash.slice(1);
  S.view = RENDER[first] ? first : "overview";
  FX.intro(D, function () { render({ play: true }); });
})();
