"""An original 120 BPM synth-pop bed plus synthesized sound effects, then the final mix.

  python music.py         → build/music.wav (length of build/timeline.json)
  python music.py --mix   → build/audio.wav: voice + music ducked under the voice + sfx at build/cues.json

Everything is generated here from oscillators and noise, so there is nothing to license.
"""
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

HERE = Path(__file__).parent
BUILD = HERE / "build"
SR = 48000
rng = np.random.default_rng(7)


def env_adsr(n, a=0.005, d=0.08, s=0.6, r=0.1):
    t = np.arange(n) / SR
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    e[:na] = np.linspace(0, 1, max(1, na))[:len(e[:na])]
    e[na:na + nd] = np.linspace(1, s, max(1, nd))[:len(e[na:na + nd])]
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def kick(n=int(0.35 * SR)):
    t = np.arange(n) / SR
    f = 50 + 120 * np.exp(-t * 35)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * 0.95


def clap(n=int(0.25 * SR)):
    t = np.arange(n) / SR
    noise = rng.uniform(-1, 1, n)
    burst = sum(np.exp(-np.maximum(0, t - k * 0.011) * 60) * (t >= k * 0.011) for k in range(3))
    return bandpass(noise, 1200, 2600) * burst * 0.5


def hat(n=int(0.06 * SR), open_=False):
    t = np.arange(n) / SR
    return highpass(rng.uniform(-1, 1, n), 7000) * np.exp(-t * (18 if open_ else 70)) * 0.25


def onepole_lp(x, fc):
    from scipy.signal import lfilter
    a = np.exp(-2 * np.pi * fc / SR)
    return lfilter([1 - a], [1, -a], x)


def highpass(x, fc):
    return x - onepole_lp(x, fc)


def bandpass(x, lo, hi):
    return onepole_lp(highpass(x, lo), hi)


def saw(freq, n):
    t = np.arange(n) / SR
    return 2 * ((t * freq) % 1) - 1


def note(f):
    return 440.0 * 2 ** ((f - 69) / 12)


# I – V – vi – IV in C, the pop staple. (root midi, chord midis)
PROG = [(48, [60, 64, 67]), (43, [59, 62, 67]), (45, [60, 64, 69]), (41, [60, 65, 69])]


def music(total, bpm, scenes):
    beat = 60 / bpm
    n = int(total * SR)
    out = np.zeros(n + SR)
    k, c, h, ho = kick(), clap(), hat(), hat(open_=True)

    def put(sig, t, g=1.0):
        i = int(t * SR)
        if i >= n:
            return
        m = min(len(sig), len(out) - i)
        out[i:i + m] += sig[:m] * g

    energy = {"hook": 0.6, "title": 1.0, "how": 0.9, "recover": 0.9, "audit": 0.45, "general": 1.0,
              "neatlogs": 0.9, "entire": 0.85, "cfo": 1.0, "outro": 1.0}

    def scene_at(t):
        for s in scenes:
            if s["start"] <= t < s["end"]:
                return s["id"]
        return "outro"

    nbeats = int(total / beat)
    for b in range(nbeats):
        t = b * beat
        sc = scene_at(t)
        e = energy.get(sc, 0.8)
        bar, pos = divmod(b, 4)
        root, chord = PROG[bar % 4]
        if e >= 0.6:
            put(k, t, 0.9 * e)
        if e >= 0.85 and pos in (1, 3):
            put(c, t, 0.8)
        if e >= 0.6:
            put(h, t + beat / 2, 0.8)
            if e >= 0.9:
                put(h, t + beat * 0.25, 0.35)
                put(h, t + beat * 0.75, 0.35)
        if e < 0.6 and pos == 0:  # sparse tension: low pulse
            put(kick() * 0.6, t, 0.6)
        # bass: root on 8ths with an octave hop
        for j, off in enumerate((0, 0.5)):
            m = root if j == 0 else root + 12
            ln = int(beat * 0.45 * SR)
            sig = onepole_lp(saw(note(m), ln), 600) * env_adsr(ln, 0.003, 0.06, 0.7, 0.05)
            put(sig, t + off * beat, 0.28 * max(e, 0.5))
        # chord stabs on the offbeat (pluck)
        if e >= 0.6:
            ln = int(beat * 0.3 * SR)
            stab = sum(onepole_lp(saw(note(m) * 1.003, ln) + saw(note(m) * 0.997, ln), 2400) for m in chord)
            put(stab * env_adsr(ln, 0.002, 0.12, 0.2, 0.08) / 3, t + beat / 2, 0.16 * e)
        # bell lead: a small arpeggio on bars of high energy
        if e >= 1.0 and bar % 2 == 1:
            m = chord[pos % 3] + 12
            ln = int(beat * 0.5 * SR)
            tt = np.arange(ln) / SR
            bell = (np.sin(2 * np.pi * note(m) * tt) + 0.3 * np.sin(2 * np.pi * note(m) * 3 * tt)) * np.exp(-tt * 7)
            put(bell, t, 0.12)
        if e < 0.6 and pos == 0:  # pad for tension sections
            ln = int(4 * beat * SR)
            pad = sum(onepole_lp(saw(note(m - 12), ln), 900) for m in chord) * env_adsr(ln, 0.4, 0.5, 0.8, 0.6)
            put(pad / 3, t, 0.1)
    # tail: final chord ring
    out = out[:n]
    peak = np.max(np.abs(out)) or 1
    return (out / peak * 0.7).astype(np.float32)


# ── sound effects ────────────────────────────────────────────────────────────
def sfx(name):
    if name == "whoosh":
        n = int(0.45 * SR); t = np.arange(n) / SR
        x = rng.uniform(-1, 1, n)
        sweep = np.concatenate([onepole_lp(x[i:i + 2400], 300 + 6000 * (i / n)) for i in range(0, n, 2400)])[:n]
        return sweep * np.sin(np.pi * t / t[-1]) * 0.6
    if name == "stamp":
        n = int(0.3 * SR); t = np.arange(n) / SR
        return (kick(n) * 0.9 + onepole_lp(rng.uniform(-1, 1, n), 900) * np.exp(-t * 30) * 0.6)
    if name == "pop":
        n = int(0.12 * SR); t = np.arange(n) / SR
        f = 900 * np.exp(-t * 20) + 300
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 30) * 0.5
    if name == "ping":
        n = int(0.9 * SR); t = np.arange(n) / SR
        return (np.sin(2 * np.pi * 1760 * t) + 0.4 * np.sin(2 * np.pi * 2640 * t)) * np.exp(-t * 5) * 0.35
    if name == "ding":
        n = int(1.0 * SR); t = np.arange(n) / SR
        return sum(np.sin(2 * np.pi * f * t) * np.exp(-t * d) for f, d in ((1318, 4), (1976, 6), (2637, 8))) * 0.22
    if name == "glitch":
        n = int(0.35 * SR)
        x = np.sign(np.sin(2 * np.pi * rng.uniform(80, 900, n // 400).repeat(400)[:n] * np.arange(n) / SR))
        return x * 0.25 * (rng.uniform(size=n) > 0.15)
    if name == "boom":
        n = int(0.9 * SR); t = np.arange(n) / SR
        return kick(n) * 1.0 + onepole_lp(rng.uniform(-1, 1, n), 200) * np.exp(-t * 5) * 0.5
    if name == "tick":
        n = int(0.05 * SR); t = np.arange(n) / SR
        return np.sin(2 * np.pi * 2400 * t) * np.exp(-t * 120) * 0.35
    if name == "riser":
        n = int(1.5 * SR); t = np.arange(n) / SR
        return np.sin(2 * np.pi * np.cumsum(200 + 1600 * (t / t[-1]) ** 2) / SR) * (t / t[-1]) ** 2 * 0.18
    return np.zeros(1)


def mix():
    tl = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
    voice, _ = sf.read(BUILD / "voice.wav", dtype="float32")
    mus, _ = sf.read(BUILD / "music.wav", dtype="float32")
    n = len(voice)
    mus = np.pad(mus, (0, max(0, n - len(mus))))[:n]
    # duck the music under the voice using the per-frame envelope
    env = np.repeat(np.array(tl["env"] + [0.0]), SR // tl["fps"])[:n]
    env = np.pad(env, (0, max(0, n - len(env))))
    duck = onepole_lp(np.where(env > 0.05, 1.0, 0.0), 6.0)
    music_gain = 0.55 - 0.33 * np.clip(duck, 0, 1)
    out = voice * 1.0 + mus * music_gain
    cues_path = BUILD / "cues.json"
    if cues_path.exists():
        for cue in json.loads(cues_path.read_text(encoding="utf-8")):
            s = sfx(cue["sfx"]).astype(np.float32) * cue.get("gain", 1.0)
            i = int(cue["t"] * SR)
            if 0 <= i < n:
                m = min(len(s), n - i)
                out[i:i + m] += s[:m] * 0.55
    peak = np.max(np.abs(out)) or 1
    sf.write(BUILD / "audio.wav", (out / peak * 0.95).astype(np.float32), SR)
    print("mixed", round(n / SR, 2), "s")


if __name__ == "__main__":
    if "--mix" in sys.argv:
        mix()
    else:
        tl = json.loads((BUILD / "timeline.json").read_text(encoding="utf-8"))
        sf.write(BUILD / "music.wav", music(tl["duration"], tl.get("bpm", 118), tl["scenes"]), SR)
        print("music", tl["duration"], "s")
