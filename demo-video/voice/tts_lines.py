# Narration, one line at a time, with Chatterbox cloning the chosen reader (refs/<speaker>.wav).
# Each take is checked with Whisper: if the words heard don't match the script, it retries with a new seed
# and keeps the best take. Runs as one of N parallel shards in GitHub Actions (CPU).
#   python tts_lines.py <shard> <shards>  ->  ../build/voice/lines/<line id>.wav + .json (score, seed, word times)
import difflib, json, re, sys, time
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS
from faster_whisper import WhisperModel
from num2words import num2words

HERE = Path(__file__).parent
ROOT = HERE.parent
OUT = ROOT / "build" / "voice" / "lines"
OUT.mkdir(parents=True, exist_ok=True)
SEEDS = (11, 23, 37, 51)
GOOD = 0.9  # accept a take once its words match the script this closely

shard, shards = int(sys.argv[1]), int(sys.argv[2])
script = json.loads((ROOT / "script.json").read_text(encoding="utf-8"))
voice = script["voice"]
speaker = voice["reference"].split("reader ")[1].split()[0]
ref = HERE / "refs" / f"{speaker}.wav"
lines = [l for s in script["scenes"] for l in s["lines"]]

# Longest-first greedy split so shards finish at about the same time.
loads, mine = [0] * shards, []
for i, l in sorted(enumerate(lines), key=lambda x: -len(x[1]["say"])):
    k = loads.index(min(loads))
    loads[k] += len(l["say"])
    if k == shard:
        mine.append(l)


def norm(text):
    t = text.lower().replace("$", "").replace("%", " percent")
    t = re.sub(r"(?<=\d),(?=\d)", "", t)
    t = re.sub(r"(?<=\d)\s+\.(?=\d)", ".", t)  # Whisper writes "26 .6"
    t = re.sub(r"\d+(?:\.\d+)?", lambda m: " " + num2words(float(m.group()) if "." in m.group() else int(m.group())) + " ", t)
    return re.sub(r"[^a-z]", "", t)


model = ChatterboxTTS.from_pretrained(device="cpu")
asr = WhisperModel("small.en", device="cpu", compute_type="int8")
print(f"shard {shard}/{shards}: {[l['id'] for l in mine]}")

for l in mine:
    exag = l.get("exag", voice["exaggeration"])
    old = OUT / f"{l['id']}.json"
    if old.exists() and (OUT / f"{l['id']}.wav").exists():  # reuse a cached take if it is for this exact line
        prev = json.loads(old.read_text())
        same = prev.get("say", l["say"]) == l["say"] and prev.get("exag", exag) == exag
        need = 0.85 if "say" in prev else 0.95  # older takes didn't record their text: demand a near-exact match
        if same and difflib.SequenceMatcher(None, norm(l["say"]), norm(prev["heard"])).ratio() >= need:
            print(f"  {l['id']}: cached take (seed {prev['seed']})")
            continue
    best = None
    for seed in SEEDS:
        t0 = time.time()
        torch.manual_seed(seed)
        wav = model.generate(l["say"], audio_prompt_path=str(ref),
                             exaggeration=exag, cfg_weight=voice["cfg_weight"])
        tmp = OUT / f"{l['id']}.take.wav"
        ta.save(str(tmp), wav, model.sr)
        segs, _ = asr.transcribe(str(tmp), language="en", beam_size=5, word_timestamps=True)
        words = [{"w": w.word.strip(), "start": round(w.start, 3), "end": round(w.end, 3)} for s in segs for w in s.words]
        heard = " ".join(w["w"] for w in words)
        score = difflib.SequenceMatcher(None, norm(l["say"]), norm(heard)).ratio()
        print(f"  {l['id']} seed {seed}: score {score:.3f} in {time.time() - t0:.0f}s | heard: {heard}")
        if best is None or score > best["score"]:
            best = {"id": l["id"], "say": l["say"], "exag": exag, "seed": seed, "score": round(score, 3), "heard": heard, "words": words, "sr": model.sr}
            tmp.replace(OUT / f"{l['id']}.wav")
        else:
            tmp.unlink()
        if score >= GOOD:
            break
    (OUT / f"{l['id']}.json").write_text(json.dumps(best, indent=1))
    if best["score"] < GOOD:
        print(f"  WARNING {l['id']}: best take only {best['score']:.3f}")
