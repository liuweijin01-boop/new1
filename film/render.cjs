// Usage:
//   node render.cjs stills <outDir> t1,t2,...      -> PNG stills for review
//   node render.cjs video <out.mp4> <startFrame> <endFrame>  -> video segment (no audio)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

(async () => {
  const [mode, out, a, b] = process.argv.slice(2);
  const tl = JSON.parse(fs.readFileSync(path.join(__dirname, 'timeline.json'), 'utf8'));
  const browser = await chromium.launch({ args: ['--disable-gpu-vsync', '--force-color-profile=srgb'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', m => console.log('[page]', m.text()));
  page.on('pageerror', e => { console.error('[pageerror]', e.message); process.exitCode = 1; });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.evaluate(t => window.init(t), tl);
  const grab = t => page.evaluate(t => { window.renderFrame(t); return document.getElementById('c').toDataURL('image/png'); }, t);

  if (mode === 'stills') {
    fs.mkdirSync(out, { recursive: true });
    for (const s of a.split(',')) {
      const t = parseFloat(s);
      const png = Buffer.from((await grab(t)).split(',')[1], 'base64');
      fs.writeFileSync(path.join(out, `t${t.toFixed(2).padStart(5, '0')}.png`), png);
    }
  } else {
    const fps = tl.fps, f0 = parseInt(a, 10), f1 = parseInt(b, 10);
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-tune', 'grain', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = f0; f < f1; f++) {
      const png = Buffer.from((await grab(f / fps)).split(',')[1], 'base64');
      if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
      if ((f - f0) % 48 === 0) console.log(`${out}: frame ${f}/${f1} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
