#!/usr/bin/env node
// 把 cards.md 渲染成小红书 3:4 图片（1080×1440 PNG）。
// 用法：node scripts/render-cards.mjs content/2026-10-04-xxx/cards.md [--theme cream] [--out 目录]
//
// cards.md 格式：
//   ---
//   theme: cream            # cream | ink | mint，可选
//   author: @你的小红书号     # 显示在每页底部，可选
//   ---
//   # 封面大标题            <- 第一页自动按封面样式排版
//   一句副标题
//   ===                     <- 单独一行 === 表示分页
//   ## 第二页标题
//   - 要点……
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { marked } from 'marked';
import { chromium } from 'playwright';
import { parseFrontmatter } from './lib/frontmatter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) args[argv[i].slice(2)] = argv[++i];
    else args._.push(argv[i]);
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const input = args._[0];
if (!input) {
  console.error('用法：node scripts/render-cards.mjs <cards.md> [--theme cream|ink|mint] [--out 目录]');
  process.exit(1);
}

const { data, body } = parseFrontmatter(fs.readFileSync(input, 'utf8'));
const theme = args.theme || data.theme || 'cream';
const themeFile = path.join(root, 'themes', `${theme}.css`);
if (!fs.existsSync(themeFile)) {
  console.error(`找不到主题 ${theme}，可选：${fs.readdirSync(path.join(root, 'themes')).map(f => f.replace('.css', '')).join(' / ')}`);
  process.exit(1);
}
const outDir = args.out || path.join(path.dirname(input), 'cards');
fs.mkdirSync(outDir, { recursive: true });

const pages = body.split(/^\s*===\s*$/m).map(s => s.trim()).filter(Boolean);
const baseCss = fs.readFileSync(path.join(root, 'themes', '_base.css'), 'utf8');
const themeCss = fs.readFileSync(themeFile, 'utf8');
const author = data.author || '';

function pageHtml(md, i) {
  const kind = i === 0 ? 'cover' : 'inner';
  const footer = `<footer><span>${author}</span><span>${i + 1} / ${pages.length}</span></footer>`;
  // 正文里的本地图片相对 cards.md 解析
  const html = marked.parse(md).replace(/src="(?!https?:|data:|\/)([^"]+)"/g,
    (_, p) => `src="file://${path.resolve(path.dirname(input), p)}"`);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${baseCss}\n${themeCss}</style></head>
<body><main class="card ${kind}"><div class="content">${html}</div>${footer}</main></body></html>`;
}

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const page = await browser.newPage({ viewport: { width: 1080, height: 1440 }, deviceScaleFactor: 1 });
const warnings = [];
for (let i = 0; i < pages.length; i++) {
  await page.setContent(pageHtml(pages[i], i), { waitUntil: 'load' });
  const overflow = await page.$eval('.content', el => el.scrollHeight - el.clientHeight);
  if (overflow > 2) warnings.push(`第 ${i + 1} 页内容超出 ${overflow}px，请删减文字或拆页`);
  const file = path.join(outDir, `${String(i + 1).padStart(2, '0')}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
await browser.close();

if (pages.length > 18) warnings.push(`共 ${pages.length} 页，小红书单篇最多 18 张图`);
for (const w of warnings) console.warn(`⚠️  ${w}`);
process.exit(warnings.length ? 2 : 0);
