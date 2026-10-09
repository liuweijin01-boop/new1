#!/usr/bin/env bash
# Render 光年之外: 4 parallel segments -> concat -> mux audio.
set -euo pipefail
cd "$(dirname "$0")"
export NODE_PATH=${NODE_PATH:-/opt/node22/lib/node_modules}
python3 timeline.py
python3 audio.py
mkdir -p out/seg
FR=1440; N=4; STEP=$((FR / N))
pids=()
for i in $(seq 0 $((N - 1))); do
  node render.cjs video out/seg/seg$i.mp4 $((i * STEP)) $(((i + 1) * STEP)) > out/seg/log$i.txt 2>&1 &
  pids+=($!)
done
for p in "${pids[@]}"; do wait "$p"; done
: > out/seg/list.txt
for i in $(seq 0 $((N - 1))); do echo "file 'seg$i.mp4'" >> out/seg/list.txt; done
ffmpeg -y -loglevel error -f concat -safe 0 -i out/seg/list.txt -c copy out/video.mp4
ffmpeg -y -loglevel error -i out/video.mp4 -i out/audio.wav -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "out/光年之外.mp4"
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "out/光年之外.mp4"
