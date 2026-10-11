# Voice audition: renders the same two lines with Chatterbox (open-source, expressive TTS) at several
# expressiveness settings, so we can pick one by ear. Runs in GitHub Actions (CPU); output: samples/*.wav
import sys, time, traceback
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS

OUT = Path(__file__).parent / "samples"
OUT.mkdir(exist_ok=True)

TEXT = ("Your competitor just doubled their ML team. And you? You'll find out next quarter! "
        "Or... you could ask Spend Radar. It reads your books, scans the market, "
        "and argues with itself before it tells you anything.")

# exaggeration: emotion intensity (0.5 = neutral). cfg_weight: lower = looser, more dramatic pacing.
SETTINGS = [("calm", 0.5, 0.5), ("lively", 0.75, 0.4), ("hype", 1.0, 0.3)]

model = ChatterboxTTS.from_pretrained(device="cpu")
print("torch", torch.__version__, "sample rate", model.sr)
ok = 0
for name, exag, cfg in SETTINGS:
    t0 = time.time()
    try:
        wav = model.generate(TEXT, exaggeration=exag, cfg_weight=cfg)
        ta.save(str(OUT / f"chatterbox_{name}_ex{exag}_cfg{cfg}.wav"), wav, model.sr)
        ok += 1
        print(f"{name}: {wav.shape[-1] / model.sr:.1f}s audio in {time.time() - t0:.0f}s")
    except Exception:
        traceback.print_exc()
sys.exit(0 if ok else 1)
