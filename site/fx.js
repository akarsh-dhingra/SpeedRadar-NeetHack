/* Spend Radar effects: the radar intro, the live dot field behind the verdict, number decoding, tilt,
 * magnetic buttons, the cursor ring and the circular page wipe. Every number an effect touches ends on the
 * exact exported value. Motion is on by default; the top-bar switch turns all of it off. */
(function () {
  "use strict";

  var root = document.documentElement;
  var FINE = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  var motion = true;
  try { motion = localStorage.getItem("sr.motion") !== "off"; } catch (e) { /* storage blocked: keep default */ }
  if (/[?&]motion=off/.test(location.search)) motion = false; // still frames for screenshots
  root.classList.toggle("fx", motion);

  function on() { return motion; }
  function setMotion(v) {
    motion = v; root.classList.toggle("fx", v);
    try { localStorage.setItem("sr.motion", v ? "on" : "off"); } catch (e) { /* ignore */ }
    if (!v) { stopField(); cursorOff(); } else { cursorOn(); }
  }
  function css(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }
  function rgba(hex, a) {
    hex = hex.replace("#", "");
    if (hex.length === 3) hex = hex.split("").map(function (c) { return c + c; }).join("");
    var n = parseInt(hex.slice(0, 6), 16);
    return "rgba(" + (n >> 16 & 255) + "," + (n >> 8 & 255) + "," + (n & 255) + "," + a + ")";
  }
  function dpr() { return Math.min(window.devicePixelRatio || 1, 2); }

  // ── 1. The radar intro ─────────────────────────────────────────────
  function intro(D, done) {
    if (!motion) { done(); return; }
    var el = document.createElement("div");
    el.className = "sr-intro";
    el.innerHTML = '<canvas></canvas><div class="sr-intro-copy"><div class="sr-intro-mark"></div><div class="sr-intro-line"></div></div><button type="button" class="sr-intro-skip">Skip intro</button>';
    document.body.appendChild(el);
    var cv = el.querySelector("canvas"), ctx = cv.getContext("2d");
    var mark = el.querySelector(".sr-intro-mark"), line = el.querySelector(".sr-intro-line");
    mark.innerHTML = "Spend Radar".split("").map(function (ch, i) { return '<span style="--k:' + i + '">' + (ch === " " ? "&nbsp;" : ch) + "</span>"; }).join("");
    var sm = D.summary;
    var stats = [sm.companies + " companies", sm.runs_scored + " scored runs", sm.latest_runs_false_alarms + " false alarms on the latest runs"];
    var W, H, R, cx, cy;
    function size() { W = innerWidth; H = innerHeight; cv.width = W * dpr(); cv.height = H * dpr(); cv.style.width = W + "px"; cv.style.height = H + "px"; ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0); R = Math.min(W, H) * 0.3; cx = W / 2; cy = H * 0.44; }
    size(); addEventListener("resize", size);
    var green = css("--up") || "#3dbf55", accent = css("--accent") || "#8f8df0", grid = css("--border-control") || "#6f7274", text = css("--text") || "#fff", ter = css("--text-tertiary") || "#808385";
    var blips = D.companies.map(function (c, i) {
      var a = -Math.PI / 2 + (i + 0.35) * (Math.PI * 2 / D.companies.length);
      return { name: c.name.replace(/ Inc\.$/, ""), a: a, r: 0.42 + ((i * 37) % 50) / 100, hit: -1, dev: c.role === "development" };
    });
    var t0 = performance.now(), SWEEP = 1900, END = 3300, finished = false;
    function frame(now) {
      if (finished) return;
      var t = now - t0;
      ctx.clearRect(0, 0, W, H);
      var grow = Math.min(1, t / 500), ease = 1 - Math.pow(1 - grow, 3);
      // rings and crosshair
      ctx.lineWidth = 1;
      for (var k = 1; k <= 4; k++) { ctx.strokeStyle = rgba(grid, 0.35 * ease); ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, R * k / 4 * ease), 0, Math.PI * 2); ctx.stroke(); }
      ctx.strokeStyle = rgba(grid, 0.22 * ease); ctx.beginPath(); ctx.moveTo(cx - R * 1.15 * ease, cy); ctx.lineTo(cx + R * 1.15 * ease, cy); ctx.moveTo(cx, cy - R * 1.15 * ease); ctx.lineTo(cx, cy + R * 1.15 * ease); ctx.stroke();
      // ticks
      for (var d = 0; d < 72; d++) { var ta = d / 72 * Math.PI * 2, l = d % 6 === 0 ? 10 : 4; ctx.strokeStyle = rgba(grid, 0.4 * ease); ctx.beginPath(); ctx.moveTo(cx + Math.cos(ta) * R * ease, cy + Math.sin(ta) * R * ease); ctx.lineTo(cx + Math.cos(ta) * (R + l) * ease, cy + Math.sin(ta) * (R + l) * ease); ctx.stroke(); }
      // sweep: a fading wedge of thin lines behind the beam
      var sweepT = Math.max(0, t - 300) / SWEEP, ang = -Math.PI / 2 + sweepT * Math.PI * 2;
      if (t > 300) {
        for (var s = 0; s < 40; s++) {
          var sa = ang - s * 0.022;
          ctx.strokeStyle = rgba(green, (0.55 * (1 - s / 40)) * Math.max(0, 1 - Math.max(0, t - 300 - SWEEP * 1.25) / 400));
          ctx.lineWidth = s === 0 ? 2 : 1.4;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R); ctx.stroke();
        }
      }
      // blips light when the beam passes them
      blips.forEach(function (b) {
        var rel = ((b.a - (-Math.PI / 2)) / (Math.PI * 2) + 1) % 1;
        if (b.hit < 0 && sweepT >= rel && t > 300) b.hit = now;
        if (b.hit < 0) return;
        var age = (now - b.hit) / 1000, x = cx + Math.cos(b.a) * R * b.r, y = cy + Math.sin(b.a) * R * b.r, col = b.dev ? accent : green;
        ctx.fillStyle = rgba(col, 1); ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill();
        for (var w = 0; w < 2; w++) { var rr = (age * 70 + w * 18) % 60; ctx.strokeStyle = rgba(col, Math.max(0, 0.6 - rr / 60)); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, Math.max(0, 5 + rr), 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = rgba(text, Math.min(1, age * 3)); ctx.font = "500 13px Geist, ui-sans-serif, system-ui, sans-serif";
        var right = Math.cos(b.a) >= 0; ctx.textAlign = right ? "left" : "right";
        ctx.fillText(b.name, x + (right ? 12 : -12), y + 4);
        ctx.fillStyle = rgba(ter, Math.min(1, age * 3)); ctx.font = "400 11px 'Geist Mono', ui-monospace, monospace";
        ctx.fillText(b.dev ? "development set" : "held out", x + (right ? 12 : -12), y + 18);
      });
      // centre
      ctx.fillStyle = rgba(green, ease); ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();
      if (t > END) { finish(); return; }
      requestAnimationFrame(frame);
    }
    var lineTimer = setTimeout(function () { line.innerHTML = stats.map(function (s, i) { return '<span style="--k:' + i + '">' + s + "</span>"; }).join('<i aria-hidden="true">·</i>'); decodeAll(line, 120); }, 1500);
    function finish() {
      if (finished) return; finished = true; clearTimeout(lineTimer);
      el.classList.add("is-out");
      removeEventListener("resize", size);
      done();
      setTimeout(function () { el.remove(); }, 900);
    }
    setTimeout(finish, END + 700); // never trap the page behind the intro, even if animation frames stall
    el.addEventListener("click", finish);
    addEventListener("keydown", function k(e) { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { removeEventListener("keydown", k); finish(); } });
    requestAnimationFrame(frame);
  }

  // ── 2. The live dot field behind the verdict ─────────────────────────
  var field = null;
  function startField(host) {
    stopField();
    if (!motion || !host) return;
    var cv = document.createElement("canvas"); cv.className = "sr-field"; cv.setAttribute("aria-hidden", "true");
    host.insertBefore(cv, host.firstChild);
    var ctx = cv.getContext("2d"), W = 0, H = 0, GAP = 18, ripples = [], sparks = [], mouse = { x: -999, y: -999 }, raf = 0, visible = true;
    var cDot = css("--text-tertiary"), cUp = css("--up"), cAcc = css("--accent");
    function size() { var b = host.getBoundingClientRect(); W = b.width; H = b.height; cv.width = W * dpr(); cv.height = H * dpr(); cv.style.width = W + "px"; cv.style.height = H + "px"; ctx.setTransform(dpr(), 0, 0, dpr(), 0, 0); }
    size();
    var ro = window.ResizeObserver ? new ResizeObserver(size) : null; if (ro) ro.observe(host);
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) raf = requestAnimationFrame(tick); }) : null; if (io) io.observe(host);
    var start = performance.now();
    function tick(now) {
      raf = 0; if (!visible || document.hidden) return;
      ctx.clearRect(0, 0, W, H);
      var t = (now - start) / 1000;
      // ambient radar sweep from the matrix side, one turn every 7 s
      var sx = W * 0.78, sy = H * 0.5, sweep = (t / 7 % 1) * Math.PI * 2 - Math.PI / 2;
      ripples = ripples.filter(function (r) { return (now - r.t) < r.life; });
      for (var y = GAP / 2; y < H; y += GAP) {
        for (var x = GAP / 2; x < W; x += GAP) {
          var a = 0.16, col = cDot, s = 1;
          var dx = x - mouse.x, dy = y - mouse.y, dm = Math.sqrt(dx * dx + dy * dy);
          if (dm < 190) { var k = 1 - dm / 190; a += 0.6 * k * k; s += 0.9 * k; }
          var ang = Math.atan2(y - sy, x - sx), diff = ((sweep - ang) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
          if (diff < 0.9) { var ks = 1 - diff / 0.9; a += 0.32 * ks; col = cUp; }
          for (var i = 0; i < ripples.length; i++) {
            var rp = ripples[i], age = (now - rp.t) / 1000, rad = age * rp.speed, dr = Math.abs(Math.hypot(x - rp.x, y - rp.y) - rad);
            if (dr < 26) { var kr = (1 - dr / 26) * (1 - (now - rp.t) / rp.life); a += 0.9 * kr; s += 1.2 * kr; col = rp.col; }
          }
          ctx.fillStyle = rgba(col, Math.min(1, a)); ctx.beginPath(); ctx.arc(x, y, Math.max(0, s), 0, 6.2832); ctx.fill();
        }
      }
      sparks = sparks.filter(function (p) { return (now - p.t) < 700; });
      sparks.forEach(function (p) {
        var age = (now - p.t) / 700, px = p.x + p.vx * age * 60, py = p.y + p.vy * age * 60 + age * age * 30;
        ctx.fillStyle = rgba(p.col, 1 - age); ctx.beginPath(); ctx.arc(px, py, Math.max(0, 1.8 * (1 - age) + 0.4), 0, 6.2832); ctx.fill();
      });
      raf = requestAnimationFrame(tick);
    }
    function local(el) { var a = el.getBoundingClientRect(), b = host.getBoundingClientRect(); return { x: a.left - b.left + a.width / 2, y: a.top - b.top + a.height / 2 }; }
    function ripple(x, y, col, speed, life) { ripples.push({ x: x, y: y, t: performance.now(), col: col || cUp, speed: speed || 260, life: life || 1100 }); if (ripples.length > 40) ripples.shift(); }
    function burst(x, y, col) { for (var i = 0; i < 7; i++) { var a = Math.random() * Math.PI * 2, v = 0.6 + Math.random() * 1.4; sparks.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.6, t: performance.now(), col: col || cUp }); } }
    var onMove = function (e) { var b = host.getBoundingClientRect(); mouse.x = e.clientX - b.left; mouse.y = e.clientY - b.top; };
    var onLeave = function () { mouse.x = mouse.y = -999; };
    var onClick = function (e) { var b = host.getBoundingClientRect(); ripple(e.clientX - b.left, e.clientY - b.top, cAcc, 420, 1300); };
    var onStamp = function (e) {
      if (!e.target.matches(".ac-cells i")) return;
      var p = local(e.target), miss = e.target.classList.contains("miss");
      ripple(p.x, p.y, miss ? css("--down") : cUp, 220, 900); burst(p.x, p.y, miss ? css("--down") : cUp);
    };
    var onScore = function (e) { if (e.target.matches(".ac-mscore")) { var p = local(e.target); ripple(p.x, p.y, cUp, 520, 1400); } };
    host.addEventListener("pointermove", onMove); host.addEventListener("pointerleave", onLeave); host.addEventListener("click", onClick);
    host.addEventListener("animationstart", onStamp); host.addEventListener("animationend", onScore);
    raf = requestAnimationFrame(tick);
    field = {
      ripple: ripple,
      stop: function () { cancelAnimationFrame(raf); if (ro) ro.disconnect(); if (io) io.disconnect(); host.removeEventListener("pointermove", onMove); host.removeEventListener("pointerleave", onLeave); host.removeEventListener("click", onClick); host.removeEventListener("animationstart", onStamp); host.removeEventListener("animationend", onScore); cv.remove(); }
    };
  }
  function stopField() { if (field) { field.stop(); field = null; } }

  // ── 3. Numbers decode: digits scramble, then lock on the real value ─────
  function decode(el, delay) {
    if (!motion || el.__decoding) return;
    var nodes = [], walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (/\d/.test(walker.currentNode.nodeValue)) nodes.push(walker.currentNode);
    if (!nodes.length) return;
    var finals = nodes.map(function (nd) { return nd.nodeValue; });
    el.__decoding = true;
    var DUR = 750, t0 = 0;
    function scramble(s, p) {
      var digits = 0, total = (s.match(/\d/g) || []).length;
      return s.replace(/\d/g, function (d) { digits++; return digits / total <= p ? d : String(Math.floor(Math.random() * 10)); });
    }
    setTimeout(function () {
      t0 = performance.now();
      (function step(now) {
        var p = Math.min(1, (now - t0) / DUR);
        nodes.forEach(function (nd, i) { nd.nodeValue = p >= 1 ? finals[i] : scramble(finals[i], p * p); });
        if (p < 1) requestAnimationFrame(step); else el.__decoding = false;
      })(performance.now());
    }, delay || 0);
  }
  function decodeAll(scope, base) {
    var els = scope.querySelectorAll(".ac-figure b, .ac-mscore, .ac-stat-value, .ac-display, .ac-claimnum, .sr-ba-score, .sr-dl dd, .sr-intro-line span");
    var io = window.IntersectionObserver ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); decode(e.target, e.target.__delay); } });
    }, { threshold: 0.4 }) : null;
    Array.prototype.forEach.call(els, function (el, i) {
      el.__delay = (base || 0) + i * 35;
      if (io) io.observe(el); else decode(el, el.__delay);
    });
  }

  // ── 4. Tilt with a light sheen; magnetic buttons ────────────────────────
  function bindTilt(scope) {
    if (!FINE) return;
    scope.querySelectorAll(".sr-tilt").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        if (!motion) return;
        var b = el.getBoundingClientRect(), px = (e.clientX - b.left) / b.width, py = (e.clientY - b.top) / b.height;
        var max = Math.max(2.5, Math.min(7, 2200 / b.width));
        el.style.transform = "perspective(1000px) rotateX(" + ((0.5 - py) * max).toFixed(2) + "deg) rotateY(" + ((px - 0.5) * max).toFixed(2) + "deg) translateZ(0)";
        el.style.setProperty("--gx", (px * 100).toFixed(1) + "%"); el.style.setProperty("--gy", (py * 100).toFixed(1) + "%");
        el.classList.add("is-tilting");
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; el.classList.remove("is-tilting"); });
    });
  }
  function bindMagnets(scope) {
    if (!FINE) return;
    scope.querySelectorAll(".ac-btn, .sr-chip, .ac-seg button").forEach(function (el) {
      el.addEventListener("pointermove", function (e) {
        if (!motion) return;
        var b = el.getBoundingClientRect();
        el.style.transform = "translate(" + ((e.clientX - b.left - b.width / 2) * 0.18).toFixed(1) + "px," + ((e.clientY - b.top - b.height / 2) * 0.28).toFixed(1) + "px)";
      });
      el.addEventListener("pointerleave", function () { el.style.transform = ""; });
    });
  }

  // ── 5. Cursor ring ──────────────────────────────────────────────────────
  var ring = null, rx = -100, ry = -100, tx = -100, ty = -100, ringRaf = 0;
  function cursorOn() {
    if (!FINE || ring) return;
    ring = document.createElement("div"); ring.className = "sr-cursor"; ring.setAttribute("aria-hidden", "true"); document.body.appendChild(ring);
    addEventListener("pointermove", ringMove); addEventListener("pointerdown", ringDown); addEventListener("pointerup", ringUp);
    (function loop() { rx += (tx - rx) * 0.2; ry += (ty - ry) * 0.2; if (ring) { ring.style.transform = "translate(" + rx + "px," + ry + "px)"; ringRaf = requestAnimationFrame(loop); } })();
  }
  function cursorOff() { if (!ring) return; cancelAnimationFrame(ringRaf); ring.remove(); ring = null; removeEventListener("pointermove", ringMove); removeEventListener("pointerdown", ringDown); removeEventListener("pointerup", ringUp); }
  function ringMove(e) { tx = e.clientX; ty = e.clientY; if (ring) ring.classList.toggle("is-hot", !!(e.target.closest && e.target.closest("a, button, [role=button], select, summary, g.col"))); }
  function ringDown() { if (ring) ring.classList.add("is-down"); }
  function ringUp() { if (ring) ring.classList.remove("is-down"); }
  if (motion) cursorOn();

  // ── 6. Page wipe origin ─────────────────────────────────────────────────
  function setOrigin(x, y) {
    var m = document.getElementById("main"); if (!m) return;
    var b = m.getBoundingClientRect();
    root.style.setProperty("--wx", Math.round(x - b.left) + "px"); root.style.setProperty("--wy", Math.round(y - b.top) + "px");
  }

  // ── after each render ───────────────────────────────────────────────────
  function after(main, view, opts) {
    bindTilt(main); bindMagnets(main);
    if (!motion) return;
    var v = main.querySelector(".ac-verdict");
    if (v) startField(v); else stopField();
    decodeAll(main, opts && opts.play ? 650 : 120);
    if (view === "run" && !(opts && opts.noReplay)) {
      var btn = main.querySelector("[data-replay-run]");
      if (btn) setTimeout(function () { if (document.body.contains(btn)) btn.click(); }, 1100);
    }
  }

  window.SRFX = { on: on, setMotion: setMotion, intro: intro, after: after, setOrigin: setOrigin, ripple: function (x, y) { if (field) field.ripple(x, y); } };
})();
