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
        a = max(0.0, words[0]["start"] - 0.06) if words else 0.0
        b = min(len(y) / sr, words[-1]["end"] + 0.14) if words else len(y) / sr
        y = y[int(a * sr):int(b * sr)]
        y = speed_up(y, sr)
        words = [{"w": w["w"], "start": (w["start"] - a) / TEMPO + a, "end": (w["end"] - a) / TEMPO + a} for w in words]
        fade = int(0.012 * sr)
        y[:fade] *= np.linspace(0, 1, fade)
        y[-fade:] *= np.linspace(1, 0, fade)
        y48 = resample_poly(y, SR, sr)
        start = round(t * FPS) / FPS
        place(y48, start)
        dur = len(y48) / SR
        out_lines.append({
            "id": l["id"], "scene": sc["id"], "start": round(start, 3), "dur": round(dur, 3),
            "cap": l["cap"], "say": l["say"], "score": meta["score"],
            "words": [{"w": w["w"], "t0": round(start + w["start"] - a, 3), "t1": round(start + w["end"] - a, 3)} for w in words],
        })
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

tl = {"fps": FPS, "duration": dur, "scenes": scenes, "lines": out_lines, "env": env}
(ROOT / "build" / "timeline.json").write_text(json.dumps(tl))
print(f"duration {dur:.2f}s, {len(out_lines)} lines")
for l in out_lines:
    print(f"  {l['start']:7.2f} +{l['dur']:5.2f}  {l['id']:7s} score {l['score']:.3f}  {l['cap']}")
