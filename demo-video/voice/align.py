# Joins the narration lines into one track and writes the timeline every other step follows.
#   ../build/voice/lines/*.wav + .json  ->  ../build/voice.wav (48 kHz mono) + ../build/timeline.json
# Each take is trimmed to its first/last spoken word (Whisper times), so no stray breaths or tails.
# timeline.json: fps, duration, scenes[{id,start,end}], lines[{id,scene,start,dur,cap,say,words[{w,t0,t1}]}],
#                env (voice loudness per video frame, 0..1, for anything that should move with the voice)
import difflib, json, re, subprocess, tempfile
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
    return y, w, 0.0


PUNCT = script["voice"].get("pauses", {})


def pause_after(tok):
    """Target silence after a word, from its trailing punctuation (None = no pause: keep the phrase together)."""
    t = tok.rstrip("\"'”’)")
    if t.endswith("...") or t.endswith("…"):
        return PUNCT.get("ellipsis", 0.6)
    if t.endswith("?"):
        return PUNCT.get("question", 0.38)
    if t.endswith((".", "!")):
        return PUNCT.get("sentence", 0.42)
    if t.endswith((":", ";", "—", "–")):
        return PUNCT.get("colon", 0.26)
    if t.endswith(","):
        return PUNCT.get("comma", 0.2)
    return None


def pace(y, sr, words, say):
    """Make the pauses follow the script's punctuation, like a person reading it: a full beat after a sentence,
    a short one after a comma, and no gaps inside a phrase (those read as a new sentence starting).
    The script's punctuation is carried onto Whisper's words by aligning the two token lists."""
    norm = lambda x: re.sub(r"[^a-z0-9]", "", x.lower())
    say_t = say.replace("—", " — ").split()
    sv = [norm(x) for x in say_t]
    hv = [norm(x["w"]) for x in words]
    target = [pause_after(x["w"]) for x in words]  # Whisper's own punctuation first
    for blk in difflib.SequenceMatcher(None, sv, hv, autojunk=False).get_matching_blocks():
        for k in range(blk.size):
            i, j = blk.a + k, blk.b + k
            nxt = say_t[i + 1] if i + 1 < len(say_t) else ""
            tp = pause_after(say_t[i]) or (pause_after("x" + nxt) if nxt in ("—", "–") else None)
            if tp is not None or target[j] is None:
                target[j] = tp
    db, n = rms_db(y, sr)
    max_in = PUNCT.get("within_phrase_max", 0.1)
    edits = []  # (at_seconds, delta_seconds): negative = cut, positive = insert silence
    for j in range(len(words) - 1):
        e, s_ = words[j]["end"], words[j + 1]["start"]
        gap, want = s_ - e, target[j]
        if want is None:
            want = min(gap, max_in)
        if gap > want + 0.03:
            # cut the excess from the middle of the gap, only where it is actually quiet
            mid0, mid1 = e + want / 2, s_ - want / 2
            f0, f1 = int(mid0 * sr / n), max(int(mid0 * sr / n) + 1, int(mid1 * sr / n))
            if f1 <= len(db) and np.mean(db[f0:f1]) < -28:
                edits.append((mid0, -(mid1 - mid0)))
        elif gap < want - 0.04 and target[j] is not None:
            edits.append(((e + s_) / 2, want - gap))
    for at, d in sorted(edits, reverse=True):
        i0 = int(at * sr)
        if d < 0:
            i1 = int((at - d) * sr)
            xf = min(int(0.008 * sr), i0, len(y) - i1)
            if xf > 0:
                y[i0 - xf:i0] = y[i0 - xf:i0] * np.linspace(1, 0, xf) + y[i1 - xf:i1] * np.linspace(0, 1, xf)
            y = np.concatenate([y[:i0], y[i1:]])
        else:
            y = np.concatenate([y[:i0], np.zeros(int(d * sr)), y[i0:]])
        for x in words:
            if x["start"] >= at:
                x["start"] += d
                x["end"] += d
    return y, words, target



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
        y, words, _ = pace(y, sr, words, l["say"])
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
        t = start + dur + ((pause_after(l["say"].split()[-1]) or PUNCT.get("between_lines", 0.32)) if i < len(sc["lines"]) - 1 else 0)
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
