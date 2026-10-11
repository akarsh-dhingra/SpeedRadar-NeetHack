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
  var SC = cv.width / W; // output scale (2560x1440 canvas, everything drawn in 1920x1080 units)
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
    var idx = TL.lines.indexOf(line), nxt = TL.lines[idx + 1];
    var outAt = Math.min(line.end + (o.linger || .5), nxt ? nxt.start - .25 : 1e9);
    var outA = o.hold ? 1 : 1 - prog(T, outAt, .22); if (outA <= 0) return;
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

  // ── scenes (v3) ────────────────────────────────────────────────────────────
  // Every number drawn here comes from window.__DATA (film/src/data/run.json + facts.json, built from the
  // repo's evidence by film/make_data.py). Timing: the narration's own word times (wt), so props land on words.
  var D = window.__DATA || { run: {}, facts: {} }, RUN = D.run, FX = D.facts;
  var S = {};
  function nrm(s) { return String(s).toLowerCase().replace(/[^a-z0-9]/g, ""); }
  // time a word is spoken in a line (first match of any needle at/after nth); falls back to a fraction of the line
  function wt(id, needles, frac, nth) {
    var l = L(id); if (!l) return 0; var want = needles.map(nrm), seen = 0;
    for (var i = 0; i < (l.words || []).length; i++) if (want.indexOf(nrm(l.words[i].w)) >= 0) { if (seen === (nth || 0)) return l.words[i].t0; seen++; }
    return l.start + l.dur * (frac == null ? .5 : frac);
  }
  function fmtN(n) { return Math.round(n).toLocaleString("en-US"); }
  function money(n) { return (n < 0 ? "−$" : "$") + fmtN(Math.abs(n)); }
  // still images (screenshots) share the clip loader
  function needImg(src) { NEED.push(src); return imgCache[src] || null; }
  // a framed still image on a drawn monitor
  function monitorImg(g, cx, cy, w, src, o) {
    o = o || {}; var h = w * (o.ar || 9 / 16), img = needImg(src);
    g.save(); g.translate(cx, cy); if (o.rot) g.rotate(o.rot); if (o.scale != null) g.scale(o.scale, o.scale);
    g.fillStyle = C.shadow; g.beginPath(); g.ellipse(0, h / 2 + 70, w * .35, 20, 0, 0, TAU); g.fill();
    inkRR(g, -40, h / 2 + 8, 80, 50, 6, C.paper, 5); inkRR(g, -120, h / 2 + 52, 240, 22, 10, C.paper, 5);
    inkRR(g, -w / 2 - 26, -h / 2 - 26, w + 52, h + 52, 26, C.cream, 6);
    g.save(); g.beginPath(); g.rect(-w / 2, -h / 2, w, h); g.clip(); g.fillStyle = "#131517"; g.fillRect(-w / 2, -h / 2, w, h);
    if (img) { var z = o.zoom || 1, fx = o.fx == null ? .5 : o.fx, fy = o.fy == null ? .5 : o.fy, iw = w * z, ih = iw * img.height / img.width; g.drawImage(img, -w / 2 - (iw - w) * fx, -h / 2 - (ih - h) * fy, iw, ih); }
    if (o.over) o.over(g, w, h);
    g.restore(); g.strokeStyle = C.ink; g.lineWidth = 5; g.strokeRect(-w / 2, -h / 2, w, h);
    g.restore();
  }
  // internet-brutalist insert: a hard black card of raw output, flashed for a beat
  function flash(g, t0, dur, lines, col) {
    if (T < t0 || T > t0 + dur) return;
    g.save(); g.fillStyle = "#0b0c0d"; g.fillRect(0, 0, W, H);
    lines.forEach(function (s, i) { txt(g, s, 120, 420 + i * 92, i ? 52 : 74, { font: MONO, weight: 500, fill: i ? "#a8aaac" : (col || C.red) }); });
    txt(g, "neatlogs · trace " + (RUN.trace || "").slice(0, 12) + "…", 120, 980, 30, { font: MONO, weight: 500, fill: "#5a5d60" });
    g.restore();
  }
  function bigLeft(g, id, y, size, col) { var l = L(id); if (l && T > l.start - .1 && T < l.end + .5) bigLine(g, l, { x: 110, y: y, w: 900 }, { size: size || 92, col: col }); }

  // 01 HOOK — big words left, the rival's ML team doubling right, Fin at his desk
  S.hook = function (g, sc) {
    var l1 = L("hook1"), l2 = L("hook2"), l3 = L("hook3");
    g.drawImage(paper("hook", C.navy, [C.navy2, "#4b3f7a", "#26304f", C.teal], 11), 0, 0);
    inkRR(g, 1080, 90, 260, 220, 14, "#20264a", 6); g.fillStyle = C.cream; g.beginPath(); g.arc(1170, 160, 30, 0, TAU); g.fill();
    for (var s = 0; s < 8; s++) { g.fillStyle = hexa(C.cream, .5 + .5 * Math.sin(T * 3 + s)); g.fillRect(1100 + hash(s) * 210, 110 + hash(s * 3) * 170, 4, 4); }
    // rival tower doubling on "doubled"
    var d = wt("hook1", ["doubled"]), grow = eBack(prog(T, d - .1, .7)), base = 1000;
    tower(g, 1420, base, 380, lerp(320, 760, grow), "RIVAL CO.", .3 + .6 * grow, "#5b6aa8");
    for (var b = 0; b < 8; b++) {
      var pop = eBack(prog(T, (b < 4 ? l1.start : d) + (b % 4) * .1, .3)); if (pop <= 0) continue;
      g.save(); g.translate(1450 + (b % 4) * 100 + (b >= 4 ? 40 : 0), base - 10 - (b >= 4 ? 0 : 0) + (b >= 4 ? 30 : -20)); g.scale(pop * .48, pop * .48);
      inkRR(g, -40, -60, 80, 70, 16, b >= 4 ? C.orange : "#b9b2d8", 5); inkCircle(g, -14, -30, 7, C.ink, 2); inkCircle(g, 14, -30, 7, C.ink, 2);
      txt(g, "ML", 0, -78, 26, { align: "center", fill: C.cream, stroke: C.ink, sw: 5 }); g.restore();
    }
    sfxWord(g, "x2!", 1760, 300, d + .1, 130, C.yellow, .12);
    // calendar flips to Q4 on "quarter"
    if (T > l2.start - .2) {
      var q = wt("hook2", ["quarter"]), flips = Math.floor(clamp((T - l2.start) / ((q - l2.start) / 3), 0, 3));
      g.save(); g.translate(1180, 560); g.rotate(-.06); g.scale(eBack(prog(T, l2.start - .2, .4)), eBack(prog(T, l2.start - .2, .4)));
      inkRR(g, -110, -120, 220, 240, 14, C.cream, 6); g.fillStyle = C.red; g.fillRect(-107, -117, 214, 56);
      txt(g, "NEXT QUARTER", 0, -80, 24, { align: "center", fill: C.cream }); txt(g, ["Q1", "Q2", "Q3", "Q4"][flips], 0, 70, 110, { align: "center", fill: flips === 3 ? C.red : C.ink });
      g.restore();
      fin(g, 860, 820, .95, { worry: true, sweat: T > q });
    }
    // Radar bursts in on line 3, dish pinging
    var up = eBack(prog(T, l3.start - .1, .45));
    if (up > 0) { radar(g, 940, lerp(1400, 800, up), 1.2, { ping: l3.start + .3, expr: "wow" }); sfxWord(g, "PING!", 1180, 330, wt("hook3", ["first"]), 120, C.yellow, -.1); }
    var cl = lineAt(T); if (cl && cl.scene === "hook") bigLine(g, cl, { x: 100, y: 180, w: 860 }, { size: 112 });
  };

  // 02 TITLE — the radar scope finds the real competitors; the logo bounces in; three promises
  S.title = function (g, sc) {
    var l = L("title1");
    g.drawImage(paper("title", "#f6d9b8", ["#f7b2a0", "#ffd98a", "#f6a6c1", "#fff1c9"], 23), 0, 0);
    g.save(); g.translate(1320, 540); g.rotate(T * .05);
    for (var r = 0; r < 18; r++) { g.fillStyle = hexa(r % 2 ? "#ffd98a" : "#f7b2a0", .3); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1400, r / 18 * TAU, (r + .5) / 18 * TAU); g.fill(); }
    g.restore();
    var cx = 1320, cy = 520, R = 330, ap = eOut(prog(T, sc.start, .5));
    g.save(); g.globalAlpha = ap; inkCircle(g, cx, cy, R, "rgba(44,50,96,.9)", 6);
    for (var k = 1; k < 4; k++) { g.strokeStyle = "rgba(247,239,225,.25)"; g.lineWidth = 2; g.beginPath(); g.arc(cx, cy, R * k / 4, 0, TAU); g.stroke(); }
    var sw = T * 2.4;
    for (var j = 0; j < 30; j++) { g.strokeStyle = hexa(C.green, .5 * (1 - j / 30)); g.lineWidth = 3; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(sw - j * .03) * R, cy + Math.sin(sw - j * .03) * R); g.stroke(); }
    (RUN.competitors || []).forEach(function (c, i) {
      var a = -PI / 2 + i / 5 * TAU + .4, rr = R * (.45 + hash(i) * .4), bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr;
      var glow = Math.exp(-(((sw - a) % TAU + TAU) % TAU) * 1.2);
      g.fillStyle = hexa(C.green, .6 + .4 * glow); g.beginPath(); g.arc(bx, by, 9 + glow * 6, 0, TAU); g.fill();
      txt(g, c.name, bx + 16, by + 8, 24, { fill: C.cream, weight: 600 });
    });
    g.restore();
    var letters = "SPEND RADAR".split(""), lx = 100, size = 150, at = wt("title1", ["radar"], .15);
    letters.forEach(function (ch, i) {
      var kk = eElastic(prog(T, at - .35 + i * .05, .8)), w = measure(ch, size); if (kk <= 0) { lx += w + 4; return; }
      txt(g, ch, lx + w / 2, 330 + Math.sin(T * 4 + i * .6) * 6, size, { align: "center", fill: i < 5 ? C.cream : C.yellow, stroke: C.ink, sw: 22, scale: kk, shadow: C.ink, sx: 8, sy: 10 });
      lx += w + 4;
    });
    txt(g, "team qwep · neatHack 2026", 106, 400, 34, { fill: C.ink, weight: 600 });
    [["reads your books", wt("title1", ["books"]), C.mint], ["checks the market", wt("title1", ["market"]), C.sky], ["tries to prove itself wrong", wt("title1", ["wrong"]), C.rose]].forEach(function (p, i) {
      var kk = eBack(prog(T, p[1] - .15, .35)); if (kk <= 0) return;
      g.save(); g.translate(110, 470 + i * 112); g.scale(kk, kk);
      inkRR(g, 0, 0, measure(p[0], 50) + 100, 88, 44, p[2], 5); txt(g, (i + 1) + ". " + p[0], 30, 60, 50, { fill: C.ink, weight: 700 }); g.restore();
    });
    sfxWord(g, "?!", 1660, 220, wt("title1", ["wrong"]) + .1, 150, C.red, .14);
    radar(g, 1640, 860, .9, { wave: T < l.start + 2.2, bounce: false, expr: T > wt("title1", ["wrong"]) ? "wow" : "happy" });
    caption(g, sc, null);
  };

  // 03 A REAL RUN — seven quick stations, one per line, real values from run 1011-777bb7
  S.run = function (g, sc) {
    var r1 = L("run1"), r2 = L("run2"), r3 = L("run3"), r4 = L("run4"), r5 = L("run5"), r6 = L("run6"), r7 = L("run7");
    var tasks = RUN.tasks || [], comps = RUN.competitors || [], dec = (RUN.decisions || [])[0] || {};
    if (T < r2.start - .05) { // clapperboard: a real run
      g.drawImage(paper("run1", "#2c3260", [C.navy2, "#4b3f7a", C.teal], 201), 0, 0);
      var ck = eBack(prog(T, r1.start, .4)), snap = prog(T, r1.start + .35, .12);
      g.save(); g.translate(1340, 520); g.rotate(-.08); g.scale(ck, ck);
      inkRR(g, -330, -150, 660, 360, 16, "#2a2433", 6);
      g.save(); g.translate(-330, -150); g.rotate(-.5 * (1 - snap)); inkRR(g, 0, -70, 660, 70, 8, C.cream, 6);
      for (var z = 0; z < 6; z++) inkPath(g, [[20 + z * 110, -70], [80 + z * 110, -70], [40 + z * 110, 0], [-20 + z * 110, 0]], true, C.ink, false); g.restore();
      txt(g, "RUN " + RUN.run_id, -290, -50, 64, { font: MONO, weight: 500, fill: C.cream });
      txt(g, (RUN.company || "") + " (fictional)", -290, 30, 36, { fill: C.cream, weight: 600 });
      txt(g, "DATA: REAL", -290, 120, 52, { font: COMIC, weight: 400, fill: C.green, ls: 3 });
      g.restore();
      sfxWord(g, "CLAP!", 1640, 260, r1.start + .4, 120, C.yellow, .1);
      radar(g, 360, 840, 1.0, { expr: "wow", bounce: false, wave: true });
      bigLeft(g, "run1", 160, 110);
      return;
    }
    if (T < r4.start - .05) { // plan + tool calls on the left; the real site's run replay on a monitor
      g.drawImage(paper("run2", C.teal, [C.teal2, "#25605c", "#5fb3a8", "#2f6a86"], 37), 0, 0);
      inkRR(g, -20, 930, W + 40, 200, 0, "#d9c7a5", 6);
      inkRR(g, 90, 140, 600, 740, 22, C.cream, 6);
      txt(g, "PLAN", 390, 215, 64, { align: "center", font: COMIC, weight: 400, fill: C.red, ls: 4 });
      txt(g, "written by gpt-5-nano", 390, 255, 26, { align: "center", font: MONO, weight: 500, fill: "#6a6170" });
      var kinds = [["read_budget", "budget"], ["read_policy", "policy"], ["read_salary_table", "salaries"], ["read_invoice", "invoices"], ["fetch_competitor", "crust"], ["fetch_jobs", "crust"], ["classify_titles", "crust"]];
      kinds.forEach(function (kd, i) {
        var n = tasks.filter(function (x) { return x.tool === kd[0]; }).length;
        var on = T > r2.start + .3 + i * .12, done = T > wt("run3", [kd[1], kd[1] + "data"], .2 + i * .1) - .05;
        var y = 330 + i * 76;
        inkRR(g, 130, y - 32, 40, 40, 8, done ? C.mint : C.white, 4); if (done) inkPath(g, [[137, y - 14], [148, y - 2], [165, y - 26]], false, null, null, 5);
        if (on) txt(g, kd[0] + (n > 1 ? "  ×" + n : ""), 190, y, 32, { font: MONO, weight: 500, fill: C.ink });
      });
      txt(g, tasks.length + " tool calls", 390, 860, 40, { align: "center", fill: C.indigoD, weight: 700 });
      // the real Run page of the evidence site, replaying
      var tc = T - r2.start; needClip("run", tc + .5);
      monitor(g, 1230, 430, 900, "run", tc + .5, { rot: .02, scale: eBack(prog(T, r2.start - .05, .45)), zoom: 1.25, focusX: .3, focusY: .4 });
      // Crustdata: real headcount bubbles out of Radar's dish
      if (T > r3.start + r3.dur * .45) {
        var cs = wt("run3", ["headcount"], .55);
        comps.forEach(function (c, i) {
          var kk = eBack(prog(T, cs + i * .12, .35)); if (kk <= 0) return;
          g.save(); g.translate(880 + i * 205, 860 - Math.sin(i) * 20); g.scale(kk, kk); g.rotate((hash(i) - .5) * .12);
          inkRR(g, -95, -62, 190, 124, 30, C.cream, 5); txt(g, c.name, 0, -18, 24, { align: "center", fill: C.ink, weight: 600 });
          txt(g, fmtN(c.headcount), 0, 38, 48, { align: "center", fill: C.mintD }); g.restore();
        });
        sfxWord(g, "PING!", 1720, 680, cs, 90, C.yellow, .12);
      }
      radar(g, 760, 820, .7, { ping: wt("run3", ["headcount"], .55), dish: -.4, expr: "happy" });
      caption(g, sc, null);
      return;
    }
    if (T < r5.start - .05) { // Python checks: 71 ticks, then the budget row that doesn't add up
      g.drawImage(paper("run4", "#f4d3b5", ["#f2b08e", "#f6c99b", "#e9a3a0", "#fbe3c1"], 51), 0, 0);
      var res = RUN.check_results || [], n71 = res.length, ok = 0;
      txt(g, "PYTHON CHECKS", 110, 170, 76, { font: COMIC, weight: 400, fill: C.indigoD, ls: 3 });
      res.forEach(function (p, i) {
        var kk = eBack(prog(T, r4.start + .15 + i * .022, .25)); if (kk <= 0) return; ok++;
        var x = 120 + (i % 18) * 52, y = 220 + Math.floor(i / 18) * 52;
        g.save(); g.translate(x + 20, y + 20); g.scale(kk, kk); inkRR(g, -20, -20, 40, 40, 8, p ? C.green : C.red, 3); g.restore();
      });
      var bad = res.filter(function (p, i) { return !p && i < ok; }).length; txt(g, ok + " checks", 1100, 290, 110, { fill: C.ink, stroke: C.cream, sw: 14 }); if (bad) txt(g, bad + " ✗", 1100, 400, 90, { fill: C.red, stroke: C.cream, sw: 12 });
      var uh = wt("run4", ["fails"], .6);
      if (T > uh - .3) {
        var sk = eBack(prog(T, uh - .3, .4)), shk = T < uh + .5 ? (hash(BF) - .5) * 14 : 0;
        g.save(); g.translate(560 + shk, 690); g.rotate(-.04); g.scale(sk, sk);
        inkRR(g, -460, -130, 920, 260, 16, C.white, 6);
        txt(g, "budget_fy27.xlsx  People!row 10", -420, -70, 34, { font: MONO, weight: 500, fill: C.ink });
        var fc = ((RUN.failed_checks || [])[0] || {}).detail || dec.check || "", m = /sum ([\d,.]+) vs stated ([\d,.]+) \(([\d.]+% off)\)/.exec(fc) || [0, "", "", ""];
        txt(g, "line items " + m[1].replace(/\.00$/, ""), -420, 0, 40, { font: MONO, weight: 500, fill: C.ink });
        txt(g, "stated     " + m[2].replace(/\.00$/, ""), -420, 56, 40, { font: MONO, weight: 500, fill: C.red });
        txt(g, m[3], 330, 30, 64, { align: "center", font: COMIC, weight: 400, fill: C.red });
        g.restore();
        sfxWord(g, "UH-OH!", 1240, 560, uh, 140, C.red, -.1);
      }
      fin(g, 1640, 760, 1.0, { worry: T > uh, sweat: T > uh + .2 });
      caption(g, sc, null);
      return;
    }
    if (T < r6.start - .05) { // the decision: the rule's card vs the model's card
      g.drawImage(paper("run5", "#e7dcf6", ["#c4b4ee", "#efe6ff", "#b6c8f0", "#f3d9ef"], 63), 0, 0);
      txt(g, "decide:recovery", 110, 160, 64, { font: MONO, weight: 500, fill: C.indigoD });
      var ruleT = wt("run5", ["rule"], .1), pick = wt("run5", ["reread", "re", "read"], .6);
      (dec.options || []).forEach(function (o, i) {
        var isRule = o === dec.default, isPick = o === dec.chosen;
        var kk = eBack(prog(T, r5.start + .1 + i * .1, .4)); if (kk <= 0) return;
        var lift = isPick ? eBack(prog(T, pick, .35)) * 120 : (isRule && T > ruleT && T < pick + .2 ? 50 : 0);
        var x = 520 + i * 330, y = 600 - lift;
        g.save(); g.translate(x, y + (1 - kk) * 300); g.rotate((i - 1) * .1);
        inkRR(g, -140, -200, 280, 400, 22, isPick && T > pick ? C.indigo : isRule && T > ruleT && T < pick ? C.yellow : C.cream, 6);
        g.save(); g.rotate(-PI / 2); txt(g, o, 0, 12, o.length > 14 ? 28 : 36, { align: "center", font: MONO, weight: 500, fill: C.ink }); g.restore();
        if (isRule) txt(g, "RULE", 0, 250, 34, { align: "center", font: COMIC, weight: 400, fill: C.ink, ls: 3 });
        g.restore();
      });
      // the rule-bot holds up the default; Radar grabs the other card
      g.save(); g.translate(1600, 760); inkRR(g, -90, -120, 180, 200, 30, "#b9b2d8", 6); inkCircle(g, -32, -50, 12, C.ink, 3); inkCircle(g, 32, -50, 12, C.ink, 3);
      inkLine(g, -28, 10, 28, 10, 6); txt(g, "RULE", 0, -140, 40, { align: "center", font: COMIC, weight: 400, fill: C.ink, ls: 3 }); g.restore();
      radar(g, 250, 820, 1.0, { expr: T > pick ? "proud" : "squint", armR: T > pick ? -1.2 : 0 });
      stamp(g, "OVERRIDE!", 860, 250, pick + .25, C.indigoD, 96, -.1);
      sfxWord(g, "YOINK!", 1250, 300, pick, 110, C.orange, .1);
      caption(g, sc, null);
      return;
    }
    if (T < r7.start - .05) { // scanned PDF read another way; corrupt PDF flagged
      g.drawImage(paper("run6", "#f6dfcf", ["#f7b8a8", "#ffd9a0", "#f3a9b8", "#fff0d0"], 67), 0, 0);
      var scn = wt("run6", ["scanned"], .05), cor = wt("run6", ["corrupt"], .5);
      var t15 = tasks.filter(function (x) { return x.id === "t15"; })[0] || {}, na = (RUN.not_analysed || [])[0] || {};
      [[scn, t15.target, false], [cor, na.input, true]].forEach(function (p, i) {
        var kk = eBack(prog(T, p[0] - .1, .45)); if (kk <= 0) return;
        g.save(); g.translate(500 + i * 900, 470); g.rotate(i ? .06 : -.06); g.scale(kk, kk);
        inkRR(g, -170, -220, 340, 440, 12, p[2] ? C.white : "#d9d4cc", 6);
        for (var rr = 0; rr < 8; rr++) inkLine(g, -120, -150 + rr * 40, 120, -150 + rr * 40, 3, p[2] ? C.ink : "rgba(42,36,51,.25)");
        if (p[2]) inkPath(g, [[-20, -220], [30, -100], [-40, -10], [40, 100], [0, 220]], false, null, C.red, 9);
        txt(g, String(p[1] || "").replace("invoices/", ""), 0, 270, 30, { align: "center", font: MONO, weight: 500, fill: C.ink, stroke: C.cream, sw: 8 });
        g.restore();
        if (!p[2] && T > p[0] + .6) { stamp(g, "READ ✓", 500, 470, p[0] + .6, C.mintD, 80, -.12); }
        if (p[2] && T > p[0] + .9) { stamp(g, "NOT ANALYSED", 1400, 470, p[0] + .9, C.red, 64, .1); }
      });
      sfxWord(g, "SCAN!", 520, 170, scn + .3, 90, C.sky, -.08);
      sfxWord(g, "CRACK!", 1420, 170, cor + .1, 100, C.red, .1);
      audy(g, 960, 860, .7, { point: T > scn + .3, squint: T < scn + .3 });
      caption(g, sc, null);
      return;
    }
    // 5 of 10 recovery calls beat the rule
    g.drawImage(paper("run7", "#ffe6a8", ["#ffd98a", "#ffc28a", "#f7b2a0", "#fff1c9"], 211), 0, 0);
    var beat = wt("run7", ["beat"], .7);
    (RUN.decisions || []).forEach(function (d, i) {
      var x = 1150 + (i % 5) * 150, y = 330 + Math.floor(i / 5) * 260, kk = eBack(prog(T, r7.start + i * .06, .35)); if (kk <= 0) return;
      var win = d.overrode && T > beat - .2, fl = win ? eBack(prog(T, beat - .2 + i * .05, .35)) : 0;
      g.save(); g.translate(x, y - fl * 30); g.scale(kk * (1 + fl * .08), kk); g.rotate((hash(i) - .5) * .1);
      inkRR(g, -70, -100, 140, 200, 16, win ? C.yellow : C.cream, 5);
      txt(g, d.task, 0, -60, 24, { align: "center", font: MONO, weight: 500, fill: "#6a6170" });
      g.save(); g.rotate(-PI / 2); txt(g, d.chosen, 0, 8, 22, { align: "center", font: MONO, weight: 500, fill: C.ink }); g.restore();
      if (win) txt(g, "★", 0, 88, 40, { align: "center", fill: C.orange, stroke: C.ink, sw: 5 });
      g.restore();
    });
    radar(g, 1400, 900, .65, { expr: "proud", wave: T > beat });
    bigLeft(g, "run7", 220, 96);
  };

  // 04 SELF-AUDIT — curtains, the $5.28M claim, Audy shouts, OVERTURNED on the word, claim kept out of the report
  S.audit = function (g, sc) {
    var a1 = L("aud1"), a2 = L("aud2"), a3 = L("aud3"), a4 = L("aud4");
    g.drawImage(paper("aud", "#f6dfcf", ["#f7b8a8", "#ffd9a0", "#f3a9b8", "#fff0d0"], 67), 0, 0);
    inkRR(g, -20, 860, W + 40, 260, 0, "#d79a62", 6);
    for (var p = 0; p < 12; p++) inkLine(g, p * 170, 862, p * 170 - 80, 1080, 3, "rgba(42,36,51,.4)");
    var open = eInOut(prog(T, a1.start + .1, .8)), ov = wt("aud3", ["overturned"], .75);
    if (T > a2.start - .2) { // confidence gauge drains to the computed 0.00
      var gx = 1560, gy = 220, drain = eInOut(prog(T, wt("aud3", ["argued"], .2), 1.0)), lvl = lerp(.62, 0, drain);
      inkRR(g, gx - 34, gy, 68, 520, 34, C.cream, 6); g.fillStyle = lvl > .3 ? C.green : C.red;
      g.fillRect(gx - 20, gy + 14 + 472 * (1 - lvl), 40, 472 * lvl);
      inkCircle(g, gx, gy + 560, 54, lvl > .3 ? C.green : C.red, 6);
      txt(g, drain >= 1 ? "0.00" : lvl.toFixed(2), gx, gy + 574, 34, { align: "center", fill: C.cream, stroke: C.ink, sw: 7 });
      txt(g, "CONFIDENCE", gx, gy - 20, 34, { align: "center", font: COMIC, weight: 400, fill: C.ink, ls: 3 });
    }
    if (T > a2.start - .2) {
      radar(g, 430, 770, 1.0, { expr: T > ov ? "wow" : "proud", bounce: false });
      var k = eBack(prog(T, wt("aud2", ["million", "528", "5.28"], .45) - .2, .45));
      if (k > 0) {
        g.save(); g.translate(800, 300); g.scale(k, k);
        inkPath(g, [[-340, -120], [340, -120], [340, 110], [-120, 110], [-200, 200], [-180, 110], [-340, 110]], true, C.white, null, 7);
        txt(g, "$5,280,000", 0, 30, 118, { align: "center", fill: T > ov ? "#b9a9a9" : C.red, stroke: C.ink, sw: 16 });
        txt(g, "ML/AI GAP · PER YEAR · ACME", 0, 86, 30, { align: "center", font: MONO, weight: 500, fill: C.ink });
        var strike = prog(T, ov + .05, .3);
        if (strike > 0) { g.strokeStyle = C.red; g.lineWidth = 16; g.lineCap = "round"; g.beginPath(); g.moveTo(-300, 0); g.lineTo(-300 + 600 * eOut(strike), -10); g.stroke(); }
        g.restore();
      }
    }
    if (T > a3.start - .3) {
      var inA = eBack(prog(T, a3.start - .3, .5));
      audy(g, lerp(2200, 1180, inA), 760, 1.0, { squint: T < ov - .4, point: T > ov - .4, shout: T > ov - .4 && T < a3.end });
      sfxWord(g, "HOLD ON!", 1160, 430, wt("aud3", ["argued"], .2), 96, C.indigo, .1);
    }
    stamp(g, "OVERTURNED", 800, 560, ov, C.red, 110, -.14);
    sfxWord(g, "SLAM!", 1300, 840, ov + .05, 130, C.red);
    if (T > a4.start - .2) { // the report: claim sent to "Overturned claims"
      var rk = eBack(prog(T, a4.start - .2, .45));
      g.save(); g.translate(960, 520); g.scale(rk, rk); g.rotate(-.02);
      inkRR(g, -520, -330, 1040, 660, 14, C.white, 6);
      txt(g, "Spend Radar report · run " + RUN.run_id, -480, -260, 34, { fill: C.ink });
      (RUN.report_rows || []).slice(0, 7).forEach(function (row, i) {
        txt(g, row.area, -480, -190 + i * 56, 26, { font: MONO, weight: 500, fill: "#6a6170" });
        txt(g, (row.refs.length ? "[" + row.refs.slice(0, 3).join("][") + "]" : ""), 200, -190 + i * 56, 24, { font: MONO, weight: 500, fill: C.indigoD });
        txt(g, row.audit, 470, -190 + i * 56, 26, { align: "right", fill: C.mintD, weight: 600 });
      });
      txt(g, "OVERTURNED CLAIMS", -480, 250, 30, { font: MONO, weight: 500, fill: C.red });
      txt(g, "ML/AI · ≈ $5,280,000 a year", -480, 295, 30, { fill: "#9a8f9f" }); g.strokeStyle = C.red; g.lineWidth = 4; g.beginPath(); g.moveTo(-480, 285); g.lineTo(-480 + 430 * prog(T, a4.start + .4, .3), 285); g.stroke();
      g.restore();
    }
    [0, 1].forEach(function (side) {
      var w = lerp(W / 2 + 40, 140, open), x = side ? W - w : 0;
      inkRR(g, x - (side ? 0 : 20), -20, w + 20, H + 40, 0, "#c0393b", 6);
      for (var f = 0; f < 6; f++) inkLine(g, x + (f + .5) * w / 6, 0, x + (f + .5) * w / 6 + Math.sin(T + f) * 8, H, 4, "rgba(42,36,51,.35)");
    });
    var cl = lineAt(T);
    if (cl && cl.id === "aud1") bigLine(g, cl, { x: 0, y: 360, w: W }, { size: 130, align: "center" });
    else if (cl && cl.id === "aud4") bigLine(g, cl, { x: 60, y: 880, w: W - 120 }, { size: 74, align: "center" });
    else caption(g, sc, null);
  };

  // 05 HELD-OUT — seven company cards (real latest-run scores), "0 FALSE ALARMS"
  S.general = function (g, sc) {
    var g1 = L("gen1"), g2 = L("gen2");
    g.drawImage(paper("gen", "#cfe9f0", ["#a9d6e5", "#e7f5f8", "#9cc9e0", "#f0e2c8"], 83), 0, 0);
    var six = wt("gen1", ["six", "6"], .55), caught = wt("gen2", ["caught"], .3);
    (FX.companies || []).forEach(function (c, i) {
      var col = i % 4, row = Math.floor(i / 4), x = 110 + col * 440 + (row ? 220 : 0), y = 140 + row * 330;
      var k = eBack(prog(T, g1.start + i * .09, .4)); if (k <= 0) return;
      g.save(); g.translate(x + 200, y + 140); g.scale(k, k); g.rotate((hash(i) - .5) * .06);
      inkRR(g, -200, -140, 400, 280, 24, c.role === "held_out" ? C.cream : "#fff1d6", 6);
      inkCircle(g, -150, -88, 30, C.ink, 4); txt(g, c.name.charAt(0), -150, -76, 34, { align: "center", fill: C.cream });
      txt(g, c.name.replace(" Inc.", ""), -106, -84, 30, { fill: C.ink }); txt(g, c.industry, -106, -50, 22, { fill: "#6a6170", weight: 500 });
      if (c.role === "held_out" && T > six - .1) { var hk = eBack(prog(T, six + i * .05, .3)); g.save(); g.translate(120, -150); g.rotate(.12); g.scale(hk, hk); inkRR(g, -80, -22, 160, 44, 10, C.indigo, 4); txt(g, "HELD-OUT", 0, 12, 24, { align: "center", font: MONO, weight: 500, fill: C.ink }); g.restore(); }
      var L2 = c.latest || {};
      for (var p = 0; p < (L2.total || 0); p++) {
        var sk = eBack(prog(T, caught - .2 + i * .08 + p * .04, .3));
        inkRR(g, -170 + p * 58, -6, 48, 48, 10, sk > 0 ? C.green : "rgba(0,0,0,.08)", 4);
        if (sk > 0) { g.save(); g.translate(-146 + p * 58, 18); g.scale(sk, sk); inkPath(g, [[-11, 0], [-3, 9], [12, -10]], false, null, C.white, 6); g.restore(); }
      }
      txt(g, L2.caught + " / " + L2.total, 170, 110, 44, { align: "right", fill: T > caught + .3 ? C.mintD : "#9a92a0" });
      g.restore();
    });
    stamp(g, "0 FALSE ALARMS", 1640, 770, wt("gen2", ["zero", "0"], .7), C.mintD, 54, .06);
    radar(g, 230, 900, .7, { expr: T > caught ? "proud" : "happy" });
    var cl = lineAt(T);
    if (cl && cl.id === "gen2") bigLine(g, cl, { x: 380, y: 800, w: 980 }, { size: 68 }); else caption(g, sc, null);
  };

  // 06 NEATLOGS — real span waterfall, magnifier on case study 02, the 3 → 1 verdict dice (case study 05)
  S.neatlogs = function (g, sc) {
    var n1 = L("nl1"), n2 = L("nl2"), n3 = L("nl3");
    g.drawImage(paper("nl", "#1f2440", ["#2c3260", "#3b2f5a", "#22364f", "#2f4a5c"], 97), 0, 0);
    txt(g, "neatlogs", 110, 150, 92, { fill: C.cream, stroke: C.ink, sw: 12 });
    if (T < n3.start - .05) {
      txt(g, "trace af0df27e… · run 1010-b31657 · case study 02", 115, 200, 28, { font: MONO, weight: 500, fill: "#a8aac4" });
      var spans = [["plan", 0, .1], ["act:read_budget", .1, .06], ["verify:totals", .16, .03], ["act:fetch_competitor", .2, .1], ["decide:recovery", .3, .05, 1], ["act:fetch_jobs", .35, .08],
        ["decide:recovery", .43, .05, 1], ["act:classify_titles", .48, .12], ["decide:recovery", .6, .05, 1], ["audit:f_ml_ai", .72, .1], ["report", .86, .1]];
      spans.forEach(function (s, i) {
        var y = 260 + i * 50, k = prog(T, n1.start + .1 + i * .07, .35), x0 = 560 + s[1] * 1150, w = s[2] * 1150 * eOut(k);
        if (k <= 0) return;
        txt(g, s[0], 520, y + 28, 26, { align: "right", font: MONO, weight: 500, fill: s[3] ? C.yellow : "#cfd0e6" });
        inkRR(g, x0, y + 6, Math.max(8, w), 30, 8, s[3] ? C.orange : C.teal2, 3);
      });
      var three = wt("nl2", ["three", "3"], .2), fix = wt("nl2", ["fix"], .45), cut = wt("nl2", ["dropped"], .75);
      if (T > n2.start) {
        var mk = eOut(prog(T, n2.start, .4));
        g.save(); g.globalAlpha = mk; inkCircle(g, 1480, 560, 230, "rgba(20,24,48,.94)", 8);
        if (T < fix) {
          txt(g, "substitute_competitor", 1480, 450, 27, { align: "center", font: MONO, weight: 500, fill: C.orange });
          ["Honeycomb", "Arize", "Chronosphere"].forEach(function (nm, i) { var fly = prog(T, three + .2 + i * .2, .5); txt(g, "✗ " + nm, 1480 + fly * 260 * (i - 1), 520 + i * 56 - fly * 160, 38, { align: "center", fill: C.red, weight: 700 }); });
          txt(g, "→ New Relic (3,095)", 1480, 700, 30, { align: "center", fill: C.cream, weight: 600 }); txt(g, "→ Datadog (10,482)", 1480, 740, 30, { align: "center", fill: C.cream, weight: 600 });
        } else {
          (RUN.competitors || []).forEach(function (c, i) { txt(g, "✓ " + c.name, 1480, 430 + i * 50, 34, { align: "center", fill: C.green, weight: 700 }); });
          var cr = lerp(26.6, 5.4, eOut(prog(T, cut, .8)));
          txt(g, "credits " + cr.toFixed(1), 1480, 720, 46, { align: "center", fill: C.yellow, weight: 700 });
        }
        g.restore(); inkLine(g, 1640, 720, 1780, 870, 22, C.ink);
        sfxWord(g, "YOINK!", 1220, 300, three + .4, 100, C.orange, -.12);
        sfxWord(g, "FIXED!", 1700, 250, fix + .2, 100, C.green, .1);
      }
      radar(g, 250, 880, .7, { expr: T > n2.start && T < fix ? "squint" : "happy" });
    } else {
      txt(g, "case study 05 · same Acme data · 5 identical runs per side", 115, 200, 28, { font: MONO, weight: 500, fill: "#a8aac4" });
      var one = wt("nl3", ["one", "1"], .8), before = (FX.case05 || {}).before || [], after = (FX.case05 || {}).after || [];
      var COL = { confirmed: C.green, overturned: C.red, downgraded: C.yellow };
      before.forEach(function (v, i) {
        var land = T > one + i * .08, spin = land ? eBack(prog(T, one + i * .08, .4)) : 0, cur = land ? after[i] : v;
        var k = eBack(prog(T, n3.start + i * .1, .4)); if (k <= 0) return;
        g.save(); g.translate(330 + i * 315, 560 + (land ? 0 : Math.sin(T * 9 + i) * 14)); g.scale(k, k); g.rotate(land ? (1 - spin) * TAU : Math.sin(T * 6 + i) * .15);
        inkRR(g, -125, -125, 250, 250, 30, COL[cur] || C.cream, 6);
        txt(g, "run " + (i + 1), 0, -70, 26, { align: "center", font: MONO, weight: 500, fill: C.ink }); txt(g, cur, 0, 20, 36, { align: "center", fill: C.ink, weight: 700 });
        g.restore();
      });
      var big = T < one ? "3 verdicts" : "1 verdict";
      txt(g, big, 960, 870, 110, { align: "center", font: COMIC, weight: 400, fill: T < one ? C.red : C.yellow, stroke: C.ink, sw: 14, ls: 4 });
      sfxWord(g, "CLICK!", 1650, 300, one, 100, C.yellow, .1);
    }
    caption(g, sc, null);
  };

  // 07 ENTIRE — commits fall in with checkpoint stickers; a detective board traces span → code → commit → prompt; runner-bots catch 2 bugs
  S.entire = function (g, sc) {
    var e1 = L("ent1"), e2 = L("ent2"), e3 = L("ent3"), X2 = FX.explain || {};
    g.drawImage(paper("ent", "#dcd1f3", ["#c4b4ee", "#efe6ff", "#b6c8f0", "#f3d9ef"], 113), 0, 0);
    txt(g, "Entire", 110, 160, 92, { fill: C.ink });
    if (T < e2.start - .05) {
      (FX.commits || []).slice(0, 6).forEach(function (c, i) {
        var t0 = e1.start + i * .25, k = eOut(prog(T, t0, .4)); if (k <= 0) return;
        var y = lerp(-200, 900 - i * 112, k), x = 620 + (hash(i * 3) - .5) * 60;
        g.save(); g.translate(x, y); g.rotate((hash(i * 7) - .5) * .1);
        inkRR(g, -460, -50, 920, 100, 14, C.cream, 5);
        txt(g, c.sha, -430, 12, 28, { font: MONO, weight: 500, fill: C.indigoD }); txt(g, c.subject.slice(0, 44) + (c.subject.length > 44 ? "…" : ""), -290, 12, 27, { fill: C.ink, weight: 600 });
        var sk = eBack(prog(T, t0 + .25, .3)); if (sk > 0) { g.save(); g.translate(400, -44); g.scale(sk, sk); g.rotate(.2); inkRR(g, -100, -26, 200, 52, 12, C.yellow, 4); txt(g, c.checkpoint.slice(0, 10) + "…", 0, 9, 20, { align: "center", font: MONO, fill: C.ink }); g.restore(); }
        g.restore();
      });
      var bk = eBack(prog(T, wt("ent1", ["sixtynine", "sixty", "69"], .7) - .1, .45));
      if (bk > 0) { g.save(); g.translate(1520, 520); g.scale(bk, bk); txt(g, String(FX.checkpoints), 0, 0, 260, { align: "center", fill: C.yellow, stroke: C.ink, sw: 28, shadow: C.ink, sx: 8, sy: 10 }); txt(g, "checkpoints", 0, 80, 54, { align: "center", fill: C.ink }); g.restore(); }
      radar(g, 1700, 900, .55, { expr: "happy", bounce: false });
    } else if (T < e3.start - .05) {
      // detective board with red string
      inkRR(g, 80, 220, 1760, 640, 20, "#c79a6a", 6);
      for (var hx = 0; hx < 40; hx++) { g.fillStyle = "rgba(90,60,30,.12)"; g.fillRect(100 + hash(hx) * 1720, 240 + hash(hx * 3) * 600, 6, 6); }
      var nodes = [["neatlogs span", "decide:recovery", wt("ent2", ["trace"], .1)], ["code line", X2.code, wt("ent2", ["code"], .45)], ["commit", X2.commit, wt("ent2", ["commit"], .6)], ["checkpoint", (X2.checkpoint || "").slice(0, 14) + "…", wt("ent2", ["commit"], .6) + .35], ["the prompt", "“/grill-me # CLAUDE.md…”", wt("ent2", ["prompt"], .85)]];
      var pos = [[300, 420], [700, 660], [1050, 400], [1380, 650], [1620, 400]];
      nodes.forEach(function (n, i) {
        var k = eBack(prog(T, n[2] - .15, .35));
        if (i > 0 && k > 0) { var a = pos[i - 1], b = pos[i], s2 = eOut(prog(T, n[2] - .25, .3)); g.strokeStyle = C.red; g.lineWidth = 6; g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(lerp(a[0], b[0], s2), lerp(a[1], b[1], s2) + Math.sin(s2 * PI) * 30); g.stroke(); }
        if (k <= 0) return;
        g.save(); g.translate(pos[i][0], pos[i][1]); g.rotate((hash(i * 5) - .5) * .14); g.scale(k, k);
        inkRR(g, -170, -80, 340, 160, 8, i === 4 ? "#fff3b0" : C.white, 5);
        txt(g, n[0].toUpperCase(), 0, -34, 22, { align: "center", font: MONO, weight: 500, fill: "#6a6170" });
        txt(g, n[1], 0, 22, i === 4 ? 24 : 30, { align: "center", font: i === 4 ? FONT : MONO, weight: i === 4 ? 600 : 500, fill: C.ink });
        inkCircle(g, 0, -80, 12, C.red, 4);
        g.restore();
      });
      fin(g, 1760, 860, .6, { worry: false });
      sfxWord(g, "AHA!", 1640, 220, wt("ent2", ["prompt"], .85) + .2, 100, C.yellow, .1);
    } else {
      // six runner-bots; two catch bugs
      var bug = wt("ent3", ["bugs", "two", "2"], .6), merged = wt("ent3", ["merge", "merged"], .9);
      (FX.runners || []).forEach(function (r, i) {
        var k = eBack(prog(T, e3.start + i * .07, .35)); if (k <= 0) return;
        var x = 200 + i * 300, y = 700 + Math.sin(T * 8 + i) * 8;
        g.save(); g.translate(x, y); g.scale(k * .8, k * .8);
        inkRR(g, -70, -90, 140, 160, 28, ["#b9b2d8", "#f3c3bd", "#bfe3ec", "#c9e4b0", "#ffd166", "#cdbff0"][i], 5);
        inkCircle(g, -26, -40, 10, C.ink, 3); inkCircle(g, 26, -40, 10, C.ink, 3); inkLine(g, -20, 10, 20, 10, 5);
        txt(g, r, 0, 120, 30, { align: "center", font: MONO, weight: 500, fill: C.ink });
        g.restore();
      });
      var finds = []; (FX.trails || []).forEach(function (tr) { (tr.findings || []).forEach(function (f) { finds.push({ t: tr.number, f: f }); }); });
      finds.forEach(function (it, i) {
        var k = eBack(prog(T, bug + i * .25, .4)); if (k <= 0) return;
        g.save(); g.translate(560 + i * 760, 360); g.rotate((i ? .05 : -.05)); g.scale(k, k);
        inkRR(g, -330, -100, 660, 200, 16, C.cream, 6);
        txt(g, "trail #" + it.t + " · " + it.f.severity, -300, -50, 28, { font: MONO, weight: 500, fill: C.orange });
        txt(g, it.f.summary.slice(0, 40) + "…", -300, 0, 26, { fill: C.ink, weight: 600 });
        if (T > merged - .3) txt(g, "fixed " + it.f.fix + " ✓ before merge", -300, 60, 28, { font: MONO, weight: 500, fill: C.mintD });
        g.restore();
      });
      sfxWord(g, "GOTCHA!", 960, 200, bug, 120, C.orange, -.06);
    }
    caption(g, sc, null);
  };

  // 08 CFO.AI — the real workspace on a monitor, coin vs sack, six scenario lines in ink
  S.cfo = function (g, sc) {
    var c1 = L("cfo1"), c2 = L("cfo2"), c3 = L("cfo3"), cfo = FX.cfo || {};
    g.drawImage(paper("cfo", "#d6ecd2", ["#b5dcae", "#eef7e6", "#c6e4b0", "#f5e7c4"], 131), 0, 0);
    txt(g, "cfo.ai", 110, 160, 92, { fill: C.ink });
    if (T < c2.start - .05) {
      monitorImg(g, 880, 560, 1180, "../film/public/cfoai/launch-plan.png", { ar: 892 / 1364 * .82, scale: eBack(prog(T, c1.start - .1, .45)), rot: -.015, zoom: lerp(1, 1.25, eInOut(prog(T, c1.start + .5, 3))), fx: 0, fy: .3 });
      fin(g, 1700, 680, .95, { paper: true });
    } else if (T < c3.start - .05) {
      var three = wt("cfo2", ["three", "3"], .15), ninety = wt("cfo2", ["ninetynine", "ninety", "99"], .7);
      var k1 = eBack(prog(T, three - .1, .4)), k2 = eBack(prog(T, ninety - .4, .45));
      if (k1 > 0) { g.save(); g.translate(420, 600); g.scale(k1, k1); inkCircle(g, 0, 0, 50, C.yellow, 6); txt(g, "¢", 0, 18, 56, { align: "center", fill: C.ink }); txt(g, "AI: " + cfo.llm_per_run + " / run", 0, 120, 42, { align: "center", fill: C.ink }); g.restore(); }
      if (k2 > 0) {
        g.save(); g.translate(1100, 590); g.scale(k2, k2);
        inkPath(g, [[-200, 220], [-240, 60], [-150, -120], [-60, -170], [60, -170], [150, -120], [240, 60], [200, 220]], true, "#c9a46a", null, 7);
        inkPath(g, [[-70, -170], [0, -230], [70, -170]], false, null, null, 7);
        txt(g, "$", 0, 60, 200, { align: "center", fill: C.cream, stroke: C.ink, sw: 18 });
        txt(g, "competitor data: " + cfo.crustdata_per_uncached_run + " / uncached run", 0, 300, 38, { align: "center", fill: C.ink });
        g.restore();
        sfxWord(g, "~99%", 1440, 280, ninety, 140, C.red, .1);
      }
      radar(g, 1650, 860, .7, { expr: T > ninety ? "wow" : "happy" });
    } else {
      var sc6 = (FX.cash || {}).scenarios || {}, names = Object.keys(sc6), all = [];
      names.forEach(function (n) { all = all.concat(sc6[n]); });
      var hi = Math.max.apply(null, all), lo = Math.min(0, Math.min.apply(null, all)) - 8000, x0 = 230, y0 = 310, cw = 1200, ch = 500;
      var X = function (i) { return x0 + i / 23 * cw; }, Y = function (v) { return y0 + ch - (v - lo) / (hi - lo) * ch; };
      inkLine(g, x0, Y(0), x0 + cw, Y(0), 4, "rgba(42,36,51,.5)"); txt(g, "$0", x0 - 20, Y(0) + 10, 26, { align: "right", fill: "#4b5a48" });
      var draw = eInOut(prog(T, c3.start + .1, 2.4)), COLS = { "Main Scenario": C.indigoD, "Growth": C.mintD, "Downside": C.red };
      var minor = ["Team uncached cap", "Team repriced", "Industry mix"], MCOL = { "Team uncached cap": "#3f8fb0", "Team repriced": "#9a6fc4", "Industry mix": "#8a8f86" };
      // gridlines
      [0, 50000, 100000].forEach(function (v) { if (v > hi) return; g.strokeStyle = "rgba(42,36,51,.12)"; g.lineWidth = 2; g.beginPath(); g.moveTo(x0, Y(v)); g.lineTo(x0 + cw, Y(v)); g.stroke(); txt(g, money(v), x0 - 18, Y(v) + 9, 24, { align: "right", fill: "#4b5a48", weight: 600 }); });
      names.slice().sort(function (a, b) { return (COLS[a] ? 1 : 0) - (COLS[b] ? 1 : 0); }).forEach(function (n) {
        var arr = sc6[n], upto = draw * 23, col = COLS[n] || MCOL[n] || "#8a8f86";
        g.save(); g.strokeStyle = col; g.lineWidth = COLS[n] ? 9 : 4; g.lineJoin = "round"; g.lineCap = "round"; g.globalAlpha = COLS[n] ? 1 : .8;
        g.beginPath();
        for (var i = 0; i <= Math.floor(upto); i++) { if (i) g.lineTo(X(i), Y(arr[i])); else g.moveTo(X(i), Y(arr[i])); }
        var fi = Math.floor(upto), fr = upto - fi; if (fi < 23) g.lineTo(lerp(X(fi), X(fi + 1), fr), lerp(Y(arr[fi]), Y(arr[fi + 1]), fr));
        g.stroke(); g.restore();
        if (COLS[n] && draw >= 1) { var lk = eOut(prog(T, c3.start + 2.5, .4)); g.save(); g.globalAlpha = lk; txt(g, (n === "Main Scenario" ? "Base" : n) + "  " + money(arr[23]), X(23) + 22, Y(arr[23]) + 11, 32, { fill: col, weight: 700 }); g.restore(); }
      });
      // legend for the other three scenarios
      var lgk = eOut(prog(T, c3.start + 2.5, .4));
      g.save(); g.globalAlpha = lgk;
      minor.forEach(function (n, i) { if (!sc6[n]) return; var lx = 236 + i * 400; g.fillStyle = MCOL[n]; g.fillRect(lx, 318, 30, 6); txt(g, n + "  " + money(sc6[n][23]), lx + 40, 328, 24, { fill: C.ink, weight: 600 }); });
      g.restore();
      var jan = wt("cfo3", ["january"], .55), base = sc6["Main Scenario"] || [];
      if (T > jan - .2 && base.length) { var bi = base.indexOf(Math.min.apply(null, base)); stamp(g, "CASH-FLOW POSITIVE · JAN 2028", 700, 470, jan, C.indigoD, 40, -.05); }
      txt(g, names.length + " scenarios · ending cash · Nov 2026 → Oct 2028 · from the live cfo.ai workspace", 160, 260, 30, { fill: "#4b5a48", weight: 600 });
      sfxWord(g, "KA-CHING!", 1620, 900, jan + .4, 110, C.yellow, -.08);
    }
    caption(g, sc, null);
  };

  // 09 OUTRO — the site on a monitor, the cast dancing (backup dancers), end card
  S.outro = function (g, sc) {
    var o1 = L("out1"), o2 = L("out2");
    g.drawImage(paper("out", "#f6d9b8", ["#f7b2a0", "#ffd98a", "#f6a6c1", "#c4b4ee"], 149), 0, 0);
    g.save(); g.translate(960, 560); g.rotate(T * .06);
    for (var r = 0; r < 24; r++) { g.fillStyle = hexa(r % 2 ? "#ffd98a" : "#f7b2a0", .35); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 1500, r / 24 * TAU, (r + .5) / 24 * TAU); g.fill(); }
    g.restore();
    var tc = T - sc.start; needClip("intro", Math.min(tc + 2.6, 8.4));
    monitor(g, 960, 380, 860, "intro", Math.min(tc + 2.6, 8.4), { scale: eBack(prog(T, sc.start, .5)), rot: -.015 });
    var hop = function (ph) { return -Math.abs(Math.sin(T * 5 + ph)) * 26; };
    radar(g, 300, 870 + hop(0), .8, { wave: true }); audy(g, 1650, 880 + hop(1), .62, { shout: true }); fin(g, 1420, 850 + hop(2), .62, { armUp: true });
    var cl = lineAt(T); if (cl && cl.scene === "outro") bigLine(g, cl, { x: 0, y: 760, w: W }, { size: 84, align: "center", hold: true });
    if (T > o2.end + .1) {
      var k = eOut(prog(T, o2.end + .1, .4));
      g.save(); g.globalAlpha = k; g.fillStyle = "rgba(42,36,51,.86)"; g.fillRect(0, 0, W, H);
      txt(g, "SPEND RADAR", 960, 450, 170, { align: "center", fill: C.cream, stroke: C.ink, sw: 24, shadow: C.ink, sx: 8, sy: 10 });
      txt(g, "Every number has a source.", 960, 545, 56, { align: "center", fill: C.yellow });
      txt(g, "github.com/akarsh-dhingra/SpeedRadar-NeetHack", 960, 640, 36, { align: "center", font: MONO, weight: 500, fill: C.cream });
      txt(g, "akarsh-dhingra.github.io/SpeedRadar-NeetHack", 960, 690, 36, { align: "center", font: MONO, weight: 500, fill: C.cream });
      txt(g, "team qwep · #neatHack · built with neatlogs, Entire, cfo.ai", 960, 760, 34, { align: "center", fill: "#d9cfe0", weight: 600 });
      txt(g, "voice: Chatterbox, timbre from LibriSpeech reader 1673 (CC BY 4.0)", 960, 1010, 22, { align: "center", fill: "#9f95a8", weight: 500 });
      g.restore();
    }
  };

  // ── frame assembly ─────────────────────────────────────────────────────────
  var bufA = document.createElement("canvas"), bufB = document.createElement("canvas"); bufA.width = bufB.width = W * SC; bufA.height = bufB.height = H * SC;
  function sized(b) { var g = b.getContext("2d"); g.setTransform(SC, 0, 0, SC, 0, 0); g.clearRect(0, 0, W, H); return g; }
  function sceneAt(t) { for (var i = 0; i < TL.scenes.length; i++) if (t < TL.scenes[i].end) return i; return TL.scenes.length - 1; }
  function drawScene(g, i) {
    var sc = TL.scenes[i]; sc.dur = sc.end - sc.start;
    g.save(); (S[sc.id] || function () {})(g, sc); g.restore(); // no beat bump: the frame itself never pumps
  }
  function tornWipe(g, k, seed) { // torn paper edge sweeping left → right
    g.beginPath(); var x = lerp(-300, W + 300, eInOut(k));
    g.moveTo(-10, -10); g.lineTo(x, -10);
    for (var y = 0; y <= H + 20; y += 30) g.lineTo(x + (hash(seed + y * .07) - .5) * 70 + Math.sin(y * .01) * 60, y);
    g.lineTo(-10, H + 10); g.closePath();
  }
  var TRANS = .55;
  function frame(t) {
    T = t; BF = Math.floor(t * BOIL); X.setTransform(SC, 0, 0, SC, 0, 0); X.imageSmoothingQuality = "high";
    var i = sceneAt(t), sc = TL.scenes[i];
    var into = i > 0 ? t - sc.start : 99;
    if (into < TRANS / 2 && i > 0) { // second half of a wipe: previous scene still partly visible
      var k = .5 + into / TRANS;
      drawScene(X, i);
      var ga = sized(bufA); ga.save(); T = TL.scenes[i - 1].end - .001; drawScene(ga, i - 1); ga.restore(); T = t;
      X.save(); X.beginPath(); X.rect(0, 0, W, H); tornWipe(X, k, i); X.clip("evenodd"); X.drawImage(bufA, 0, 0, W, H); X.restore();
      edge(k, i);
    } else if (i < TL.scenes.length - 1 && sc.end - t < TRANS / 2) { // first half: next scene slides in from the left edge
      var k2 = .5 - (sc.end - t) / TRANS;
      drawScene(X, i);
      var gb = sized(bufB); var keep = T; T = TL.scenes[i + 1].start + .001; drawScene(gb, i + 1); T = keep;
      X.save(); tornWipe(X, k2, i + 1); X.clip(); X.drawImage(bufB, 0, 0, W, H); X.restore();
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
    function add(t, s, g) { if (t > 0) c.push({ t: +t.toFixed(3), sfx: s, gain: g || 1 }); }
    TL.scenes.forEach(function (s, i) { if (i) add(s.start - .2, "whoosh", .8); });
    add(wt("hook1", ["doubled"]) + .1, "boom"); add(wt("hook2", ["quarter"]), "tick"); add(wt("hook3", ["first"]), "ping");
    add(wt("title1", ["radar"], .15) - .2, "boom", .8); add(wt("title1", ["wrong"]), "glitch", .7);
    add(L("run1").start + .4, "stamp"); add(wt("run3", ["headcount"], .55), "ping");
    var r4 = L("run4"); for (var q = 0; q < 8; q++) add(r4.start + .2 + q * .18, "tick", .5); add(wt("run4", ["fails"], .6), "glitch");
    add(wt("run5", ["reread", "re", "read"], .6), "pop"); add(wt("run5", ["reread", "re", "read"], .6) + .25, "stamp");
    add(wt("run6", ["corrupt"], .5) + .1, "glitch", .8); add(wt("run6", ["corrupt"], .5) + .9, "stamp", .8); add(wt("run7", ["beat"], .7), "ding");
    add(L("aud1").start, "riser", .7); add(wt("aud2", ["million", "528", "5.28"], .45), "boom", .8); add(wt("aud3", ["overturned"], .75), "stamp", 1.2);
    add(wt("gen2", ["caught"], .3), "ding"); add(wt("gen2", ["zero", "0"], .7), "stamp", .8);
    add(wt("nl2", ["three", "3"], .2) + .4, "glitch", .7); add(wt("nl2", ["dropped"], .75), "pop", .7); add(wt("nl2", ["fix"], .45) + .2, "ding"); add(wt("nl3", ["one", "1"], .8), "stamp");
    add(wt("ent1", ["sixtynine", "sixty", "69"], .7), "boom", .8); add(wt("ent2", ["prompt"], .85) + .2, "ding"); add(wt("ent3", ["bugs", "two", "2"], .6), "pop");
    add(wt("cfo2", ["ninetynine", "ninety", "99"], .7), "boom", .8); add(wt("cfo3", ["january"], .55) + .4, "ding", 1.1);
    add(L("out2").end, "ding");
    return c.sort(function (a, b) { return a.t - b.t; });
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
