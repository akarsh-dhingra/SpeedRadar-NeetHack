# Voice audition: renders the same lines with Chatterbox (open-source, expressive TTS) so we can pick one by ear.
# Female versions clone the timbre of a short reference clip (a free Edge neural voice, made by refs.py);
# Chatterbox supplies the expressiveness. Runs in GitHub Actions (CPU); output: samples/*.wav
import sys, time, traceback
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS

HERE = Path(__file__).parent
OUT = HERE / "samples"
OUT.mkdir(exist_ok=True)

TEXT = ("Your competitor just doubled their ML team. And you? You'll find out next quarter! "
        "Or... you could ask Spend Radar. It reads your books, scans the market, "
        "and argues with itself before it tells you anything.")

# (name, reference clip or None for the built-in voice, exaggeration, cfg_weight)
# exaggeration: emotion intensity (0.5 = neutral). cfg_weight: lower = looser, more dramatic pacing.
SETTINGS = [
    ("female-ava_mix", HERE / "refs" / "ava.wav", 0.6, 0.45),
    ("female-emma_mix", HERE / "refs" / "emma.wav", 0.6, 0.45),
    ("female-jenny_mix", HERE / "refs" / "jenny.wav", 0.6, 0.45),
]

model = ChatterboxTTS.from_pretrained(device="cpu")
print("torch", torch.__version__, "sample rate", model.sr)
ok = 0
for name, ref, exag, cfg in SETTINGS:
    t0 = time.time()
    try:
        kw = {"audio_prompt_path": str(ref)} if ref else {}
        wav = model.generate(TEXT, exaggeration=exag, cfg_weight=cfg, **kw)
        ta.save(str(OUT / f"chatterbox_{name}_ex{exag}_cfg{cfg}.wav"), wav, model.sr)
        ok += 1
        print(f"{name}: {wav.shape[-1] / model.sr:.1f}s audio in {time.time() - t0:.0f}s")
    except Exception:
        traceback.print_exc()
sys.exit(0 if ok else 1)
