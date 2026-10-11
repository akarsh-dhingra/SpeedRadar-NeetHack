/* Spend Radar demo film — a deterministic canvas renderer.
 * window.__render(t) draws the frame at time t (seconds). Everything is a pure function of t and the
 * narration timeline (build/timeline.json), so frames can be rendered in any order, on any machine.
 * Style: papery watercolour, boiling ink lines (12 fps), comic sound words, captions that follow the voice.
 * Numbers on screen are copied from the repo's evidence (see script.json `src`). */
(function () {
  "use strict";
  var W = 1920, H = 1080, BOIL = 12;
  var TL = window.__TL, CLIPS = window.__CLIPS || {};
  var cv = document.getElementById("c"), X = cv.getContext("2d");
  var PI = Math.PI, TAU = PI * 2;

  // ── palette ────────────────────────────────────────────────────────────────
  var C = {
    ink: "#2a2433", cream: "#f7efe1", paper: "#efe4cf", navy: "#2c3260", navy2: "#3b4380", teal: "#2f7c78",
    teal2: "#4f9f97", pink: "#f3c3bd", rose: "#e98b8f", red: "#e1574f", mint: "#7fd3a6", mintD: "#3f9d73",
    indigo: "#8f8df0", indigoD: "#5a57c0", yellow: "#ffd166", orange: "#f28c38", sky: "#bfe3ec", lilac: "#cdbff0",
    green: "#5cbf72", skin: "#f1c8a2", white: "#fffaf0", dim: "rgba(247,239,225,.42)", shadow: "rgba(42,36,51,.18)"
  };

  // ── math & noise ─────────────────────────────────────────────────────────────
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, k) { return a + (b - a) * k; }
  function prog(t, a, d) { return clamp((t - a) / d, 0, 1); }
  function eOut(k) { return 1 - Math.pow(1 - k, 3); }
  function eInOut(k) { return k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }
  function eBack(k) { var c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }
  function eElastic(k) { return k === 0 ? 0 : k === 1 ? 1 : Math.pow(2, -10 * k) * Math.sin((k * 10 - .75) * (TAU / 3)) + 1; }
  function hash(n) { var x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
  function hash2(a, b) { return hash(a * 12.9898 + b * 78.233); }
  var T = 0, BF = 0; // current time, current boil frame
  function jit(x, y, amp) { amp = amp == null ? 1.6 : amp; return [x + (hash2(x * .37 + BF * 7.1, y * .11) - .5) * 2 * amp, y + (hash2(y * .29 - BF * 3.3, x * .17) - .5) * 2 * amp]; }

  // ── paper ──────────────────────────────────────────────────────────────────
  var grain = (function () {
    var g = document.createElement("canvas"); g.width = 512; g.height = 512;
    var gx = g.getContext("2d"), im = gx.createImageData(512, 512);
    for (var i = 0; i < im.data.length; i += 4) {
      var v = hash(i * .013) * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 26;
    }
    gx.putImageData(im, 0, 0);
    for (var f = 0; f < 140; f++) { // paper fibres
      gx.strokeStyle = "rgba(90,70,50," + (0.05 + hash(f) * .05) + ")"; gx.lineWidth = .7; gx.beginPath();
      var x0 = hash(f * 3.1) * 512, y0 = hash(f * 7.7) * 512; gx.moveTo(x0, y0);
      gx.quadraticCurveTo(x0 + (hash(f * 2) - .5) * 60, y0 + (hash(f * 5) - .5) * 60, x0 + (hash(f * 9) - .5) * 90, y0 + (hash(f * 4) - .5) * 90); gx.stroke();
    }
    return g;
  })();
  var paperCache = {};
  function paper(key, base, blots, seed) {
    if (paperCache[key]) return paperCache[key];
    var p = document.createElement("canvas"); p.width = W; p.height = H; var g = p.getContext("2d");
    g.fillStyle = base; g.fillRect(0, 0, W, H);
    for (var i = 0; i < 70; i++) {
      var col = blots[i % blots.length], x = hash(seed + i * 1.7) * W, y = hash(seed + i * 3.1) * H, r = 140 + hash(seed + i * 5.3) * 520;
      var gr = g.createRadialGradient(x, y, r * .1, x, y, r);
      var a = .05 + hash(seed + i * 9.1) * .09;
      gr.addColorStop(0, hexa(col, a)); gr.addColorStop(.75, hexa(col, a * .7)); gr.addColorStop(1, hexa(col, 0));
      g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
    for (var j = 0; j < 22; j++) { // watercolour bloom edges
      var bx = hash(seed + j * 11.3) * W, by = hash(seed + j * 13.7) * H, br = 80 + hash(seed + j * 17.1) * 260;
      g.strokeStyle = hexa(blots[j % blots.length], .08); g.lineWidth = 3 + hash(j) * 5; g.beginPath();
      for (var k = 0; k <= 40; k++) { var an = k / 40 * TAU, rr = br * (1 + (hash(seed + j + k * .3) - .5) * .25); g.lineTo(bx + Math.cos(an) * rr, by + Math.sin(an) * rr); }
      g.stroke();
    }
    g.globalCompositeOperation = "multiply"; g.fillStyle = g.createPattern(grain, "repeat"); g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    var vg = g.createRadialGradient(W / 2, H / 2, H * .45, W / 2, H / 2, H * 1.05);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(30,20,40,.32)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return (paperCache[key] = p);
  }
  function hexa(hex, a) { var n = parseInt(hex.slice(1), 16); return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")"; }

  // ── ink drawing helpers ────────────────────────────────────────────────────
  function inkPath(g, pts, close, fill, stroke, lw) {
    g.beginPath();
    pts.forEach(function (p, i) { var q = jit(p[0], p[1]); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
    if (close) g.closePath();
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke !== false) { g.strokeStyle = stroke || C.ink; g.lineWidth = lw || 5; g.lineJoin = "round"; g.lineCap = "round"; g.stroke(); }
  }
  function rrPts(x, y, w, h, r, n) {
    n = n || 6; var pts = [];
    function arc(cx, cy, a0) { for (var i = 0; i <= n; i++) { var a = a0 + i / n * PI / 2; pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]); } }
    function edge(x0, y0, x1, y1) { var steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 40)); for (var i = 1; i < steps; i++) pts.push([lerp(x0, x1, i / steps), lerp(y0, y1, i / steps)]); }
    arc(x + w - r, y + r, -PI / 2); edge(x + w, y + r, x + w, y + h - r);
    arc(x + w - r, y + h - r, 0); edge(x + w - r, y + h, x + r, y + h);
    arc(x + r, y + h - r, PI / 2); edge(x, y + h - r, x, y + r);
    arc(x + r, y + r, PI); edge(x + r, y, x + w - r, y);
    return pts;
  }
  function inkRR(g, x, y, w, h, r, fill, lw, stroke) { inkPath(g, rrPts(x, y, w, h, r), true, fill, stroke, lw); }
  function circPts(cx, cy, rx, ry, n) { var p = []; n = n || 28; for (var i = 0; i < n; i++) { var a = i / n * TAU; p.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * (ry || rx)]); } return p; }
  function inkCircle(g, cx, cy, r, fill, lw, ry, stroke) { inkPath(g, circPts(cx, cy, r, ry), true, fill, stroke, lw); }
  function inkLine(g, x0, y0, x1, y1, lw, col) { var pts = []; for (var i = 0; i <= 6; i++) pts.push([lerp(x0, x1, i / 6), lerp(y0, y1, i / 6)]); inkPath(g, pts, false, null, col, lw); }
  function wash(g, x, y, w, h, col, a) { // soft watercolour shading inside a shape region
    var gr = g.createLinearGradient(x, y, x, y + h); gr.addColorStop(0, hexa(col, 0)); gr.addColorStop(1, hexa(col, a || .25));
    g.fillStyle = gr; g.fillRect(x, y, w, h);
  }

  // ── text ───────────────────────────────────────────────────────────────────
  var FONT = "'Fredoka', 'Baloo 2', system-ui, sans-serif", COMIC = "'Bangers', 'Fredoka', sans-serif", MONO = "'Geist Mono', ui-monospace, monospace";
  function txt(g, s, x, y, size, opts) {
    opts = opts || {};
    g.save(); g.translate(x, y); if (opts.rot) g.rotate(opts.rot); if (opts.scale) g.scale(opts.scale, opts.scale);
    g.font = (opts.weight || 700) + " " + size + "px " + (opts.font || FONT);
    g.textAlign = opts.align || "left"; g.textBaseline = opts.base || "alphabetic";
    if (opts.ls) g.letterSpacing = opts.ls + "px";
    if (opts.stroke !== false && opts.stroke !== undefined) { g.lineJoin = "round"; g.strokeStyle = opts.stroke; g.lineWidth = opts.sw || size * .16; g.strokeText(s, 0, 0); }
    if (opts.shadow) { g.fillStyle = opts.shadow; g.fillText(s, opts.sx || 5, opts.sy || 6); }
    g.fillStyle = opts.fill || C.ink; g.fillText(s, 0, 0);
    g.restore();
  }
  function measure(s, size, font, weight) { X.font = (weight || 700) + " " + size + "px " + (font || FONT); return X.measureText(s).width; }

  // comic sound word: pops in with overshoot and a little shake
  function sfxWord(g, s, x, y, t0, size, col, rot) {
    var k = (T - t0) / .5; if (k < 0 || k > 2.4) return;
    var sc = k < 1 ? eBack(clamp(k, 0, 1)) : 1, fade = k > 1.9 ? 1 - (k - 1.9) / .5 : 1;
    var sh = k < .6 ? (hash(BF * 3.7) - .5) * 10 : 0;
    g.save(); g.globalAlpha = clamp(fade, 0, 1);
    txt(g, s, x + sh, y + sh * .6, size, { font: COMIC, weight: 400, fill: col || C.orange, stroke: C.ink, sw: size * .14, align: "center", rot: rot || -0.08, scale: sc, shadow: C.ink, sx: 7, sy: 9, ls: 2 });
    g.restore();
  }

  // ── timeline lookups ───────────────────────────────────────────────────────
  var LINES = {}; TL.lines.forEach(function (l) { l.end = l.start + l.dur; LINES[l.id] = l; });
  function L(id) { return LINES[id]; }
  function envAt(t) { var i = Math.floor(t * TL.fps); return TL.env[i] || 0; }
  function spokenFrac(line, t) {
    var r = t - line.start, p = line.progress;
    if (r <= 0) return 0; if (r >= line.dur) return 1;
    for (var i = 1; i < p.length; i++) if (r <= p[i][0]) { var a = p[i - 1], b = p[i]; return lerp(a[1], b[1], (r - a[0]) / Math.max(1e-3, b[0] - a[0])); }
    return 1;
  }
  function lineAt(t) { for (var i = 0; i < TL.lines.length; i++) { var l = TL.lines[i]; if (t >= l.start - .05 && t < l.end + .35) return l; } return null; }
  var beat = 60 / TL.bpm;
  function kickEnv(t) { var ph = (t % beat) / beat; return Math.exp(-ph * 7); }

  // ── characters ─────────────────────────────────────────────────────────────
  // Radar: the narrator. mouth follows the voice envelope; expr: happy | wow | squint | proud
  function radar(g, x, y, s, o) {
    o = o || {}; var talk = o.talk !== false ? envAt(T) : 0;
    var bob = Math.sin(T * 3.2 + (o.phase || 0)) * 4 + (o.bounce ? -kickEnv(T) * 10 : 0);
    g.save(); g.translate(x, y + bob); g.scale(s, s); if (o.rot) g.rotate(o.rot);
    // shadow
    g.fillStyle = C.shadow; g.beginPath(); g.ellipse(0, 128 - bob / s, 120, 18, 0, 0, TAU); g.fill();
    // legs
    [-60, -12, 36].forEach(function (lx, i) { inkRR(g, lx, 82, 24, 40 + (o.walk ? Math.sin(T * 12 + i) * 6 : 0), 6, C.mintD, 5); });
    // dish antenna
    var da = o.dish != null ? o.dish : Math.sin(T * 1.7) * .5;
    g.save(); g.translate(18, -96); g.rotate(da);
    inkLine(g, 0, 0, 0, -46, 6);
    g.save(); g.translate(0, -50); g.rotate(-.5);
    inkPath(g, [[-40, 0], [-28, 16], [0, 24], [28, 16], [40, 0], [0, 6]], true, C.cream, null, 5);
    inkLine(g, 0, 12, 0, -20, 4); inkCircle(g, 0, -24, 6, C.red, 4);
    g.restore();
    if (o.ping != null) { // rings out of the dish
      for (var r = 0; r < 3; r++) { var k = ((T - o.ping) * 1.6 - r * .25); if (k > 0 && k < 1) { g.strokeStyle = hexa(C.yellow, 1 - k); g.lineWidth = 6; g.beginPath(); g.arc(0, -74, 30 + k * 260, -2.4, -.7); g.stroke(); } }
    }
    g.restore();
    // body
    inkRR(g, -110, -100, 220, 200, 46, C.mint, 6);
    g.save(); g.beginPath(); g.rect(-110, -100, 220, 200); g.clip(); wash(g, -110, -10, 220, 110, C.mintD, .35); g.restore();
    // arms
    var wave = o.wave ? Math.sin(T * 9) * .6 : 0;
    g.save(); g.translate(-108, 10); g.rotate(-.5 + (o.armL || 0)); inkLine(g, 0, 0, -48, 26, 7); inkCircle(g, -52, 28, 13, C.mint, 5); g.restore();
    g.save(); g.translate(108, 10); g.rotate(.5 - wave + (o.armR || 0)); inkLine(g, 0, 0, 48, 26, 7); inkCircle(g, 52, 28, 13, C.mint, 5);
    if (o.hold) o.hold(g); g.restore();
    // face
    var blink = (T * 1.0 + (o.phase || 0)) % 3.3 < .12;
    var ex = o.expr || "happy";
    function eye(cx) {
      if (blink || ex === "proud") { inkPath(g, [[cx - 14, -22], [cx, -32], [cx + 14, -22]], false, null, null, 6); return; }
      if (ex === "squint") { inkLine(g, cx - 14, -24, cx + 14, -26, 7); return; }
      var r = ex === "wow" ? 17 : 13; inkCircle(g, cx, -24, r, C.ink, 3, r * 1.15); g.fillStyle = C.white; g.beginPath(); g.arc(cx + 4, -30, 4.5, 0, TAU); g.fill();
    }
    eye(-40); eye(40);
    g.fillStyle = hexa(C.rose, .7); g.beginPath(); g.ellipse(-70, 6, 16, 10, 0, 0, TAU); g.ellipse(70, 6, 16, 10, 0, 0, TAU); g.fill();
    var mo = ex === "wow" ? Math.max(.7, talk) : talk;
    if (mo > .05) {
      var mh = 6 + 34 * mo, mw = 24 + 14 * mo;
      inkCircle(g, 0, 18, mw, "#7a2e3a", 4.5, mh / 2 + 4);
      g.fillStyle = C.rose; g.beginPath(); g.ellipse(0, 18 + mh / 4, mw * .55, mh * .22, 0, 0, TAU); g.fill();
    } else {
      inkPath(g, [[-22, 12], [-10, 24], [10, 24], [22, 12]], false, null, null, 6);
    }
    g.restore();
  }

  // Fin: the finance lead
  function fin(g, x, y, s, o) {
    o = o || {}; g.save(); g.translate(x, y + Math.sin(T * 2.4) * 3); g.scale(s, s);
    g.fillStyle = C.shadow; g.beginPath(); g.ellipse(0, 150, 70, 12, 0, 0, TAU); g.fill();
    inkRR(g, -26, 90, 20, 60, 6, C.navy, 5); inkRR(g, 6, 90, 20, 60, 6, C.navy, 5);
    inkRR(g, -55, -10, 110, 112, 26, C.navy2, 6); // suit
    inkPath(g, [[0, -6], [-10, 10], [0, 60], [10, 10]], true, C.red, null, 4); // tie
    g.save(); g.translate(-52, 6); g.rotate(o.armUp ? -2.4 + Math.sin(T * 10) * .2 : -.3); inkLine(g, 0, 0, -10, 60, 8, C.ink); inkCircle(g, -10, 64, 11, C.skin, 4); g.restore();
    g.save(); g.translate(52, 6); g.rotate(.3); inkLine(g, 0, 0, 10, 60, 8, C.ink); inkCircle(g, 10, 64, 11, C.skin, 4);
    if (o.paper) { inkRR(g, -6, 30, 60, 76, 4, C.white, 4); for (var i = 0; i < 4; i++) inkLine(g, 4, 46 + i * 12, 44, 46 + i * 12, 2.5); }
    g.restore();
    inkCircle(g, 0, -62, 54, C.skin, 6, 58); // head
    inkPath(g, [[-54, -76], [-40, -118], [-6, -124], [30, -120], [54, -84], [30, -98], [0, -96], [-30, -92]], true, C.ink, null, 4); // hair
    inkCircle(g, -20, -64, 15, "rgba(255,255,255,.35)", 4); inkCircle(g, 20, -64, 15, "rgba(255,255,255,.35)", 4); inkLine(g, -5, -64, 5, -64, 4);
    g.fillStyle = C.ink; g.beginPath(); g.arc(-20, -63, 4, 0, TAU); g.arc(20, -63, 4, 0, TAU); g.fill();
    if (o.worry) { inkPath(g, [[-14, -26], [0, -32], [14, -26]], false, null, null, 4); }
    else inkPath(g, [[-14, -32], [0, -24], [14, -32]], false, null, null, 4);
    if (o.sweat) for (var d = 0; d < 2; d++) { var k = ((T * 1.4 + d * .5) % 1); inkPath(g, circPts(66 + d * 14, -90 + k * 50, 7, 10, 14), true, "#9ed8f0", null, 3); }
    g.restore();
  }

  // Audy: the second-opinion auditor
  function audy(g, x, y, s, o) {
    o = o || {}; g.save(); g.translate(x, y + Math.sin(T * 2.8 + 1) * 4); g.scale(s, s);
    g.fillStyle = C.shadow; g.beginPath(); g.ellipse(0, 132, 96, 16, 0, 0, TAU); g.fill();
    [-44, 20].forEach(function (lx) { inkRR(g, lx, 86, 24, 44, 6, C.indigoD, 5); });
    inkRR(g, -90, -130, 180, 228, 50, C.indigo, 6);
    g.save(); g.beginPath(); g.rect(-90, -130, 180, 228); g.clip(); wash(g, -90, -20, 180, 120, C.indigoD, .4); g.restore();
    var sq = o.squint;
    if (sq) { inkLine(g, -48, -50, -18, -46, 7); } else { inkCircle(g, -32, -48, 12, C.ink, 3, 14); }
    inkCircle(g, 32, -48, 26, "rgba(255,255,255,.4)", 5); g.fillStyle = C.ink; g.beginPath(); g.arc(32, -48, 10, 0, TAU); g.fill();
    inkLine(g, 56, -40, 64, 10, 3);
    if (o.shout) inkCircle(g, 0, 6, 26, "#7a2e3a", 4.5, 22); else inkPath(g, [[-18, 4], [0, 0], [18, 4]], false, null, null, 6);
    // magnifier arm
    g.save(); g.translate(86, -10); g.rotate(o.point ? -1.1 : -.4); inkLine(g, 0, 0, 60, -10, 7);
    inkLine(g, 60, -10, 92, -26, 9); inkCircle(g, 118, -40, 34, "rgba(191,227,236,.45)", 7); g.restore();
    g.restore();
  }

  function tower(g, x, base, w, h, label, lit, col) {
    var y = base - h;
    inkRR(g, x, y, w, h, 8, col || "#5b6aa8", 5);
    var cols = Math.max(2, Math.floor(w / 34)), rows = Math.max(1, Math.floor((h - 40) / 40));
    for (var r = 0; r < rows; r++) for (var c2 = 0; c2 < cols; c2++) {
      var on = hash(r * 9 + c2 * 3 + w) < lit;
      g.fillStyle = on ? C.yellow : "rgba(20,20,40,.35)";
      g.fillRect(x + 12 + c2 * ((w - 24) / cols), y + 20 + r * 40, (w - 24) / cols - 10, 24);
    }
    if (label) { inkRR(g, x + w / 2 - measure(label, 26) / 2 - 14, y - 50, measure(label, 26) + 28, 40, 10, C.cream, 4); txt(g, label, x + w / 2, y - 21, 26, { align: "center", fill: C.ink }); }
  }

  function monitor(g, cx, cy, w, clip, tClip, o) {
    o = o || {}; var h = w * 9 / 16;
    g.save(); g.translate(cx, cy); if (o.rot) g.rotate(o.rot); if (o.scale) g.scale(o.scale, o.scale);
    g.fillStyle = C.shadow; g.beginPath(); g.ellipse(0, h / 2 + 70, w * .35, 20, 0, 0, TAU); g.fill();
    inkRR(g, -40, h / 2 + 8, 80, 50, 6, C.paper, 5); inkRR(g, -120, h / 2 + 52, 240, 22, 10, C.paper, 5);
    inkRR(g, -w / 2 - 26, -h / 2 - 26, w + 52, h + 52, 26, C.cream, 6);
    var img = clipFrame(clip, tClip);
    g.save(); g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.clip();
    g.fillStyle = "#131517"; g.fillRect(-w / 2, -h / 2, w, h);
    if (img) {
      var zx = o.zoom || 1, fx = o.focusX == null ? .5 : o.focusX, fy = o.focusY == null ? .5 : o.focusY;
      var dw = w * zx, dh = h * zx; g.drawImage(img, -w / 2 - (dw - w) * fx, -h / 2 - (dh - h) * fy, dw, dh);
    }
    g.restore();
    g.strokeStyle = C.ink; g.lineWidth = 5; g.strokeRect(-w / 2, -h / 2, w, h);
    g.fillStyle = C.red; g.beginPath(); g.arc(w / 2 + 6, h / 2 + 12, 5, 0, TAU); g.fill();
    g.restore();
  }

  // site footage frames, preloaded by __render before drawing
  var imgCache = {};
  function clipPath(name, t) { var n = CLIPS[name] || 1; var i = clamp(Math.floor(t * 30), 0, n - 1); return "../build/clips/" + name + "/" + String(i).padStart(5, "0") + ".jpg"; }
  function clipFrame(name, t) { return imgCache[clipPath(name, t)] || null; }
  var NEED = [];
  function needClip(name, t) { NEED.push(clipPath(name, t)); }

  // ── captions ───────────────────────────────────────────────────────────────
  function wrapWords(words, size, maxW, font) {
    var lines = [[]], wcur = 0, sp = measure(" ", size, font);
    words.forEach(function (w) {
      var ww = measure(w, size, font);
      if (wcur + ww > maxW && lines[lines.length - 1].length) { lines.push([]); wcur = 0; }
      lines[lines.length - 1].push(w); wcur += ww + sp;
    });
    return lines;
  }
  // subtitle pill: words light up as they are spoken
  function pill(g, line) {
    var f = spokenFrac(line, T), words = line.cap.split(" "), size = 40;
    var rows = wrapWords(words, size, 1250), rowH = 52;
    var inA = eOut(prog(T, line.start - .1, .25)), outA = 1 - prog(T, line.end + .1, .25);
    var a = Math.min(inA, outA); if (a <= 0) return;
    var widest = Math.max.apply(null, rows.map(function (r) { return measure(r.join(" "), size); }));
    var bw = widest + 70, bh = rows.length * rowH + 30, bx = W / 2 - bw / 2, by = H - 70 - bh + (1 - inA) * 30;
    g.save(); g.globalAlpha = a;
    inkRR(g, bx, by, bw, bh, 22, "rgba(43,36,64,.92)", 4, C.ink);
    var total = line.cap.replace(/\s/g, "").length, seen = 0;
    rows.forEach(function (r, ri) {
      var x = W / 2 - measure(r.join(" "), size) / 2, y = by + 52 + ri * rowH;
      r.forEach(function (w) {
        var wl = w.replace(/\s/g, "").length, w0 = seen / total, w1 = (seen + wl) / total; seen += wl;
        var col = f >= w1 ? C.cream : f > w0 ? C.yellow : C.dim;
        txt(g, w, x, y, size, { fill: col, weight: 600 });
        x += measure(w + " ", size);
      });
    });
    g.restore();
  }
  // big kinetic line: each word slams in when it is spoken
  function bigLine(g, line, box, o) {
    o = o || {}; var words = line.cap.split(" "), size = o.size || 96, maxW = box.w;
    var rows = wrapWords(words, size, maxW), rowH = size * 1.06, f = spokenFrac(line, T);
    var outA = o.hold ? 1 : 1 - prog(T, line.end + (o.linger || .5), .3); if (outA <= 0) return;
    var total = line.cap.replace(/\s/g, "").length, seen = 0;
    g.save(); g.globalAlpha = outA;
    rows.forEach(function (r, ri) {
      var rowW = measure(r.join(" "), size), x = o.align === "center" ? box.x + (maxW - rowW) / 2 : box.x, y = box.y + size + ri * rowH;
      r.forEach(function (w) {
        var wl = w.replace(/\s/g, "").length, w0 = seen / total; seen += wl;
        var appear = line.start + Math.max(0, w0 - .02) * line.dur * .92;
        var k = clamp((T - appear) / .22, 0, 1);
        if (k > 0) {
          var hot = /\d|\$|%|ML|LLM|Radar|caught|Zero|Overturned|source|neatHack|qwep|76\.6/.test(w);
          var ww = measure(w, size), sc = lerp(1.7, 1, eBack(k));
          txt(g, w, x + ww / 2, y, size, { align: "center", fill: hot ? (o.hot || C.yellow) : (o.col || C.cream), stroke: C.ink, sw: size * .17, scale: sc, shadow: C.ink, sx: 6, sy: 8, weight: 700, rot: (hash(ri * 7 + x) - .5) * .05 });
        }
        x += measure(w + " ", size);
      });
    });
    g.restore();
  }
  function caption(g, sc, box, o) {
    var line = lineAt(T); if (!line || line.scene !== sc.id) return;
    if (line.big && box) bigLine(g, line, box, o); else pill(g, line);
  }

  // stamp: slams down at t0
  function stamp(g, s, x, y, t0, col, size, rot) {
    var k = clamp((T - t0) / .28, 0, 1); if (T < t0) return;
    g.save(); g.translate(x, y); g.rotate(rot == null ? -.12 : rot); g.scale(lerp(2.6, 1, eOut(k)), lerp(2.6, 1, eOut(k))); g.globalAlpha = lerp(0, .95, k);
    var w = measure(s, size || 90) + 70, h = (size || 90) * 1.35;
    g.strokeStyle = col || C.red; g.lineWidth = 9; g.strokeRect(-w / 2, -h / 2, w, h);
    g.strokeRect(-w / 2 + 10, -h / 2 + 10, w - 20, h - 20);
    txt(g, s, 0, (size || 90) * .36, size || 90, { align: "center", fill: col || C.red, font: COMIC, weight: 400, ls: 4 });
    g.restore();
  }
  function card(g, x, y, w, h, fill, rot) { g.save(); g.translate(x + w / 2, y + h / 2); g.rotate(rot || 0); inkRR(g, -w / 2, -h / 2, w, h, 18, fill || C.cream, 5); g.restore(); }
  function sweatBurst(g, x, y, t0) { var k = prog(T, t0, .5); if (k <= 0 || k >= 1) return; for (var i = 0; i < 10; i++) { var a = i / 10 * TAU, r = 30 + k * 90; g.strokeStyle = hexa(C.yellow, 1 - k); g.lineWidth = 6; g.beginPath(); g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r); g.lineTo(x + Math.cos(a) * (r + 30), y + Math.sin(a) * (r + 30)); g.stroke(); } }

  // ── scenes ─────────────────────────────────────────────────────────────────
  var S = {};

  S.hook = function (g, sc) {
    var l1 = L("hook1"), l2 = L("hook2"), l3 = L("hook3");
    g.drawImage(paper("hook", C.navy, [C.navy2, "#4b3f7a", "#26304f", C.teal], 11), 0, 0);
    // window + moon + stars
    inkRR(g, 120, 110, 300, 260, 14, "#20264a", 6); g.fillStyle = C.cream; g.beginPath(); g.arc(220, 190, 34, 0, TAU); g.fill();
    for (var s = 0; s < 9; s++) { g.fillStyle = hexa(C.cream, .5 + .5 * Math.sin(T * 3 + s)); g.fillRect(150 + hash(s) * 240, 140 + hash(s * 3) * 200, 4, 4); }
    inkLine(g, 270, 110, 270, 370, 5); inkLine(g, 120, 240, 420, 240, 5);
    // calendar
    var flips = Math.floor(clamp((T - l2.start - .2) / .35, 0, 3));
    inkRR(g, 520, 140, 200, 220, 12, C.cream, 5); g.fillStyle = C.red; g.fillRect(523, 143, 194, 50);
    txt(g, ["Q1", "Q2", "Q3", "Q4"][flips], 620, 300, 96, { align: "center", fill: C.ink });
    txt(g, "NEXT QUARTER", 620, 180, 24, { align: "center", fill: C.cream });
    // desk + Fin
    inkRR(g, 60, 930, 900, 40, 10, "#8a5a3c", 6); inkRR(g, 120, 970, 30, 120, 6, "#6e4630", 5); inkRR(g, 860, 970, 30, 120, 6, "#6e4630", 5);
    fin(g, 560, 790, 1.0, { worry: T > l2.start, sweat: T > l2.start + .3, armUp: T > l3.start && T < l3.start + 1.2 });
    inkRR(g, 300, 830, 170, 100, 10, "#d9d2c0", 5); inkRR(g, 315, 845, 140, 70, 6, "#2c3a5a", 4);
    // rival tower doubling
    var grow = eOut(prog(T, l1.start + .4, 1.4)), base = 980;
    var hT = lerp(300, 720, grow);
    tower(g, 1360, base, 360, hT, "RIVAL CO.", .3 + .6 * grow, "#5b6aa8");
    var bots = 4 + Math.floor(grow * 4.999);
    for (var b = 0; b < bots; b++) {
      var bx = 1330 + (b % 4) * 110, by = base - 30 - Math.floor(b / 4) * 0 + (b >= 4 ? 40 : 0), pop = eBack(prog(T, l1.start + .4 + b * .17, .3));
      if (pop <= 0) continue;
      g.save(); g.translate(bx + (b >= 4 ? 55 : 0), by + 40); g.scale(pop * .5, pop * .5);
      inkRR(g, -40, -60, 80, 70, 16, b >= 4 ? C.orange : "#b9b2d8", 5); inkCircle(g, -14, -30, 7, C.ink, 2); inkCircle(g, 14, -30, 7, C.ink, 2); txt(g, "ML", 0, -78, 26, { align: "center", fill: C.cream, stroke: C.ink, sw: 5 });
      g.restore();
    }
    sfxWord(g, "x2!", 1700, 300, l1.start + 1.6, 120, C.yellow, .12);
    // Radar bursts in on line 3
    var up = eBack(prog(T, l3.start - .1, .5));
    if (up > 0) { radar(g, 1060, lerp(1300, 780, up), 1.15, { ping: l3.start + .35, expr: "wow", bounce: false }); sfxWord(g, "PING!", 1090, 420, l3.start + .4, 130, C.yellow, -.1); sweatBurst(g, 1060, 700, l3.start + .1); }
    // big words, top left
    caption(g, sc, { x: 110, y: 380, w: 1150 }, { size: 88 });
  };

  S.title = function (g, sc) {
    var l = L("title1");
    g.drawImage(paper("title", "#f6d9b8", ["#f7b2a0", "#ffd98a", "#f6a6c1", "#fff1c9"], 23), 0, 0);
    // sunburst
    g.save(); g.translate(1300, 520); g.rotate(T * .08);
    for (var r = 0; r < 18; r++) { g.fillStyle = hexa(r % 2 ? "#ffd98a" : "#f7b2a0", .35); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1400, r / 18 * TAU, (r + .5) / 18 * TAU); g.fill(); }
    g.restore();
    // radar scope with real competitors
    var cx = 1320, cy = 520, R = 330, ap = eOut(prog(T, sc.start, .6));
    g.save(); g.globalAlpha = ap;
    inkCircle(g, cx, cy, R, "rgba(44,50,96,.88)", 6);
    for (var k = 1; k < 4; k++) { g.strokeStyle = "rgba(247,239,225,.25)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * k / 4, 0, TAU); g.stroke(); }
    var sw = T * 2.2;
    for (var j = 0; j < 30; j++) { g.strokeStyle = hexa(C.green, .5 * (1 - j / 30)); g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sw - j * .03) * R, cy + Math.sin(sw - j * .03) * R); g.stroke(); }
    ["Honeycomb", "Sentry", "Arize", "Chronosphere", "Grafana Labs"].forEach(function (nm, i) {
      var a = -PI / 2 + i / 5 * TAU + .4, rr = R * (.45 + hash(i) * .4), bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr;
      var since = ((sw - a) % TAU + TAU) % TAU, glow = Math.exp(-since * 1.2);
      g.fillStyle = hexa(C.green, .6 + .4 * glow); g.beginPath(); g.arc(bx, by, 9 + glow * 6, 0, TAU); g.fill();
      txt(g, nm, bx + 16, by + 8, 24, { fill: C.cream, weight: 600 });
    });
    g.restore();
    // logo
    var letters = "SPEND RADAR".split(""), lx = 110, size = 150;
    letters.forEach(function (ch, i) {
      var k = eElastic(prog(T, sc.start + .1 + i * .06, .9)); if (k <= 0) { lx += measure(ch, size) + 4; return; }
      var w = measure(ch, size);
      txt(g, ch, lx + w / 2, 330 + Math.sin(T * 4 + i * .6) * 6, size, { align: "center", fill: i < 5 ? C.cream : C.yellow, stroke: C.ink, sw: 22, scale: k, shadow: C.ink, sx: 8, sy: 10 });
      lx += w + 4;
    });
    txt(g, "team qwep · neatHack 2026", 116, 400, 34, { fill: C.ink, weight: 600 });
    // three promises, appear with the words
    var f = spokenFrac(l, T);
    [["reads your books", .3, C.mint], ["scans the market", .48, C.sky], ["argues with itself", .66, C.indigo]].forEach(function (p, i) {
      var k = eBack(clamp((f - p[1]) / .08, 0, 1)); if (k <= 0) return;
      g.save(); g.translate(120 + i * 0, 480 + i * 110); g.scale(k, k);
      inkRR(g, 0, 0, measure(p[0], 52) + 80, 86, 43, p[2], 5); txt(g, (i + 1) + ". " + p[0], 30, 60, 52, { fill: C.ink, weight: 700 });
      g.restore();
    });
    radar(g, 1580, 820, .95, { wave: T < sc.start + 2.5, bounce: true });
    caption(g, sc, null);
  };

  S.how = function (g, sc) {
    var l1 = L("how1"), l2 = L("how2"), l3 = L("how3");
    g.drawImage(paper("how", C.teal, [C.teal2, "#25605c", "#5fb3a8", "#2f6a86"], 37), 0, 0);
    // conveyor floor
    inkRR(g, -20, 900, W + 40, 200, 0, "#d9c7a5", 6);
    // camera pans through three stations
    var cam = T < l2.start ? 0 : T < l3.start ? lerp(0, -1920, eInOut(prog(T, l2.start - .35, .6))) : lerp(-1920, -3840, eInOut(prog(T, l3.start - .35, .6)));
    g.save(); g.translate(cam, 0);
    // station 1: plan + read
    inkRR(g, 160, 170, 520, 640, 22, C.cream, 6);
    txt(g, "PLAN", 420, 250, 64, { align: "center", font: COMIC, weight: 400, fill: C.red, ls: 4 });
    ["read_budget", "read_policy", "read_invoice × 12", "fetch_competitor × 5", "fetch_jobs × 5", "classify_titles", "estimate_spend", "audit"].forEach(function (tk, i) {
      var k = prog(T, l1.start + .15 + i * .16, .2); var y = 320 + i * 58;
      inkRR(g, 210, y - 30, 36, 36, 8, k > 0 ? C.mint : C.white, 4); if (k > .5) inkPath(g, [[216, y - 14], [226, y - 2], [242, y - 26]], false, null, null, 5);
      txt(g, tk, 266, y, 34, { font: MONO, weight: 500, fill: C.ink });
    });
    radar(g, 1180, 740, 1.05, { expr: "happy", bounce: true, armR: Math.sin(T * 6) * .2 });
    var docs = ["budget_fy27.xlsx", "invoice 01", "invoice 02", "invoice 03", "policy.yaml"];
    docs.forEach(function (d, i) {
      var t0 = l1.start + l1.dur * .45 + i * .22, k = prog(T, t0, .7); if (k <= 0 || k >= 1) return;
      var x = lerp(760, 1150, eInOut(k)), y = lerp(260 + i * 60, 600, eInOut(k)) - Math.sin(k * PI) * 160;
      g.save(); g.translate(x, y); g.rotate(k * 4 + i); inkRR(g, -60, -76, 120, 152, 8, i ? C.white : "#d6f1dc", 4);
      for (var r = 0; r < 5; r++) inkLine(g, -40, -44 + r * 22, 40, -44 + r * 22, 3); g.restore();
      txt(g, d, x, y - 100, 24, { align: "center", font: MONO, fill: C.cream, stroke: C.ink, sw: 5 });
    });
    // station 2: ping competitors (real names)
    var ox = 1920;
    radar(g, ox + 330, 760, 1.0, { ping: l2.start + .2, dish: -.6, expr: "squint" });
    ["Honeycomb", "Sentry", "Arize", "Chronosphere", "Grafana Labs"].forEach(function (nm, i) {
      var hgt = 300 + hash(i * 4) * 300, lit = prog(T, l2.start + .5 + i * .2, .3);
      tower(g, ox + 700 + i * 230, 900, 190, hgt * eOut(prog(T, l2.start - .3 + i * .08, .6)), nm, .2 + .7 * lit, ["#5b6aa8", "#7a5ba8", "#a85b7a", "#5b8ea8", "#a8865b"][i]);
      if (lit > 0 && lit < 1) sfxWord(g, "PING", ox + 795 + i * 230, 420 - hash(i) * 100, l2.start + .5 + i * .2, 64, C.yellow, (hash(i) - .5) * .4);
    });
    txt(g, "Crustdata: real headcount", ox + 120, 220, 54, { fill: C.cream, stroke: C.ink, sw: 9 });
    // station 3: Python does the maths
    var ox3 = 3840;
    inkRR(g, ox3 + 760, 230, 420, 560, 30, "#3d4a6b", 6); inkRR(g, ox3 + 800, 270, 340, 120, 14, "#cfe8c8", 5);
    txt(g, "5,280,000", ox3 + 1120, 355, 64, { align: "right", font: MONO, weight: 500, fill: C.ink });
    for (var kx = 0; kx < 4; kx++) for (var ky = 0; ky < 3; ky++) inkRR(g, ox3 + 810 + kx * 82, 420 + ky * 112, 66, 90, 14, kx === 3 ? C.orange : C.cream, 4);
    txt(g, "PYTHON", ox3 + 970, 760, 54, { align: "center", font: COMIC, weight: 400, fill: C.yellow, ls: 3 });
    // the LLM robot reaching for the calculator gets stopped
    var reach = eInOut(prog(T, l3.start + .3, .6)), stop = T > l3.start + l3.dur * .55;
    g.save(); g.translate(ox3 + 320 + reach * 160, 620);
    inkRR(g, -120, -150, 240, 210, 40, "#c9c3e6", 6); inkCircle(g, -45, -70, 16, C.ink, 3); inkCircle(g, 45, -70, 16, C.ink, 3);
    txt(g, "LLM", 0, -170, 44, { align: "center", fill: C.cream, stroke: C.ink, sw: 8 });
    if (stop) { inkPath(g, [[-30, 0], [0, -14], [30, 0]], false, null, null, 6); } else inkPath(g, [[-30, -10], [0, 6], [30, -10]], false, null, null, 6);
    inkLine(g, 120, -40, 200 + reach * 40, -80, 9);
    g.restore();
    if (stop) { stamp(g, "NO MATHS FOR YOU", ox3 + 500, 300, l3.start + l3.dur * .55, C.red, 64, -.1); }
    g.restore();
    caption(g, sc, null);
  };

  S.recover = function (g, sc) {
    var l1 = L("rec1"), l2 = L("rec2");
    g.drawImage(paper("rec", "#f4d3b5", ["#f2b08e", "#f6c99b", "#e9a3a0", "#fbe3c1"], 51), 0, 0);
    if (T < l2.start - .3) {
      // the corrupt PDF
      var fall = eBack(prog(T, l1.start, .5));
      g.save(); g.translate(430, lerp(-200, 520, fall)); g.rotate(-.15);
      inkRR(g, -150, -190, 300, 380, 12, C.white, 6); for (var r = 0; r < 7; r++) inkLine(g, -110, -120 + r * 40, 110, -120 + r * 40, 3);
      inkPath(g, [[-20, -190], [20, -90], [-30, -10], [40, 90], [0, 190]], false, null, C.red, 8);
      txt(g, "13_brightloop.pdf", 0, 240, 34, { align: "center", font: MONO, fill: C.ink, stroke: C.cream, sw: 8 });
      g.restore();
      sfxWord(g, "THUNK!", 430, 230, l1.start + .45, 140, C.orange);
      sfxWord(g, "429!", 860, 200, l1.start + l1.dur * .45, 110, C.red, .15);
      radar(g, 1500, 820, 1.0, { expr: T < l1.start + l1.dur * .5 ? "wow" : "squint", bounce: false });
      // the fixed menu, dealt like cards
      ["reparse_alt", "skip", "fetch_more_signal", "mark_low_confidence", "substitute_competitor"].forEach(function (o, i) {
        var t0 = l1.start + l1.dur * .55 + i * .09, k = eBack(prog(T, t0, .45)); if (k <= 0) return;
        var chosen = i === 0 && T > l1.end - .4, lift = chosen ? eBack(prog(T, l1.end - .4, .35)) * 80 : 0;
        var a = (i - 2) * .16, x = 1180 + (i - 2) * 150, y = 470 - lift;
        g.save(); g.translate(x, y + (1 - k) * 300); g.rotate(a);
        inkRR(g, -95, -150, 190, 300, 18, chosen ? C.indigo : C.cream, 6);
        g.save(); g.rotate(-PI / 2); txt(g, o, 0, 12, 30, { align: "center", font: MONO, weight: 500, fill: C.ink }); g.restore();
        g.restore();
      });
      if (T > l1.end - .4) sfxWord(g, "PICK!", 1180, 220, l1.end - .35, 90, C.indigo);
    } else {
      // real footage: the run replay, plus the real count
      var tc = T - (l2.start - .3);
      needClip("run", tc + 1.2);
      monitor(g, 1240, 470, 1080, "run", tc + 1.2, { rot: -.02, scale: eBack(prog(T, l2.start - .3, .5)), zoom: 1.35, focusX: .3, focusY: .55 });
      radar(g, 280, 840, .9, { expr: "proud", bounce: true });
      caption(g, sc, { x: 80, y: 120, w: 620 }, { size: 86, hold: false });
    }
    if (T < l2.start - .3) caption(g, sc, null);
  };

  S.audit = function (g, sc) {
    var a1 = L("aud1"), a2 = L("aud2"), a3 = L("aud3"), a4 = L("aud4");
    g.drawImage(paper("aud", "#f6dfcf", ["#f7b8a8", "#ffd9a0", "#f3a9b8", "#fff0d0"], 67), 0, 0);
    // stage floor + curtains that open on line 1
    inkRR(g, -20, 860, W + 40, 260, 0, "#d79a62", 6);
    for (var p = 0; p < 12; p++) inkLine(g, p * 170, 862, p * 170 - 80, 1080, 3, "rgba(42,36,51,.4)");
    var open = eInOut(prog(T, a1.start + .2, .9));
    // confidence gauge (real: 0.0 for this finding)
    if (T > a2.start - .2) {
      var gx = 1540, gy = 220, drain = eInOut(prog(T, a2.start + a2.dur * .6, 1.4)), lvl = lerp(.62, 0, drain);
      inkRR(g, gx - 34, gy, 68, 520, 34, C.cream, 6); g.fillStyle = lvl > .3 ? C.green : C.red;
      g.fillRect(gx - 20, gy + 14 + (500 - 28) * (1 - lvl), 40, (500 - 28) * lvl);
      inkCircle(g, gx, gy + 560, 54, lvl > .3 ? C.green : C.red, 6);
      txt(g, drain >= 1 ? "0.0" : lvl.toFixed(1), gx, gy + 576, 40, { align: "center", fill: C.cream, stroke: C.ink, sw: 7 });
      txt(g, "CONFIDENCE", gx, gy - 20, 34, { align: "center", font: COMIC, weight: 400, fill: C.ink, ls: 3 });
    }
    // claim: the number
    if (T > a2.start - .2 && T < a4.end + 1) {
      radar(g, 470, 760, 1.0, { expr: T > a3.start + .6 ? "wow" : "proud", bounce: false });
      var k = eBack(prog(T, a2.start + a2.dur * .35, .5));
      if (k > 0) {
        g.save(); g.translate(760, 300); g.scale(k, k);
        inkPath(g, [[-330, -120], [330, -120], [330, 110], [-120, 110], [-200, 200], [-180, 110], [-330, 110]], true, C.white, null, 7);
        txt(g, "$5,280,000", 0, 30, 118, { align: "center", fill: C.red, stroke: C.ink, sw: 16 });
        txt(g, "ML/AI GAP · PER YEAR", 0, 86, 32, { align: "center", font: MONO, weight: 500, fill: C.ink });
        var strike = prog(T, a4.start + .1, .35);
        if (strike > 0) { g.strokeStyle = C.red; g.lineWidth = 16; g.lineCap = "round"; g.beginPath(); g.moveTo(-300, 0); g.lineTo(-300 + 600 * eOut(strike), -10); g.stroke(); }
        g.restore();
      }
    }
    // Audy arrives on line 3 and points
    if (T > a3.start - .2) {
      var inA = eBack(prog(T, a3.start - .2, .6));
      audy(g, lerp(2200, 1260, inA), 760, 1.0, { squint: T < a3.start + .8, point: T > a3.start + .8, shout: T > a3.start + .8 && T < a3.end });
      sfxWord(g, "HOLD ON!", 1280, 420, a3.start + .5, 100, C.indigo, .1);
      // real footage of the proof chain on a small monitor
      if (T < a4.start) { needClip("proof", T - a3.start + .2); monitor(g, 1120, 280, 520, "proof", T - a3.start + .2, { rot: .03, scale: eOut(prog(T, a3.start, .4)), zoom: 1.0 }); }
    }
    stamp(g, "OVERTURNED", 760, 560, a4.start + .15, C.red, 110, -.14);
    sfxWord(g, "SLAM!", 1250, 820, a4.start + .2, 140, C.red);
    // curtains on top
    [0, 1].forEach(function (side) {
      var w = lerp(W / 2 + 40, 160, open), x = side ? W - w : 0;
      inkRR(g, x - (side ? 0 : 20), -20, w + 20, H + 40, 0, "#c0393b", 6);
      for (var f = 0; f < 6; f++) inkLine(g, x + (f + .5) * w / 6, 0, x + (f + .5) * w / 6 + Math.sin(T + f) * 8, H, 4, "rgba(42,36,51,.35)");
    });
    var cl = lineAt(T);
    if (cl && cl.id === "aud4") caption(g, sc, { x: 60, y: 900, w: W - 120 }, { size: 70, align: "center" });
    else caption(g, sc, { x: 0, y: 380, w: W }, { size: 130, align: "center" });
  };

  S.general = function (g, sc) {
    var g1 = L("gen1"), g2 = L("gen2"), g3 = L("gen3");
    g.drawImage(paper("gen", "#cfe9f0", ["#a9d6e5", "#e7f5f8", "#9cc9e0", "#f0e2c8"], 83), 0, 0);
    var comps = [["Acme Observability", "observability SaaS", 5, true], ["Bastion Security", "cybersecurity", 6, true], ["Carebridge Health", "digital health", 5, false],
      ["Kestrel Metrics", "observability SaaS", 6, false], ["Ledgerly Payments", "fintech", 5, true], ["Parcelwise Commerce", "e-commerce logistics", 5, false], ["Peoplegraph HR", "HR tech", 5, false]];
    comps.forEach(function (c, i) {
      var col = i % 4, row = Math.floor(i / 4), x = 110 + col * 440 + (row ? 220 : 0), y = 170 + row * 330;
      var k = eBack(prog(T, g1.start + .1 + i * .11, .45)); if (k <= 0) return;
      g.save(); g.translate(x + 200, y + 140); g.scale(k, k); g.rotate((hash(i) - .5) * .06);
      // lightning on the three injected companies
      var zap = c[3] ? prog(T, g3.start + .3 + i * .05, .5) : 0;
      inkRR(g, -200, -140, 400, 280, 24, i === 0 ? "#fff1d6" : C.cream, 6);
      inkCircle(g, -150, -88, 30, C.ink, 4); txt(g, c[0].charAt(0), -150, -76, 34, { align: "center", fill: C.cream });
      txt(g, c[0], -106, -84, 32, { fill: C.ink }); txt(g, (i === 0 ? "built against · " : "held out · ") + c[1], -106, -50, 22, { fill: "#6a6170", weight: 500 });
      for (var p = 0; p < c[2]; p++) {
        var st = g2.start - .2 + i * .1 + p * .05, sk = eBack(prog(T, st, .3));
        inkRR(g, -170 + p * 58, -6, 48, 48, 10, sk > 0 ? C.green : "rgba(0,0,0,.08)", 4);
        if (sk > 0) { g.save(); g.translate(-146 + p * 58, 18); g.scale(sk, sk); inkPath(g, [[-11, 0], [-3, 9], [12, -10]], false, null, C.white, 6); g.restore(); }
      }
      txt(g, c[2] + " / " + c[2], 170, 110, 44, { align: "right", fill: T > g2.start + .3 ? C.mintD : "#9a92a0" });
      if (zap > 0 && zap < 1) { g.strokeStyle = C.yellow; g.lineWidth = 10; inkPath(g, [[60, -320], [10, -200], [70, -200], [0, -60]], false, null, C.yellow, 12); }
      if (c[3] && T > g3.start + .3) { inkRR(g, 40, -128, 130, 40, 10, C.indigo, 4); txt(g, "429 ×2", 105, -98, 24, { align: "center", font: MONO, fill: C.ink }); }
      g.restore();
    });
    stamp(g, "0 FALSE ALARMS", 1640, 930, g2.start + g2.dur * .6, C.mintD, 56, .06);
    if (T > g3.start + .5) { // the real Recovery log page: the three fault-injected runs
      var tr = T - g3.start - .5; needClip("recovery", tr);
      g.save(); g.fillStyle = "rgba(42,36,51," + (.45 * eOut(prog(T, g3.start + .5, .3))) + ")"; g.fillRect(0, 0, W, H); g.restore();
      monitor(g, 1180, 450, 1000, "recovery", tr, { rot: .02, scale: eBack(prog(T, g3.start + .5, .5)) });
    }
    sfxWord(g, "ZAP!", 300, 120, g3.start + .35, 110, C.yellow, -.1);
    radar(g, 230, 900, .7, { expr: T > g2.start ? "proud" : "happy", bounce: true });
    caption(g, sc, { x: 380, y: 800, w: 960 }, { size: 66 });
  };

  S.neatlogs = function (g, sc) {
    var n1 = L("nl1"), n2 = L("nl2"), n3 = L("nl3");
    g.drawImage(paper("nl", "#1f2440", ["#2c3260", "#3b2f5a", "#22364f", "#2f4a5c"], 97), 0, 0);
    txt(g, "neatlogs", 110, 150, 92, { fill: C.cream, stroke: C.ink, sw: 12 });
    txt(g, "trace af0df27e… · run 1010-b31657", 115, 200, 30, { font: MONO, weight: 500, fill: "#a8aac4" });
    if (T < n3.start - .2) {
      // a waterfall of real span names
      var spans = [["plan", 0, .1], ["act:read_budget", .1, .06], ["verify:totals", .16, .03], ["act:fetch_competitor", .2, .1], ["decide:recovery", .3, .05, 1], ["act:fetch_jobs", .35, .08],
        ["decide:recovery", .43, .05, 1], ["act:classify_titles", .48, .12], ["decide:recovery", .6, .05, 1], ["fallback:gemini", .65, .07], ["audit:f_ml_ai", .72, .1], ["report", .86, .1]];
      spans.forEach(function (s, i) {
        var y = 260 + i * 46, k = prog(T, n1.start + .3 + i * .07, .4), x0 = 560 + s[1] * 1200, w = s[2] * 1200 * eOut(k);
        if (k <= 0) return;
        txt(g, s[0], 520, y + 28, 26, { align: "right", font: MONO, weight: 500, fill: s[3] ? C.yellow : "#cfd0e6" });
        inkRR(g, x0, y + 6, Math.max(8, w), 30, 8, s[3] ? C.orange : s[0].indexOf("fallback") === 0 ? C.indigo : C.teal2, 3);
      });
      if (T > n2.start) {
        // magnifier on the recovery spans: three peers thrown away (case study 02)
        var mk = eOut(prog(T, n2.start, .5));
        g.save(); g.globalAlpha = mk; inkCircle(g, 1500, 560, 210, "rgba(20,24,48,.92)", 8);
        txt(g, "substitute_competitor", 1500, 470, 27, { align: "center", font: MONO, weight: 500, fill: C.orange });
        ["Honeycomb", "Arize", "Chronosphere"].forEach(function (nm, i) {
          var fly = prog(T, n2.start + .6 + i * .3, .6);
          txt(g, "✗ " + nm, 1500 + fly * 300 * (i - 1), 540 + i * 56 - fly * 200, 38, { align: "center", fill: C.red, weight: 700 });
        });
        txt(g, "→ New Relic (3,095)", 1500, 712, 32, { align: "center", fill: C.cream, weight: 600 });
        txt(g, "→ Datadog (10,482)", 1500, 752, 32, { align: "center", fill: C.cream, weight: 600 });
        g.restore();
        inkLine(g, 1650, 710, 1790, 860, 22, C.ink);
        sfxWord(g, "YOINK!", 1240, 330, n2.start + .8, 100, C.orange, -.12);
      }
      radar(g, 250, 860, .75, { expr: T > n2.start ? "squint" : "happy" });
    } else {
      // before / after (case study 02)
      var rows = [["Peers kept", "2 / 5", "5 / 5"], ["Crustdata credits", "26.6", "5.4"], ["Planted errors caught", "5 / 5", "5 / 5"]];
      rows.forEach(function (r, i) {
        var y = 330 + i * 190, k = eBack(prog(T, n3.start + .1 + i * .25, .45)); if (k <= 0) return;
        g.save(); g.translate(960, y); g.scale(k, k);
        inkRR(g, -760, -70, 1520, 150, 26, C.cream, 6);
        txt(g, r[0], -720, 22, 48, { fill: C.ink });
        txt(g, r[1], 230, 26, 72, { align: "center", fill: i < 2 ? C.red : C.mintD });
        txt(g, "→", 400, 22, 72, { align: "center", fill: C.ink });
        txt(g, r[2], 590, 26, 72, { align: "center", fill: C.mintD });
        g.restore();
      });
      sfxWord(g, "FIXED!", 1640, 200, n3.start + .9, 110, C.green, .1);
      radar(g, 1700, 930, .55, { expr: "proud", bounce: true });
    }
    caption(g, sc, { x: 160, y: 830, w: 1500 }, { size: 70 });
  };

  S.entire = function (g, sc) {
    var e1 = L("ent1"), e2 = L("ent2");
    g.drawImage(paper("ent", "#dcd1f3", ["#c4b4ee", "#efe6ff", "#b6c8f0", "#f3d9ef"], 113), 0, 0);
    txt(g, "Entire", 110, 160, 92, { fill: C.ink });
    // real commits from this repo, stacking up with checkpoint stickers
    var commits = [["63c0490", "step 14: front end in site/"], ["de18e4f", "step 10: audit sees the line-item check"], ["9427d14", "step 9: held-out batch n=3 results"],
      ["21de57c", "step 9: held-out eval on 3 new companies"], ["8d11308", "step 8: corrupt PDF fails fast"], ["a9a0d0e", "step 13: cost per run n=5"]];
    commits.forEach(function (c, i) {
      var t0 = e1.start + i * .32, k = eOut(prog(T, t0, .45)); if (k <= 0) return;
      var y = lerp(-200, 880 - i * 105, k), x = 520 + (hash(i * 3) - .5) * 60;
      g.save(); g.translate(x, y); g.rotate((hash(i * 7) - .5) * .12);
      inkRR(g, -330, -48, 660, 96, 14, C.cream, 5);
      txt(g, c[0], -305, 12, 26, { font: MONO, weight: 500, fill: C.indigoD }); txt(g, c[1], -170, 12, 27, { fill: C.ink, weight: 600 });
      var sk = eBack(prog(T, t0 + .3, .3)); if (sk > 0) { g.save(); g.translate(300, -40); g.scale(sk, sk); g.rotate(.2); inkRR(g, -70, -26, 140, 52, 12, C.yellow, 4); txt(g, "checkpoint", 0, 9, 22, { align: "center", font: MONO, fill: C.ink }); g.restore(); }
      g.restore();
    });
    // strings from the newest commit to what it links to
    var lk = eOut(prog(T, e1.start + e1.dur * .5, .6));
    if (lk > 0) {
      [["prompt", 1350, 330], ["transcript", 1500, 520]].forEach(function (b) {
        g.strokeStyle = C.ink; g.lineWidth = 4; g.setLineDash([12, 10]); g.beginPath(); g.moveTo(850, 400); g.quadraticCurveTo((850 + b[1]) / 2, b[2] - 160, lerp(850, b[1], lk), lerp(400, b[2], lk)); g.stroke(); g.setLineDash([]);
        if (lk > .9) { inkRR(g, b[1] - 20, b[2] - 50, measure(b[0], 46) + 50, 84, 40, C.white, 5); txt(g, b[0], b[1] + 5, b[2] + 8, 46, { fill: C.ink }); }
      });
    }
    var bk = eBack(prog(T, e2.start, .5));
    if (bk > 0) { g.save(); g.translate(1460, 830); g.scale(bk, bk); txt(g, "40+", 0, 0, 220, { align: "center", fill: C.yellow, stroke: C.ink, sw: 26, shadow: C.ink, sx: 8, sy: 10 }); txt(g, "checkpoints on GitHub", 0, 70, 46, { align: "center", fill: C.ink }); g.restore(); }
    sfxWord(g, "CLICK!", 1700, 240, e1.start + e1.dur * .55, 90, C.indigoD);
    radar(g, 1790, 250, .55, { expr: "happy" });
    caption(g, sc, null);
  };

  S.cfo = function (g, sc) {
    var c1 = L("cfo1"), c2 = L("cfo2"), c3 = L("cfo3");
    g.drawImage(paper("cfo", "#d6ecd2", ["#b5dcae", "#eef7e6", "#c6e4b0", "#f5e7c4"], 131), 0, 0);
    txt(g, "cfo.ai", 110, 160, 92, { fill: C.ink });
    txt(g, "a business plan from measured costs", 116, 210, 34, { fill: "#4b5a48", weight: 500 });
    fin(g, 1700, 650, .95, { paper: true, armUp: T > c3.start + .5 });
    if (T < c2.start - .1) { // the real Business page of the evidence site
      var tb = T - sc.start; needClip("business", tb);
      monitor(g, 900, 560, 1040, "business", tb, { rot: -.02, scale: eBack(prog(T, sc.start + .1, .5)) });
    } else if (T < c3.start - .2) {
      // tiny coin vs huge sack (real per-run costs)
      var k1 = eBack(prog(T, c2.start, .4)), k2 = eBack(prog(T, c2.start + c2.dur * .45, .5));
      if (k1 > 0) { g.save(); g.translate(420, 620); g.scale(k1, k1); inkCircle(g, 0, 0, 46, C.yellow, 6); txt(g, "¢", 0, 18, 52, { align: "center", fill: C.ink }); txt(g, "LLM: $0.0285 / run", 0, 110, 40, { align: "center", fill: C.ink }); g.restore(); }
      if (k2 > 0) {
        g.save(); g.translate(1050, 600); g.scale(k2, k2);
        inkPath(g, [[-200, 220], [-240, 60], [-150, -120], [-60, -170], [60, -170], [150, -120], [240, 60], [200, 220]], true, "#c9a46a", null, 7);
        inkPath(g, [[-70, -170], [0, -230], [70, -170]], false, null, null, 7);
        txt(g, "$", 0, 60, 200, { align: "center", fill: C.cream, stroke: C.ink, sw: 18 });
        txt(g, "competitor data: $6.24–$9.24 / run", 0, 300, 40, { align: "center", fill: C.ink });
        g.restore();
        sfxWord(g, "~99%", 1330, 300, c2.start + c2.dur * .65, 130, C.red, .1);
      }
      if (T < c2.start) radar(g, 600, 820, .8, { expr: "happy", bounce: true });
    } else {
      // margin bar climbs to the real figure
      var fill = eOut(prog(T, c3.start + c3.dur * .4, 1.0));
      inkRR(g, 260, 380, 1100, 120, 60, C.white, 7);
      g.save(); g.beginPath(); g.rect(266, 386, 1088 * .766 * fill, 108); g.clip(); inkRR(g, 260, 380, 1100, 120, 60, C.green, 0, "rgba(0,0,0,0)"); g.restore();
      txt(g, "Team tier gross margin", 260, 350, 44, { fill: C.ink });
      txt(g, (76.6 * fill).toFixed(1) + "%", 260 + 1100 * .766 * fill, 590, 96, { align: "center", fill: C.mintD, stroke: C.ink, sw: 12 });
      txt(g, "capped at 10 fresh competitor-data runs a month · Base: cash-flow positive in month 15", 262, 680, 32, { fill: "#4b5a48", weight: 500 });
      sfxWord(g, "KA-CHING!", 1100, 230, c3.start + c3.dur * .4 + 1.0, 130, C.yellow, -.08);
    }
    caption(g, sc, { x: 120, y: 760, w: 1300 }, { size: 80 });
  };

  S.outro = function (g, sc) {
    var o1 = L("out1"), o2 = L("out2");
    g.drawImage(paper("out", "#f6d9b8", ["#f7b2a0", "#ffd98a", "#f6a6c1", "#c4b4ee"], 149), 0, 0);
    g.save(); g.translate(960, 560); g.rotate(T * .1);
    for (var r = 0; r < 24; r++) { g.fillStyle = hexa(r % 2 ? "#ffd98a" : "#f7b2a0", .4); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1500, r / 24 * TAU, (r + .5) / 24 * TAU); g.fill(); }
    g.restore();
    var tc = T - sc.start;
    needClip("intro", Math.min(tc + 2.6, 8.4));
    monitor(g, 960, 420, 980, "intro", Math.min(tc + 2.6, 8.4), { scale: eBack(prog(T, sc.start, .6)), rot: -.015 });
    radar(g, 300, 860, .85, { wave: true, bounce: true });
    audy(g, 1640, 860, .7, {});
    fin(g, 1450, 820, .7, { armUp: true });
    caption(g, sc, { x: 0, y: 830, w: W }, { size: 78, align: "center", hold: true });
    if (T > o2.end) {
      var k = eOut(prog(T, o2.end, .5));
      g.save(); g.globalAlpha = k; g.fillStyle = "rgba(42,36,51,.8)"; g.fillRect(0, 0, W, H);
      txt(g, "SPEND RADAR", 960, 470, 170, { align: "center", fill: C.cream, stroke: C.ink, sw: 24, shadow: C.ink, sx: 8, sy: 10 });
      txt(g, "Every number has a source.", 960, 560, 56, { align: "center", fill: C.yellow });
      txt(g, "github.com/akarsh-dhingra/SpeedRadar-NeetHack", 960, 660, 38, { align: "center", font: MONO, weight: 500, fill: C.cream });
      txt(g, "team qwep · #neatHack · built with neatlogs, Entire, cfo.ai", 960, 720, 34, { align: "center", fill: "#d9cfe0", weight: 600 });
      g.restore();
    }
  };

  // ── frame assembly ─────────────────────────────────────────────────────────
  var bufA = document.createElement("canvas"), bufB = document.createElement("canvas"); bufA.width = bufB.width = W; bufA.height = bufB.height = H;
  function sceneAt(t) { for (var i = 0; i < TL.scenes.length; i++) if (t < TL.scenes[i].end) return i; return TL.scenes.length - 1; }
  function drawScene(g, i) {
    var sc = TL.scenes[i]; sc.dur = sc.end - sc.start;
    g.save(); var bump = { title: 1, how: 1, general: 1, cfo: 1, outro: 1 }[sc.id] ? 1 + .012 * kickEnv(T) : 1;
    g.translate(W / 2, H / 2); g.scale(bump, bump); g.translate(-W / 2, -H / 2);
    (S[sc.id] || function () {})(g, sc); g.restore();
  }
  function tornWipe(g, k, seed) { // torn paper edge sweeping left → right
    g.beginPath(); var x = lerp(-300, W + 300, eInOut(k));
    g.moveTo(-10, -10); g.lineTo(x, -10);
    for (var y = 0; y <= H + 20; y += 30) g.lineTo(x + (hash(seed + y * .07) - .5) * 70 + Math.sin(y * .01) * 60, y);
    g.lineTo(-10, H + 10); g.closePath();
  }
  var TRANS = .45;
  function frame(t) {
    T = t; BF = Math.floor(t * BOIL);
    var i = sceneAt(t), sc = TL.scenes[i];
    var into = i > 0 ? t - sc.start : 99;
    if (into < TRANS / 2 && i > 0) { // second half of a wipe: previous scene still partly visible
      var k = .5 + into / TRANS;
      drawScene(X, i);
      bufA.getContext("2d").clearRect(0, 0, W, H); var ga = bufA.getContext("2d"); ga.save(); T = TL.scenes[i - 1].end - .001; drawScene(ga, i - 1); ga.restore(); T = t;
      X.save(); X.beginPath(); X.rect(0, 0, W, H); tornWipe(X, k, i); X.clip("evenodd"); X.drawImage(bufA, 0, 0); X.restore();
      edge(k, i);
    } else if (i < TL.scenes.length - 1 && sc.end - t < TRANS / 2) { // first half: next scene slides in from the left edge
      var k2 = .5 - (sc.end - t) / TRANS;
      drawScene(X, i);
      var gb = bufB.getContext("2d"); gb.clearRect(0, 0, W, H); var keep = T; T = TL.scenes[i + 1].start + .001; drawScene(gb, i + 1); T = keep;
      X.save(); tornWipe(X, k2, i + 1); X.clip(); X.drawImage(bufB, 0, 0); X.restore();
      edge(k2, i + 1);
    } else drawScene(X, i);
    // film grain on top, shifted each boil frame
    X.save(); X.globalAlpha = .5; X.globalCompositeOperation = "multiply"; X.translate((BF * 37) % 512, (BF * 61) % 512);
    X.fillStyle = X.createPattern(grain, "repeat"); X.fillRect(-512, -512, W + 1024, H + 1024); X.restore();
  }
  function edge(k, seed) { X.save(); X.strokeStyle = C.white; X.lineWidth = 14; tornWipe(X, k, seed); X.stroke(); X.strokeStyle = C.ink; X.lineWidth = 4; X.stroke(); X.restore(); }

  // sound-effect cues, derived from the same timeline the visuals use
  window.__cues = function () {
    var c = [];
    function add(t, s, g) { c.push({ t: +t.toFixed(3), sfx: s, gain: g || 1 }); }
    TL.scenes.forEach(function (s, i) { if (i) add(s.start - .2, "whoosh", .9); });
    var l;
    l = L("hook1"); add(l.start + 1.6, "boom"); l = L("hook2"); for (var q = 0; q < 3; q++) add(l.start + .2 + q * .35, "tick"); l = L("hook3"); add(l.start + .35, "ping");
    l = L("how2"); for (q = 0; q < 5; q++) add(l.start + .5 + q * .2, "pop", .7); l = L("how3"); add(l.start + l.dur * .55, "stamp");
    l = L("rec1"); add(l.start + .45, "stamp"); add(l.start + l.dur * .45, "glitch", .7); add(l.end - .35, "pop");
    l = L("aud1"); add(l.start, "riser", .8); l = L("aud3"); add(l.start + .5, "pop"); l = L("aud4"); add(l.start + .15, "stamp", 1.2); add(l.start + .2, "glitch");
    l = L("gen2"); for (q = 0; q < 7; q++) add(l.start - .2 + q * .1, "tick", .8); add(l.start + l.dur * .6, "stamp"); l = L("gen3"); add(l.start + .35, "glitch");
    l = L("nl2"); add(l.start + .8, "whoosh", .7); l = L("nl3"); add(l.start + .9, "ding");
    l = L("ent1"); for (q = 0; q < 6; q++) add(l.start + q * .32 + .3, "pop", .6); l = L("ent2"); add(l.start, "stamp");
    l = L("cfo2"); add(l.start + l.dur * .65, "boom", .8); l = L("cfo3"); add(l.start + l.dur * .4 + 1.0, "ding", 1.2);
    l = L("out2"); add(l.end, "ding");
    return c;
  };

  var loading = {};
  function load(src) {
    if (imgCache[src]) return Promise.resolve();
    if (!loading[src]) loading[src] = new Promise(function (res) { var im = new Image(); im.onload = function () { imgCache[src] = im; res(); }; im.onerror = function () { res(); }; im.src = src; });
    return loading[src];
  }
  // dry-run pass to learn which clip frames this time needs, load them, then draw for real
  window.__render = async function (t) {
    NEED = []; frame(t);
    if (NEED.length) { await Promise.all(NEED.map(load)); frame(t); }
    // drop old frames to keep memory flat
    var keys = Object.keys(imgCache); if (keys.length > 120) keys.slice(0, keys.length - 60).forEach(function (k) { delete imgCache[k]; delete loading[k]; });
    return true;
  };
  window.__ready = true;
})();
