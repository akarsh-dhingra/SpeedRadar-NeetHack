# Picks female reference voices from real human recordings (LibriSpeech dev-clean, CC BY 4.0, openslr.org/12)
# for Chatterbox to clone. Ranks the female readers by pitch variation (livelier readers first) and keeps the top N.
# Expects the extracted corpus at ./LibriSpeech. Writes refs/<speaker>.wav (24 kHz mono), refs/<speaker>.mp3, refs/chosen.json
import json, subprocess, sys
from pathlib import Path

import librosa
import numpy as np
import soundfile as sf

HERE = Path(__file__).parent
CORPUS = HERE / "LibriSpeech"
REFS = HERE / "refs"
REFS.mkdir(exist_ok=True)
# `python refs.py 6` keeps the 6 liveliest readers; `python refs.py --speaker 1673` keeps just that reader.
ONLY = sys.argv[2] if len(sys.argv) > 2 and sys.argv[1] == "--speaker" else None
KEEP = 1 if ONLY else (int(sys.argv[1]) if len(sys.argv) > 1 else 6)
TARGET_S = 12.0


def female_ids():
    """Speaker sex from SPEAKERS.TXT if the archive has it; else None (fall back to pitch)."""
    p = CORPUS / "SPEAKERS.TXT"
    if not p.exists():
        return None
    ids = set()
    for line in p.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith(";"):
            continue
        parts = [x.strip() for x in line.split("|")]
        if len(parts) >= 3 and parts[1] == "F" and parts[2] == "dev-clean":
            ids.add(parts[0])
    return ids


def clip_for(spk_dir):
    """~12 s of consecutive utterances from the speaker's first chapter."""
    chapter = sorted(p for p in spk_dir.iterdir() if p.is_dir())[0]
    audio, total = [], 0.0
    for f in sorted(chapter.glob("*.flac")):
        y, sr = sf.read(str(f))
        audio.append(y)
        audio.append(np.zeros(int(0.25 * sr)))
        total += len(y) / sr
        if total >= TARGET_S:
            break
    return np.concatenate(audio), sr


females = female_ids()
print("SPEAKERS.TXT female ids:", None if females is None else len(females))
rows = []
for spk_dir in sorted(p for p in (CORPUS / "dev-clean").iterdir() if p.is_dir()):
    spk = spk_dir.name
    if ONLY and spk != ONLY:
        continue
    if females is not None and spk not in females:
        continue
    y, sr = clip_for(spk_dir)
    y16 = librosa.resample(y, orig_sr=sr, target_sr=16000) if sr != 16000 else y
    f0, voiced, _ = librosa.pyin(y16, fmin=70, fmax=500, sr=16000)
    f0 = f0[voiced & ~np.isnan(f0)]
    if len(f0) < 50:
        continue
    median = float(np.median(f0))
    if females is None and median < 165:  # no sex labels: keep higher-pitched voices only
        continue
    spread = float(np.std(12 * np.log2(f0 / median)))  # pitch variation in semitones
    rows.append({"speaker": spk, "median_hz": round(median, 1), "pitch_spread_st": round(spread, 2), "seconds": round(len(y) / sr, 1)})
    rows[-1]["_audio"] = (y, sr)

rows.sort(key=lambda r: -r["pitch_spread_st"])
chosen = rows[:KEEP]
for r in chosen:
    y, sr = r.pop("_audio")
    wav = REFS / f"{r['speaker']}.wav"
    sf.write(str(wav), librosa.resample(y, orig_sr=sr, target_sr=24000), 24000)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-b:a", "128k", str(REFS / f"{r['speaker']}.mp3")], check=True)
for r in rows[KEEP:]:
    r.pop("_audio", None)
print(json.dumps(rows, indent=1))
(REFS / "chosen.json").write_text(json.dumps(chosen, indent=1))
print("chosen:", [r["speaker"] for r in chosen])
