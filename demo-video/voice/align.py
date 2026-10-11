# Joins the narration lines into one track and writes the timeline every other step follows.
#   ../build/voice/lines/*.wav + .json  ->  ../build/voice.wav (48 kHz mono) + ../build/timeline.json
# Each take is trimmed to its first/last spoken word (Whisper times), so no stray breaths or tails.
# timeline.json: fps, duration, scenes[{id,start,end}], lines[{id,scene,start,dur,cap,say,words[{w,t0,t1}]}],
#                env (voice loudness per video frame, 0..1, for anything that should move with the voice)
import json, subprocess, tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

ROOT = Path(__file__).parent.parent
LINES = ROOT / "build" / "voice" / "lines"
FPS, SR = 30, 48000
GAP = 0.16  # between lines in the same scene

script = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
TEMPO = script["voice"].get("tempo", 1.0)  # pitch-preserving speed-up (ffmpeg atempo)


def speed_up(y, sr):
    if TEMPO == 1.0:
        return y
    with tempfile.TemporaryDirectory() as d:
        a, b = Path(d) / "a.wav", Path(d) / "b.wav"
        sf.write(str(a), y, sr)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(a), "-filter:a", f"atempo={TEMPO}", str(b)], check=True)
        return sf.read(str(b))[0]
t = 0.0
track = np.zeros(SR * 300)  # 5 minutes is far more than the film needs
scenes, out_lines = [], []


def rms_db(y, sr, win=0.01):
    n = max(1, int(win * sr))
    frames = len(y) // n
    r = np.sqrt(np.mean(y[: frames * n].reshape(frames, n) ** 2, axis=1) + 1e-12)
    return 20 * np.log10(r / (np.max(r) + 1e-12)), n


def clean_take(y, sr, words):
    """Trim to the voice itself and shorten long pauses, so lines join without stutters or dead air.
    Head/tail follow loudness around Whisper's first/last word (never cutting a word, never keeping a trailing
    syllable the model added after it); pauses over 0.45 s inside the take shrink to 0.28 s. Word times follow."""
    db, n = rms_db(y, sr)
    quiet = db < -38
    if words:
        i0 = int(words[0]["start"] * sr / n)
        loud = np.nonzero(~quiet)[0]
        if len(loud):
            i0 = max(i0, int(loud[0]) - 1)  # Whisper often reports 0.0 for the first word: start at the first sound
        while i0 > 0 and not quiet[i0 - 1] and words[0]["start"] - (i0 - 1) * n / sr < 0.12:
            i0 -= 1
        i1 = min(len(db) - 1, int(words[-1]["end"] * sr / n))
        while i1 < len(db) - 1 and not quiet[i1 + 1] and (i1 + 1) * n / sr - words[-1]["end"] < 0.12:
            i1 += 1
        a, b = max(0.0, i0 * n / sr - 0.02), min(len(y) / sr, (i1 + 1) * n / sr + 0.03)
    else:
        a, b = 0.0, len(y) / sr
    y = y[int(a * sr):int(b * sr)].copy()
    w = [{"w": x["w"], "start": max(0.0, x["start"] - a), "end": max(0.05, x["end"] - a)} for x in words]
    # shorten long internal pauses (only between words, never inside one)
    db, n = rms_db(y, sr)
    quiet = db < -38
    cuts, k = [], 0
    while k < len(quiet):
        if quiet[k]:
            j = k
            while j < len(quiet) and quiet[j]:
                j += 1
            s0, s1 = k * n / sr, j * n / sr
            inside_word = any(x["start"] < s0 + 0.01 and x["end"] > s1 - 0.01 for x in w)
            if s1 - s0 > 0.45 and 0 < k and j < len(quiet) and not inside_word:
                cuts.append((s0 + 0.14, s1 - 0.14))
            k = j
        else:
            k += 1
    for c0, c1 in reversed(cuts):
        y = np.concatenate([y[: int(c0 * sr)], y[int(c1 * sr):]])
        d = c1 - c0
        for x in w:
            if x["start"] >= c1:
                x["start"] -= d
                x["end"] -= d
    return y, w, 0.0


def place(samples, at):
    i = int(round(at * SR))
    track[i:i + len(samples)] += samples


for sc in script["scenes"]:
    t += sc.get("pad_before", 0.2)
    s0 = t
    for i, l in enumerate(sc["lines"]):
        meta = json.loads((LINES / f"{l['id']}.json").read_text())
        y, sr = sf.read(str(LINES / f"{l['id']}.wav"))
        words = meta["words"]
        y, words, a = clean_take(y, sr, words)
        y = speed_up(y, sr)
        words = [{"w": w["w"], "start": (w["start"] - a) / TEMPO + a, "end": (w["end"] - a) / TEMPO + a} for w in words]
        fi, fo = int(0.015 * sr), int(0.04 * sr)
        y[:fi] *= np.linspace(0, 1, fi)
        y[-fo:] *= np.linspace(1, 0, fo) ** 2
        y48 = resample_poly(y, SR, sr)
        start = round(t * FPS) / FPS
        place(y48, start)
        dur = len(y48) / SR
        out_lines.append({
            "id": l["id"], "scene": sc["id"], "start": round(start, 3), "dur": round(dur, 3),
            "cap": l["cap"], "say": l["say"], "score": meta["score"],
            "words": [{"w": w["w"], "t0": round(start + w["start"] - a, 3), "t1": round(start + w["end"] - a, 3)} for w in words],
            "big": bool(l.get("big")),
        })
        # progress curve for captions: [seconds into the line, fraction of the spoken text said by then]
        ln = out_lines[-1]
        total = sum(len(w["w"]) for w in ln["words"]) or 1
        acc, prog = 0, [[0.0, 0.0]]
        for w in ln["words"]:
            acc += len(w["w"])
            prog.append([round(w["t1"] - start, 3), round(acc / total, 4)])
        prog.append([round(dur, 3), 1.0])
        ln["progress"] = prog
        t = start + dur + (GAP if i < len(sc["lines"]) - 1 else 0)
    t += sc.get("pad_after", 0.25)
    scenes.append({"id": sc["id"], "start": round(s0 - sc.get("pad_before", 0.2), 3), "end": round(t, 3)})

dur = round(t * FPS) / FPS
voice = track[: int(dur * SR)]
peak = np.max(np.abs(voice)) or 1.0
voice = voice / peak * 0.89
sf.write(str(ROOT / "build" / "voice.wav"), voice.astype(np.float32), SR)

# Loudness per video frame: RMS over the frame, fast attack / slower release, gated, 0..1.
hop = SR // FPS
rms = np.array([np.sqrt(np.mean(voice[i:i + hop] ** 2)) for i in range(0, len(voice), hop)])
rms = rms / (np.percentile(rms, 98) or 1)
env, v = [], 0.0
for r in rms:
    v = r if r > v else v * 0.72 + r * 0.28
    env.append(round(float(min(1.0, max(0.0, (v - 0.06) / 0.94))), 3))

tl = {"fps": FPS, "bpm": script.get("bpm", 118), "duration": dur, "scenes": scenes, "lines": out_lines, "env": env}
(ROOT / "build" / "timeline.json").write_text(json.dumps(tl))
print(f"duration {dur:.2f}s, {len(out_lines)} lines")
for l in out_lines:
    print(f"  {l['start']:7.2f} +{l['dur']:5.2f}  {l['id']:7s} score {l['score']:.3f}  {l['cap']}")
