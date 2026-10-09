"""Synthesize the score + sound design for 光年之外, aligned to timeline.json."""
import json
import wave
from pathlib import Path

import numpy as np

HERE = Path(__file__).parent
TL = json.loads((HERE / "timeline.json").read_text())
SR = 48000
DUR = TL["duration"]
N = int(SR * DUR)
T = np.arange(N) / SR
rng = np.random.default_rng(1845)

dry = np.zeros((2, N))
send = np.zeros((2, N))


def put(sig, start, gain=1.0, pan=0.0, wet=0.3):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    for ch, k in ((0, l), (1, r)):
        dry[ch, i:i + len(sig)] += sig * gain * k * np.sqrt(2)
        send[ch, i:i + len(sig)] += sig * gain * k * np.sqrt(2) * wet


def spectral(x, lo=None, hi=None, tilt=0.0):
    """Gentle FFT-domain band shaping."""
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1 / SR) + 1e-9
    g = np.ones_like(f)
    if lo:
        g *= 1 / np.sqrt(1 + (lo / f) ** 4)
    if hi:
        g *= 1 / np.sqrt(1 + (f / hi) ** 4)
    if tilt:
        g *= (f / 1000) ** tilt
    return np.fft.irfft(X * g, len(x))


def env(points):
    ts, vs = zip(*points)
    return np.interp(T, ts, vs)


def seg(d):
    return np.arange(int(d * SR)) / SR


# ---------------- music ----------------
def tone(f, e, detune=0.0, harm=(1.0, 0.25, 0.08), vib=0.0):
    ph = 2 * np.pi * f * (1 + detune) * T
    if vib:
        ph += vib * np.sin(2 * np.pi * 4.8 * T)
    s = sum(a * np.sin((k + 1) * ph) for k, a in enumerate(harm))
    return s * e


# drone under the screening (0-33s), drops away for her pause
drone_env = env([(0, 0), (2.5, 1), (30, 1.15), (33.0, 1.1), (33.9, 0.12), (38, 0.12), (39.5, 0.0), (60, 0)])
for f, a, p in [(73.42, 0.050, -0.3), (110.0, 0.034, 0.3), (146.83, 0.016, 0.0)]:
    for dt in (-0.0015, 0.0015):
        s = tone(f, drone_env * a, detune=dt)
        put(s, 0, pan=p + dt * 100, wet=0.25)

# pad for the last candidate: sus2 -> D major add9 -> swell -> thins to one tone
pad_a = env([(0, 0), (38.2, 0), (41.8, 0.55), (42.2, 0.6), (45.0, 1.0), (46.2, 0.7), (48.8, 0.12), (50.5, 0.0), (60, 0)])
third = env([(0, 0), (42.0, 0), (43.2, 1), (60, 1)])
for f, a, p, extra in [(146.83, 0.030, -0.4, None), (220.0, 0.026, 0.4, None), (329.63, 0.016, -0.2, None),
                       (185.0, 0.022, 0.2, third), (440.0, 0.012, 0.5, third), (73.42, 0.040, 0.0, third)]:
    e = pad_a * a * (extra if extra is not None else 1)
    for dt in (-0.002, 0.002):
        put(tone(f, e, detune=dt), 0, pan=p, wet=0.6)
sub = env([(0, 0), (43.0, 0), (45.0, 0.09), (47.5, 0.0), (60, 0)])
put(np.sin(2 * np.pi * 36.71 * T) * sub, 0, wet=0.1)

# the long note: begins at the reveal, outlives everything, fades with the picture
long_e = env([(0, 0), (45.3, 0), (47.5, 0.050), (52, 0.045), (57.4, 0.040), (59.85, 0.0), (60, 0)])
put(tone(440.0, long_e, harm=(1.0, 0.12, 0.03), vib=0.0009 * 2 * np.pi * 440 / (2 * np.pi * 4.8)), 0, wet=0.7)
put(tone(659.26, long_e * 0.18, harm=(1.0,)), 0, pan=0.3, wet=0.8)

# ---------------- room ----------------
noise = rng.standard_normal(N)
room = spectral(noise, lo=40, hi=900) * 0.010
room *= env([(0, 0), (0.6, 1), (33.0, 1), (33.8, 0.45), (38, 0.45), (40, 1), (57, 0.8), (59.9, 0), (60, 0)])
put(room, 0, wet=0.0)
hum_e = env([(0, 0), (8, 0), (8.4, 1), (12.9, 1), (13.1, 0.35), (33, 0.35), (34, 0.1), (60, 0.1)])
put(sum(a * np.sin(2 * np.pi * f * T) for f, a in ((50, 1), (100, 0.5), (150, 0.2))) * hum_e * 0.006, 0, wet=0.0)


# ---------------- sound effects ----------------
def blip(f0=2400, f1=1800, d=0.03, amp=1.0):
    t = seg(d)
    ph = 2 * np.pi * np.cumsum(np.linspace(f0, f1, len(t))) / SR
    return np.sin(ph) * np.exp(-t / (d * 0.4)) * amp


def stamp(heavy=False, distant=False):
    d = 0.6 if heavy else 0.35
    t = seg(d)
    f = (55 if heavy else 72) * (1 + 0.6 * np.exp(-t / 0.02))
    body = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / (0.16 if heavy else 0.09))
    chunk = np.sin(2 * np.pi * 230 * t) * np.exp(-t / 0.025) * 0.5
    click = spectral(rng.standard_normal(len(t)), lo=2500) * np.exp(-t / 0.004) * 0.35
    s = body + chunk + click
    if heavy:
        s += np.sin(2 * np.pi * 38 * t) * np.exp(-t / 0.3) * 0.8
    if distant:
        s = spectral(s, hi=700) * 0.45
    return s


def key_click():
    t = seg(0.03)
    return spectral(rng.standard_normal(len(t)), lo=1500, hi=6000) * np.exp(-t / 0.005)


def bell(f, d=2.8):
    t = seg(d)
    parts = [(1.0, 1.0, 1.0), (2.0, 0.35, 0.6), (2.76, 0.22, 0.4), (5.4, 0.08, 0.2)]
    s = sum(a * np.sin(2 * np.pi * f * m * t) * np.exp(-t / (d * k * 0.35)) for m, a, k in parts)
    return s * (1 - np.exp(-t / 0.002))


def soft_tick(f=1200, d=0.012):
    t = seg(d)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / (d * 0.3))


def error_tone():
    t = seg(0.32)
    return (np.sin(2 * np.pi * 196 * t) + np.sin(2 * np.pi * 207.6 * t)) * 0.5 * np.exp(-t / 0.12) * (1 - np.exp(-t / 0.004))


# data chatter under the opening grid
for tt in np.sort(rng.uniform(0.3, 8.0, 46)):
    put(blip(rng.uniform(1900, 2900), rng.uniform(1500, 2300), 0.025, 0.035), tt, pan=rng.uniform(-0.6, 0.6), wet=0.15)

for s in TL["stamps"]:
    heavy, distant = s.get("heavy", False), s.get("distant", False)
    if not distant:
        put(blip(2600, 2100, 0.03, 0.05), s["t"] - 0.06, wet=0.1)
    g = 0.30 if s["shot"] in (1, 2) else 0.42
    if heavy:
        g = 0.62
    put(stamp(heavy, distant), s["t"], gain=g, pan=rng.uniform(-0.15, 0.15), wet=0.35 if not distant else 0.6)

for k in TL["keys"]:
    put(key_click(), k, gain=rng.uniform(0.05, 0.09), pan=0.35, wet=0.1)

for tt in TL["rows5"] + TL["rows7"]:
    put(soft_tick(1500), tt, gain=0.06, pan=0.3, wet=0.2)
for tt in TL["rows5"][:3] + TL["rows7"][:3]:
    put(soft_tick(1760, 0.02), tt + 0.35, gain=0.05, pan=0.3, wet=0.2)
for tt in (TL["flag5"], TL["flag7"]):
    put(error_tone(), tt, gain=0.12, pan=0.25, wet=0.3)
for i in range(5):
    put(soft_tick(1300), 38.4 + i * 0.12, gain=0.04, pan=0.3, wet=0.2)

# counter roll: tick on each visible change, capped in density
cf = TL["counter"]
last, prev_t = None, -1
for tt in np.arange(cf["start"], cf["end"] + 0.01, 1 / 240):
    p = min(1, (tt - cf["start"]) / (cf["end"] - cf["start"]))
    n = round(cf["from"] + (cf["to"] - cf["from"]) * (1 - (1 - p) ** 4))
    if n != last and tt - prev_t > 0.028:
        put(soft_tick(1150, 0.008), tt, gain=0.05, pan=0.4, wet=0.15)
        last, prev_t = n, tt
put(soft_tick(1150, 0.008), cf["end"], gain=0.07, pan=0.4)

ld = TL["loading"]
for tt in np.arange(ld["start"], ld["end"], 0.3):
    t = seg(0.09)
    put(np.sin(2 * np.pi * 660 * t) * np.sin(np.pi * t / 0.09), tt, gain=0.03, wet=0.4)

for f, tt in zip((587.33, 659.26, 739.99, 880.0, 987.77), TL["checks"]):
    put(bell(f), tt + 0.22, gain=0.075, pan=-0.3 + 0.15 * TL["checks"].index(tt), wet=0.55)
put(bell(1174.66, 4.0), TL["reveal_title"], gain=0.05, wet=0.8)

hd = TL["headphones_down"]
t = seg(0.25)
put(np.sin(2 * np.pi * 120 * t) * np.exp(-t / 0.03) * 0.6 + spectral(rng.standard_normal(len(t)), lo=1800, hi=7000) * np.exp(-t / 0.006) * 0.2,
    hd, gain=0.3, pan=0.2, wet=0.25)
rustle = spectral(rng.standard_normal(int(1.1 * SR)), lo=500, hi=5000) * np.sin(np.linspace(0, np.pi, int(1.1 * SR))) ** 2
put(rustle, 50.85, gain=0.022, pan=-0.2, wet=0.3)

put(bell(1760.0, 3.5), TL["merge"], gain=0.03, wet=0.9)

# ---------------- reverb + master ----------------
ir_len = int(3.2 * SR)
ti = np.arange(ir_len) / SR
out = dry.copy()
for ch in range(2):
    ir = spectral(rng.standard_normal(ir_len), hi=5000) * np.exp(-ti / 0.75) * np.minimum(1, ti / 0.02)
    ir /= np.sqrt((ir ** 2).sum())
    L = 1 << int(np.ceil(np.log2(N + ir_len)))
    wet = np.fft.irfft(np.fft.rfft(send[ch], L) * np.fft.rfft(ir, L), L)[:N]
    out[ch] += wet * 0.9

out[:, -int(0.05 * SR):] *= np.linspace(1, 0, int(0.05 * SR))
out = np.tanh(out * 1.4) / 1.4
peak = np.abs(out).max()
out *= 10 ** (-1.0 / 20) / peak
pcm = (out.T * 32767).astype(np.int16)
path = HERE / "out" / "audio.wav"
path.parent.mkdir(exist_ok=True)
with wave.open(str(path), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", path, "peak before norm", round(float(peak), 3))
