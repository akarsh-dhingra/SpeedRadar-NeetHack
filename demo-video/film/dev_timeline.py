# Local stand-in for build/timeline.json (the real one comes from the narration in CI): estimates each line's
# length and word times from the script at ~2.9 words/s, so stills can be checked before the voice exists.
import json
from pathlib import Path

ROOT = Path(__file__).parent.parent
script = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
FPS, WPS = 30, 2.9
t, scenes, lines = 0.0, [], []
for sc in script["scenes"]:
    s0 = t
    t += sc.get("pad_before", 0.2)
    for i, l in enumerate(sc["lines"]):
        words = l["say"].split()
        start, words_out = round(t * FPS) / FPS, []
        for w in words:
            d = 0.12 + 0.045 * len(w)
            words_out.append({"w": w, "t0": round(t, 3), "t1": round(t + d, 3)})
            t += d + (0.25 if w[-1] in ".,!?" else 0.03)
        dur_l = round(t - start, 3)
        tot = sum(len(w["w"]) for w in words_out) or 1
        acc, prog = 0, [[0.0, 0.0]]
        for w in words_out:
            acc += len(w["w"]); prog.append([round(w["t1"] - start, 3), round(acc / tot, 4)])
        prog.append([dur_l, 1.0])
        lines.append({"id": l["id"], "scene": sc["id"], "start": start, "dur": dur_l, "cap": l["cap"], "say": l["say"], "score": 1, "words": words_out, "big": bool(l.get("big")), "progress": prog})
        t += 0.16 if i < len(sc["lines"]) - 1 else 0
    t += sc.get("pad_after", 0.25)
    scenes.append({"id": sc["id"], "start": round(s0, 3), "end": round(t, 3)})
dur = round(t * FPS) / FPS
env = [0.0] * int(dur * FPS)
for l in lines:
    for w in l["words"]:
        for f in range(int(w["t0"] * FPS), int(w["t1"] * FPS)):
            env[f] = 0.75
(ROOT / "build").mkdir(exist_ok=True)
(ROOT / "build" / "timeline.json").write_text(json.dumps({"fps": FPS, "bpm": script.get("bpm", 118), "duration": dur, "scenes": scenes, "lines": lines, "env": env, "dev": True}))
print(f"dev timeline: {dur:.1f}s, {len(lines)} lines")
