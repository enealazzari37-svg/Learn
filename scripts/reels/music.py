"""Erzeugt einen lizenzfreien Hintergrund-Track (Lo-Fi-Pop, 96 BPM) plus leise Tipp-Geräusche.
Aufruf: python3 music.py <dauer_s> <taps.json> <out.wav>   (taps.json: Liste von Sekunden)"""
import sys, json, wave
import numpy as np

SR = 48000
dur = float(sys.argv[1]); taps = json.load(open(sys.argv[2])) if len(sys.argv) > 2 else []; out = sys.argv[3]
N = int(SR * (dur + 0.5)); L = np.zeros(N); R = np.zeros(N)
BPM = 96; beat = 60 / BPM; bar = beat * 4
rng = np.random.default_rng(7)
mtof = lambda m: 440 * 2 ** ((m - 69) / 12)

def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N or j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * (1 - max(0, pan)); R[i:j] += s * (1 + min(0, pan))

def env(n, a=0.005, d=0.6):
    tt = np.arange(n) / SR
    return np.minimum(1, tt / a) * np.exp(-tt / d)

def epiano(m, length=1.4, vel=0.5):
    n = int(length * SR); tt = np.arange(n) / SR; f = mtof(m)
    s = np.sin(2*np.pi*f*tt) + 0.35*np.sin(2*np.pi*2*f*tt)*np.exp(-tt/0.25) + 0.12*np.sin(2*np.pi*3.01*f*tt)*np.exp(-tt/0.12)
    s *= 1 + 0.15*np.sin(2*np.pi*4.5*tt)   # leichtes Tremolo
    return s * env(n, 0.004, 0.55) * vel

def pad(ms, length):
    n = int(length * SR); tt = np.arange(n) / SR; s = np.zeros(n)
    for m in ms:
        for det in (-0.08, 0.08):
            s += np.sin(2*np.pi*mtof(m + det)*tt + rng.random()*6)
    a = np.minimum(1, tt / 0.6) * np.minimum(1, (length - tt) / 0.5).clip(0)
    return s * a * 0.035

def bass(m, length=0.5):
    n = int(length * SR); tt = np.arange(n) / SR
    s = np.tanh(1.6*np.sin(2*np.pi*mtof(m)*tt)) * env(n, 0.006, 0.35)
    return s * 0.32

def kick():
    n = int(0.4 * SR); tt = np.arange(n) / SR
    f = 45 + 85*np.exp(-tt/0.04); ph = 2*np.pi*np.cumsum(f)/SR
    return np.sin(ph) * np.exp(-tt/0.13) * 0.55

def lp(x, a):  # einfacher Tiefpass (one-pole)
    y = np.empty_like(x); acc = 0.0
    for i in range(len(x)): acc += a * (x[i] - acc); y[i] = acc
    return y

def snare():
    n = int(0.22 * SR); tt = np.arange(n) / SR
    nz = rng.standard_normal(n); nz = lp(nz - lp(nz, 0.12), 0.35)
    return (nz*0.45 + 0.35*np.sin(2*np.pi*190*tt)) * np.exp(-tt/0.06) * 0.13

def hat():
    n = int(0.06 * SR); tt = np.arange(n) / SR
    nz = rng.standard_normal(n); nz = nz - lp(nz, 0.5)
    return lp(nz, 0.7) * np.exp(-tt/0.015) * 0.035

def tick():
    n = int(0.06 * SR); tt = np.arange(n) / SR
    return (np.sin(2*np.pi*1650*tt)*np.exp(-tt/0.012) + 0.4*np.sin(2*np.pi*3300*tt)*np.exp(-tt/0.006)) * 0.16

# Akkorde: Cmaj9 – Am9 – Fmaj9 – G6 (MIDI)
CH = [([48], [60, 64, 67, 71, 74]), ([45], [57, 60, 64, 67, 71]), ([41], [57, 60, 64, 65, 69]), ([43], [55, 59, 62, 64, 67])]
K, S, H = kick(), snare(), hat()
nb = int(dur / bar) + 2
for b in range(nb):
    t0 = b * bar; root, ch = CH[b % 4]
    add(pad(ch, bar + 0.4), t0, 0, 1)
    for off, v in ((0, .55), (1.5, .4), (3, .45)):                      # E-Piano-Rhythmus
        for k, m in enumerate(ch[:4]): add(epiano(m, 1.3, v * 0.22), t0 + off*beat + k*0.008, (-0.25, 0.25)[k % 2])
    if b >= 1:                                                            # Schlagzeug ab Takt 2
        for q in (0, 2.5): add(K, t0 + q*beat)
        for q in (1, 3): add(S, t0 + q*beat, 0.1)
        for e in range(8): add(H, t0 + e*beat/2 + (0.02 if e % 2 else 0), 0.3, 1 if e % 2 else 0.6)
    add(bass(root[0], 0.9), t0); add(bass(root[0], 0.4), t0 + 2.5*beat); add(bass(root[0] + 12 if b % 2 else root[0] + 7, 0.35), t0 + 3.5*beat)

# einfacher Hall (mehrere Echos)
for d, g in ((0.031, .22), (0.047, .18), (0.073, .14), (0.11, .1)):
    k = int(d * SR); L[k:] += g * R[:-k]; R[k:] += g * L[:-k]
for t in taps: add(tick(), t, 0, 1)

mix = np.stack([L, R], 1)[: int(SR * dur)]
n = len(mix); tt = np.arange(n) / SR
mix *= np.minimum(1, tt / 0.8)[:, None] * np.minimum(1, (dur - tt) / 1.6).clip(0)[:, None]   # Ein-/Ausblenden
mix = np.tanh(mix * 1.3); mix /= np.abs(mix).max() / 0.89
with wave.open(out, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((mix * 32767).astype("<i2").tobytes())
print("ok", out)
