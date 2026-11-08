"""Synthesise many narration lines with VieNeu-TTS in one process (the model loads once).

Input: a JSON file [{"text": "...", "out": "/abs/path.wav"}, ...] and a preset voice name.
Usage: vieneu-env/bin/python scripts/vieneu_batch.py jobs.json "Hải Đăng"
"""
import json
import sys

from vieneu import Vieneu


def main() -> None:
    jobs_path, voice_name = sys.argv[1], sys.argv[2]
    with open(jobs_path, encoding="utf-8") as f:
        jobs = json.load(f)
    tts = Vieneu()
    voice = tts.get_preset_voice(voice_name)
    for i, job in enumerate(jobs, 1):
        audio = tts.infer(job["text"], voice=voice)
        tts.save(audio, job["out"])
        print(f"  [{i}/{len(jobs)}] {job['text'][:60]}", flush=True)


if __name__ == "__main__":
    main()
