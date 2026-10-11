# Demo film

A ~2½-minute demo film for neatHack, rendered from code. Nothing here needs a GPU or paid service.

| File | Role |
|---|---|
| `script.json` | narration lines (spoken text, captions) with the evidence source of every number |
| `tts.py` | narration with Kokoro (local, open-source voice model); lays lines on a 120 BPM grid; writes the per-frame voice envelope that drives the mascot's mouth and the word timing that drives caption highlights |
| `music.py` | original synth-pop bed and sound effects, all synthesized; `--mix` ducks the music under the voice |
| `record_site.mjs` | films the real evidence site (`../site`) in headless Chrome |
| `comp/` | the film: a deterministic canvas renderer, `__render(t)` |
| `render.mjs` | renders frames (or one shard of them) and pipes them to ffmpeg |

Rendering runs on GitHub Actions (`.github/workflows/demo-video.yml`) on pushes to the `demo-video` branch: one prep job, eight render shards in parallel, one assemble job. The finished MP4 is the `spend-radar-demo` workflow artifact.

Style references the paper-and-watercolour look of the "P(DOOM)" music video; no audio or artwork from it is used.
