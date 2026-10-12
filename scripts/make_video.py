#!/usr/bin/env python3
"""生成 4:1 人物图片展示视频（15 秒）。

每张照片：模糊放大的同图作背景，原图带白边和投影居中作前景，
前景缓慢推近、背景缓慢反向缩放；相邻照片之间交叉淡化并伴随前景滑入。

用法: python3 scripts/make_video.py [photos_dir] [output.mp4]
"""
import math
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter, ImageOps

W, H = 2560, 640          # 4:1
FPS = 30
CLIP = 3.5                # 每张照片时长（含转场）
XFADE = 0.625             # 转场时长 -> 5*3.5 - 4*0.625 = 15s
FG_H = 548                # 前景照片高度
BORDER = 8
SHADOW = 28

# 背景裁切的竖直焦点（人脸大致位置，0~1）
FOCUS_Y = {"1": 0.40, "2": 0.38, "3": 0.40, "4": 0.30, "5": 0.28}


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def cover_crop(img, w, h, fy):
    s = max(w / img.width, h / img.height)
    r = img.resize((math.ceil(img.width * s), math.ceil(img.height * s)), Image.LANCZOS)
    x = (r.width - w) // 2
    y = int(min(max(fy * r.height - h / 2, 0), r.height - h))
    return r.crop((x, y, x + w, y + h))


def make_background(img, fy):
    # 比画面略大，方便做缓慢缩放
    bw, bh = int(W * 1.12), int(H * 1.12)
    small = cover_crop(img, bw // 4, bh // 4, fy).filter(ImageFilter.GaussianBlur(9))
    bg = small.resize((bw, bh), Image.BICUBIC)
    arr = np.asarray(bg).astype(np.float32) * 0.5          # 压暗
    # 暗角
    yy, xx = np.mgrid[0:bh, 0:bw]
    d = np.sqrt(((xx - bw / 2) / (bw / 2)) ** 2 + ((yy - bh / 2) / (bh / 2)) ** 2)
    arr *= (1 - 0.35 * np.clip(d - 0.4, 0, 1))[..., None]
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


def make_card(img):
    """带白边和柔和投影的前景卡片（RGBA），按 1.1 倍尺寸预渲染以便缩放。"""
    k = 1.1
    ph = int((FG_H - 2 * BORDER) * k)
    pw = int(img.width * ph / img.height)
    b, sh = int(BORDER * k), int(SHADOW * k)
    photo = ImageOps.expand(img.resize((pw, ph), Image.LANCZOS), border=b, fill="white")
    cw, ch = photo.width + 2 * sh, photo.height + 2 * sh
    shadow = Image.new("L", (cw, ch), 0)
    shadow.paste(150, (sh, sh + sh // 3, sh + photo.width, sh + sh // 3 + photo.height))
    shadow = shadow.filter(ImageFilter.GaussianBlur(sh / 2))
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    card.putalpha(shadow)
    card.paste(photo, (sh, sh))
    return card, k


def affine_place(src, scale, cx, cy, size):
    """把 src 以 scale 缩放后中心放到 (cx, cy)，输出 size 大小（亚像素平滑）。"""
    inv = 1.0 / scale
    a, e = inv, inv
    c = src.width / 2 - cx * inv
    f = src.height / 2 - cy * inv
    return src.transform(size, Image.AFFINE, (a, 0, c, 0, e, f), resample=Image.BICUBIC)


class Clip:
    def __init__(self, path, idx):
        img = ImageOps.exif_transpose(Image.open(path)).convert("RGB")
        self.bg = make_background(img, FOCUS_Y.get(path.stem, 0.4))
        self.card, self.k = make_card(img)
        self.drift = 40 if idx % 2 == 0 else -40   # 前景水平漂移方向交替

    def render(self, t, slide_in=0.0):
        p = t / CLIP
        # 背景：缓慢缩小 + 反向平移
        bs = 1.0 + 0.06 * (1 - p)
        frame = affine_place(self.bg, bs, W / 2 - self.drift * 0.5 * (p - 0.5), H / 2, (W, H))
        # 前景：缓慢推近 + 漂移 + 转场滑入
        fs = (1.0 + 0.05 * p) / self.k
        cx = W / 2 + self.drift * (p - 0.5) + slide_in
        card = affine_place(self.card, fs, cx, H / 2, (W, H))
        frame = frame.convert("RGBA")
        frame.alpha_composite(card)
        return frame.convert("RGB")


def main():
    photos_dir = Path(sys.argv[1] if len(sys.argv) > 1 else "photos")
    out = sys.argv[2] if len(sys.argv) > 2 else "output/portrait_showcase_4x1.mp4"
    paths = sorted(p for p in photos_dir.iterdir() if p.suffix.lower() in (".jpg", ".jpeg", ".png"))
    clips = [Clip(p, i) for i, p in enumerate(paths)]
    n = len(clips)
    step = CLIP - XFADE
    total = n * CLIP - (n - 1) * XFADE
    frames = int(round(total * FPS))

    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-vf", "fade=in:st=0:d=0.5,fade=out:st=%.3f:d=0.6" % (total - 0.6),
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", out],
        stdin=subprocess.PIPE)

    for fi in range(frames):
        t = fi / FPS
        i = min(int(t // step), n - 1)
        lt = t - i * step
        frame = clips[i].render(lt)
        if i + 1 < n and lt > step:            # 转场区间
            a = ease((lt - step) / XFADE)
            nxt = clips[i + 1].render(lt - step, slide_in=(1 - a) * 260)
            frame = Image.blend(frame, nxt, a)
        ff.stdin.write(frame.tobytes())
    ff.stdin.close()
    ff.wait()
    print(f"wrote {out}: {total:.2f}s, {W}x{H}, {frames} frames")


if __name__ == "__main__":
    main()
