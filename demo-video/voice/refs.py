# Makes short female reference clips (free Edge neural voices) whose timbre Chatterbox clones: refs/<name>.wav
import asyncio, subprocess
from pathlib import Path

import edge_tts

REFS = Path(__file__).parent / "refs"
REFS.mkdir(exist_ok=True)
TEXT = ("Oh, this is my favourite part! We tried something new this weekend, and honestly? "
        "It worked better than any of us expected. Let me show you how.")
VOICES = {"ava": "en-US-AvaMultilingualNeural", "emma": "en-US-EmmaMultilingualNeural", "jenny": "en-US-JennyNeural"}


async def main():
    for name, voice in VOICES.items():
        mp3 = REFS / f"{name}.mp3"
        await edge_tts.Communicate(TEXT, voice).save(str(mp3))
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ar", "24000", "-ac", "1", str(REFS / f"{name}.wav")], check=True)
        print("ref", name)


asyncio.run(main())
