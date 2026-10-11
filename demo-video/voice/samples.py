# Voice audition: renders the same lines with Chatterbox (open-source, expressive TTS) so we can pick one by ear.
# Female versions clone the timbre of a real reader picked by refs.py (LibriSpeech, CC BY 4.0);
# Chatterbox supplies the expressiveness. Runs in GitHub Actions (CPU); output: samples/*.wav
import json, sys, time, traceback
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
# Between "calm" (0.5 / 0.5) and "lively" (0.75 / 0.4). exaggeration = emotion; lower cfg_weight = looser pacing.
EXAG, CFG = 0.6, 0.45

chosen = json.loads((HERE / "refs" / "chosen.json").read_text())
model = ChatterboxTTS.from_pretrained(device="cpu")
print("torch", torch.__version__, "sample rate", model.sr)
ok = 0
for i, r in enumerate(chosen, 1):
    t0 = time.time()
    try:
        wav = model.generate(TEXT, exaggeration=EXAG, cfg_weight=CFG, audio_prompt_path=str(HERE / "refs" / f"{r['speaker']}.wav"))
        ta.save(str(OUT / f"option{i}_reader{r['speaker']}.wav"), wav, model.sr)
        ok += 1
        print(f"option {i} (reader {r['speaker']}, spread {r['pitch_spread_st']} st): {wav.shape[-1] / model.sr:.1f}s in {time.time() - t0:.0f}s")
    except Exception:
        traceback.print_exc()
sys.exit(0 if ok else 1)
