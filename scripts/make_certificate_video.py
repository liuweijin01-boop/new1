#!/usr/bin/env python3
"""生成 2:1 荣誉证书展示视频（5 秒）。

暗红暖光背景 + 漂浮金色光点；证书带投影居中，开场放大淡入后缓慢推近，
中段一道斜向高光扫过证书表面，结尾淡出。

用法: python3 scripts/make_certificate_video.py [certificate.jpg] [output.mp4]
"""
import math
import subprocess
import sys

import numpy as np
from PIL import Image, ImageFilter, ImageOps

W, H = 1920, 960          # 2:1
FPS = 30
DUR = 5.0
CROP = (88, 100, 1968, 1440)   # 去掉照片四周桌面，只保留证书
CARD_H = 800
SHADOW = 36
K = 1.15                  # 卡片预渲染倍率，缩放时保持清晰


def ease_out(x):
    x = min(max(x, 0.0), 1.0)
    return 1 - (1 - x) ** 3


def smooth(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def affine_place(src, scale, cx, cy, size):
    inv = 1.0 / scale
    return src.transform(size, Image.AFFINE,
                         (inv, 0, src.width / 2 - cx * inv, 0, inv, src.height / 2 - cy * inv),
                         resample=Image.BICUBIC)


def make_background(cert):
    bw, bh = int(W * 1.1), int(H * 1.1)
    s = max(bw / cert.width, bh / cert.height)
    small = cert.resize((int(cert.width * s / 6), int(cert.height * s / 6)), Image.BILINEAR)
    x, y = (small.width - bw // 6) // 2, (small.height - bh // 6) // 2
    small = small.crop((x, y, x + bw // 6, y + bh // 6)).filter(ImageFilter.GaussianBlur(6))
    arr = np.asarray(small.resize((bw, bh), Image.BICUBIC)).astype(np.float32)
    # 压暗并偏向深红，再叠一层中心暖光
    tint = np.array([0.42, 0.16, 0.14], dtype=np.float32)
    arr = arr * tint
    yy, xx = np.mgrid[0:bh, 0:bw].astype(np.float32)
    d = np.sqrt(((xx - bw / 2) / (bw * 0.5)) ** 2 + ((yy - bh / 2) / (bh * 0.6)) ** 2)
    glow = np.clip(1 - d, 0, 1) ** 2
    arr += glow[..., None] * np.array([120, 70, 30], dtype=np.float32)
    arr *= (1 - 0.45 * np.clip(d - 0.5, 0, 1))[..., None]
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))


def make_card(cert):
    ph = int(CARD_H * K)
    pw = int(cert.width * ph / cert.height)
    photo = cert.resize((pw, ph), Image.LANCZOS)
    sh = int(SHADOW * K)
    cw, ch = pw + 2 * sh, ph + 2 * sh
    shadow = Image.new("L", (cw, ch), 0)
    shadow.paste(190, (sh, sh + sh // 2, sh + pw, sh + sh // 2 + ph))
    shadow = shadow.filter(ImageFilter.GaussianBlur(sh / 2))
    card = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    card.putalpha(shadow)
    card.paste(photo, (sh, sh))
    return card, (sh, sh, sh + pw, sh + ph)


def sheen_mask(card_size, rect, pos):
    """斜向高光带的 alpha 遮罩，pos 0→1 从左上扫到右下。"""
    cw, ch = card_size
    x0, y0, x1, y1 = rect
    yy, xx = np.mgrid[0:ch, 0:cw].astype(np.float32)
    u = (xx - x0) + (yy - y0) * 0.45            # 斜向坐标
    span = (x1 - x0) + (y1 - y0) * 0.45
    c = -0.15 * span + pos * 1.3 * span
    band = np.exp(-((u - c) / (0.06 * span)) ** 2)
    inside = (xx >= x0) & (xx < x1) & (yy >= y0) & (yy < y1)
    return (band * inside * 0.55 * 255).astype(np.uint8)


class Particles:
    def __init__(self, n=46, seed=7):
        r = np.random.default_rng(seed)
        self.x = r.uniform(0, W, n)
        self.y = r.uniform(0, H, n)
        self.vy = r.uniform(-28, -10, n)
        self.vx = r.uniform(-8, 8, n)
        self.size = r.uniform(2, 7, n)
        self.phase = r.uniform(0, 2 * math.pi, n)
        self.alpha = r.uniform(0.25, 0.8, n)

    def draw(self, t):
        layer = np.zeros((H, W), dtype=np.float32)
        for i in range(len(self.x)):
            x = (self.x[i] + self.vx[i] * t) % W
            y = (self.y[i] + self.vy[i] * t) % H
            s = self.size[i]
            a = self.alpha[i] * (0.6 + 0.4 * math.sin(t * 2.2 + self.phase[i]))
            r = int(s * 3)
            xa, xb = max(int(x) - r, 0), min(int(x) + r + 1, W)
            ya, yb = max(int(y) - r, 0), min(int(y) + r + 1, H)
            if xa >= xb or ya >= yb:
                continue
            gy, gx = np.mgrid[ya:yb, xa:xb]
            layer[ya:yb, xa:xb] += a * np.exp(-((gx - x) ** 2 + (gy - y) ** 2) / (2 * (s * 0.8) ** 2))
        return np.clip(layer, 0, 1)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "photos/certificate.jpg"
    out = sys.argv[2] if len(sys.argv) > 2 else "output/certificate_showcase_2x1.mp4"
    cert = ImageOps.exif_transpose(Image.open(src)).convert("RGB").crop(CROP)
    bg = make_background(cert)
    card, rect = make_card(cert)
    parts = Particles()
    gold = np.array([255, 214, 140], dtype=np.float32)
    white = Image.new("RGBA", card.size, (255, 248, 225, 255))

    frames = int(DUR * FPS)
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
         "-vf", "fade=in:st=0:d=0.4,fade=out:st=%.2f:d=0.5" % (DUR - 0.5),
         "-c:v", "libx264", "-preset", "slow", "-crf", "18", "-pix_fmt", "yuv420p",
         "-movflags", "+faststart", out],
        stdin=subprocess.PIPE)

    for fi in range(frames):
        t = fi / FPS
        p = t / DUR
        # 背景缓慢缩放
        frame = affine_place(bg, 1.0 + 0.05 * p, W / 2, H / 2, (W, H)).convert("RGBA")

        # 证书：0~0.9s 由 0.88 放大并淡入，之后缓慢推近
        intro = ease_out(t / 0.9)
        scale = (0.88 + 0.12 * intro + 0.05 * smooth((t - 0.9) / (DUR - 0.9))) / K
        c = card.copy()
        sp = (t - 1.4) / 1.4                     # 1.4s~2.8s 高光扫过
        if 0 < sp < 1:
            c.alpha_composite(Image.composite(white, Image.new("RGBA", c.size, (0, 0, 0, 0)),
                                              Image.fromarray(sheen_mask(c.size, rect, smooth(sp)))))
        if intro < 1:
            a = np.asarray(c.getchannel("A")).astype(np.float32) * intro
            c.putalpha(Image.fromarray(a.astype(np.uint8)))
        frame.alpha_composite(affine_place(c, scale, W / 2, H / 2 + 8 * (1 - intro), (W, H)))

        # 金色光点（加色混合）
        arr = np.asarray(frame.convert("RGB")).astype(np.float32)
        arr += parts.draw(t)[..., None] * gold * 0.7
        ff.stdin.write(arr.clip(0, 255).astype(np.uint8).tobytes())

    ff.stdin.close()
    ff.wait()
    print(f"wrote {out}: {DUR:.1f}s, {W}x{H}, {frames} frames")


if __name__ == "__main__":
    main()
