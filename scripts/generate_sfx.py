"""Synthesizes the video sound effects into public/sfx/*.mp3.

All sounds are generated from scratch (no third-party samples), so there is nothing to license.
They are deliberately soft: the narration must stay on top.

Usage: python3 scripts/generate_sfx.py
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'sfx')


def t_axis(sec):
    return np.arange(int(SR * sec)) / SR


def lowpass(x, cutoff):
    """One-pole low-pass; cutoff may be an array (Hz per sample) for sweeps."""
    cutoff = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def fade_edges(x, ms=4):
    n = int(SR * ms / 1000)
    x[:n] *= np.linspace(0, 1, n)
    x[-n:] *= np.linspace(1, 0, n)
    return x


def whoosh():
    """Air sweep for scene changes: noise whose brightness rises then falls."""
    t = t_axis(0.55)
    p = t / t[-1]
    env = np.sin(np.pi * p ** 0.7) ** 2
    rng = np.random.default_rng(7)
    noise = rng.standard_normal(len(t))
    sweep = 300 + 2600 * np.sin(np.pi * p) ** 1.5
    band = lowpass(noise, sweep) - lowpass(noise, sweep * 0.25)
    return band * env * 0.9


def pop():
    """Soft bubble pop for an element appearing."""
    t = t_axis(0.11)
    freq = 520 * np.exp(-t * 18) + 260
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * np.exp(-t * 42) * 0.8


def tick():
    """Tiny UI tick for counters and small state changes."""
    t = t_axis(0.04)
    return (np.sin(2 * np.pi * 2100 * t) * 0.6 + np.sin(2 * np.pi * 3400 * t) * 0.3) * np.exp(-t * 160)


def ding():
    """Two-note chime for a correct / safe outcome."""
    out = np.zeros(int(SR * 0.9))
    for start, f in ((0.0, 988), (0.09, 1319)):
        t = t_axis(0.9 - start)
        s = int(SR * start)
        tone = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2.01 * t)
        out[s:] += tone * np.exp(-t * 5.5) * 0.45
    return out


def error():
    """Muted double buzz for a failure (broker dies, data lost)."""
    out = np.zeros(int(SR * 0.42))
    for start in (0.0, 0.17):
        t = t_axis(0.16)
        s = int(SR * start)
        wave_ = np.tanh(3 * np.sin(2 * np.pi * 150 * t)) + 0.5 * np.sin(2 * np.pi * 300 * t)
        out[s:s + len(t)] += lowpass(wave_, 900.0) * np.exp(-t * 9) * 0.5
    return out


def write_mp3(name, x):
    x = fade_edges(x.astype(np.float64))
    x = x / max(1e-9, np.abs(x).max()) * 0.85
    pcm = (x * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as f:
        path = f.name
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, f'{name}.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', path, '-b:a', '128k', dst], check=True)
    os.remove(path)
    print('wrote', os.path.relpath(dst))


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (('whoosh', whoosh), ('pop', pop), ('tick', tick), ('ding', ding), ('error', error)):
        write_mp3(name, fn())
