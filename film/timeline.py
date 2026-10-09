"""Generate timeline.json shared by the visual renderer and the audio synth."""
import json
from pathlib import Path

stamps = []

# Shot 1 (0-3s): first rejections, unhurried
for t in [0.75, 1.25, 1.65, 2.0, 2.3, 2.55, 2.78]:
    stamps.append({"t": t, "shot": 1, "heavy": False})

# Shot 2 (3-8s): rejections accelerate like a typewriter
t, dt = 3.25, 0.42
while t < 7.85:
    stamps.append({"t": round(t, 3), "shot": 2, "heavy": False})
    t += dt
    dt = max(0.1, dt * 0.88)

# Shot 4: distant stamps heard off-screen while she works
stamps += [{"t": 14.6, "shot": 4, "heavy": False, "distant": True},
           {"t": 16.3, "shot": 4, "heavy": False, "distant": True}]
# Shots 5-7: the three named candidates
stamps += [{"t": 21.2, "shot": 5, "heavy": False},
           {"t": 24.7, "shot": 6, "heavy": False},
           {"t": 31.2, "shot": 7, "heavy": True}]

keys = [13.35, 13.52, 13.66, 13.9, 14.05, 14.21, 14.33, 14.9, 15.04, 15.18, 15.45,
        15.6, 15.71, 15.95, 16.7, 16.84, 16.97, 17.1, 17.34, 17.48]

timeline = {
    "fps": 24,
    "duration": 60.0,
    "stamps": stamps,
    "keys": keys,
    "rows5": [18.4, 18.9, 19.4, 19.9],
    "flag5": 20.6,
    "rows7": [28.4, 28.8, 29.2, 29.6],
    "flag7": 30.4,
    "counter": {"start": 25.4, "end": 27.7, "from": 1842, "to": 2},
    "loading": {"start": 38.15, "end": 40.3},
    "checks": [42.15, 42.65, 43.15, 43.65, 44.15],
    "reveal_title": 44.6,
    "headphones_down": 50.4,
    "merge": 58.7,
    "fade_out": [59.0, 59.9],
}

Path(__file__).with_name("timeline.json").write_text(json.dumps(timeline, ensure_ascii=False, indent=1))
print(len(stamps), "stamps")
