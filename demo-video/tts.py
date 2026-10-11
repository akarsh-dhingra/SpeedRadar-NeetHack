"""Narration: one Kokoro clip per line, laid out on the beat grid.

Writes build/voice.wav (48 kHz mono) and build/timeline.json:
  scenes[] {id, start, end}, lines[] {id, scene, start, dur, cap, big, progress[[t_rel, frac]]},
  env[] voice loudness per video frame (0..1) — the mascot's mouth reads this, so lips follow the
  actual audio by construction; captions highlight by `progress` (fraction of the spoken text reached).
"""
import json
import math
import re
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

HERE = Path(__file__).parent
BUILD = HERE / "build"
SR_IN, SR = 24000, 48000
FPS = 30
GAP = 0.18          # silence between lines of one scene
SNAP = 0.25         # lines start on the 16th-note grid at 120 BPM


def trim(a, thr=0.012, keep=0.03):
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a
    s = max(0, idx[0] - int(keep * SR_IN))
    e = min(len(a), idx[-1] + int(keep * SR_IN))
    return a[s:e], s / SR_IN


def speak(pipe, text, voice, speed):
    audio, words, off = [], [], 0.0
    for r in pipe(text, voice=voice, speed=speed):
        a = r.audio.detach().cpu().numpy() if hasattr(r.audio, "detach") else np.asarray(r.audio)
        for tok in (getattr(r, "tokens", None) or []):
            st, et = getattr(tok, "start_ts", None), getattr(tok, "end_ts", None)
            if st is not None and et is not None and tok.text.strip():
                words.append((tok.text, off + st, off + et))
        audio.append(a)
        off += len(a) / SR_IN
    a = np.concatenate(audio).astype(np.float32)
    a, lead = trim(a)
    words = [(w, s - lead, e - lead) for w, s, e in words]
    return a, words


def progress_curve(text, words, dur):
    """[t, fraction-of-letters-spoken] points; falls back to linear when no word timings."""
    letters = lambda s: len(re.sub(r"[^A-Za-z0-9]", "", s))
    total = max(1, letters(text))
    pts, done = [[0.0, 0.0]], 0
    for w, s, e in words:
        done += letters(w)
        pts.append([round(max(0.0, min(dur, e)), 3), round(min(1.0, done / total), 4)])
    if len(pts) < 3:
        pts = [[0.0, 0.0], [round(dur, 3), 1.0]]
    pts.append([round(dur, 3), 1.0])
    return pts


def main():
    spec = json.loads((HERE / "script.json").read_text(encoding="utf-8"))
    pipe = KPipeline(lang_code="a")
    clips, scenes, lines = [], [], []
    t = 0.0
    beat = 60.0 / spec["bpm"]
    for sc in spec["scenes"]:
        start = t
        t += sc.get("pad_before", 0.3)
        for ln in sc["lines"]:
            a, words = speak(pipe, ln["say"], spec["voice"], spec["speed"])
            dur = len(a) / SR_IN
            t = math.ceil(t / SNAP - 1e-9) * SNAP
            lines.append({"id": ln["id"], "scene": sc["id"], "start": round(t, 3), "dur": round(dur, 3),
                          "cap": ln["cap"], "big": bool(ln.get("big")),
                          "words": len(words), "progress": progress_curve(ln["say"], words, dur)})
            clips.append((t, a))
            print(f"{ln['id']:7s} {t:7.2f}s  {dur:5.2f}s  words={len(words)}")
            t += dur + GAP
        t += sc.get("pad_after", 0.5)
        t = math.ceil(t / beat - 1e-9) * beat          # every cut lands on a beat
        scenes.append({"id": sc["id"], "start": round(start, 3), "end": round(t, 3)})

    total = t
    voice = np.zeros(int(total * SR_IN) + SR_IN, np.float32)
    for s, a in clips:
        i = int(round(s * SR_IN))
        voice[i:i + len(a)] += a
    voice = voice[: int(total * SR_IN)]
    peak = np.max(np.abs(voice)) or 1.0
    voice = voice / peak * 0.89

    # loudness per video frame for the mouth: RMS over the frame, then a fast attack / slower release
    hop = SR_IN // FPS
    n = int(total * FPS)
    rms = np.array([np.sqrt(np.mean(voice[i * hop:(i + 1) * hop] ** 2)) for i in range(n)])
    ref = np.percentile(rms[rms > 1e-4], 95) if np.any(rms > 1e-4) else 1.0
    env, cur = [], 0.0
    for v in np.clip(rms / ref, 0, 1):
        cur = v if v > cur else cur * 0.55 + v * 0.45
        env.append(round(float(cur if cur > 0.06 else 0.0), 3))

    BUILD.mkdir(exist_ok=True)
    up = np.interp(np.arange(int(total * SR)) / SR, np.arange(len(voice)) / SR_IN, voice).astype(np.float32)
    sf.write(BUILD / "voice.wav", up, SR)
    (BUILD / "timeline.json").write_text(json.dumps(
        {"fps": FPS, "bpm": spec["bpm"], "duration": round(total, 3), "scenes": scenes, "lines": lines, "env": env}),
        encoding="utf-8")
    print(f"total {total:.2f}s, {len(lines)} lines, word timings on {sum(1 for l in lines if l['words'])} lines")


if __name__ == "__main__":
    main()
