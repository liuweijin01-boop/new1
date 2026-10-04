#!/usr/bin/env node
// 发布前检查：平台字数限制 + 常见违禁/引流词。
// 用法：node scripts/check.mjs content/xxx/note.md content/xxx/article.md
// 依据 frontmatter 的 platform 字段（xhs | wechat）选择规则。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter } from './lib/frontmatter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const banned = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'banned-words.json'), 'utf8'));
const len = s => [...(s || '')].length;

const rules = {
  xhs(data, body) {
    const errs = [], warns = [];
    if (!data.title) errs.push('缺少 title');
    else if (len(data.title) > 20) errs.push(`标题 ${len(data.title)} 字，小红书上限 20 字`);
    if (len(body) > 1000) errs.push(`正文 ${len(body)} 字，小红书上限 1000 字`);
    const tags = data.tags || [];
    if (tags.length < 3) warns.push(`话题标签只有 ${tags.length} 个，建议 3–8 个`);
    if (tags.length > 10) warns.push(`话题标签 ${tags.length} 个，过多容易被判营销`);
    if (/https?:\/\//.test(body)) errs.push('正文含外链，小红书会限流');
    return { errs, warns };
  },
  wechat(data, body) {
    const errs = [], warns = [];
    if (!data.title) errs.push('缺少 title');
    else if (len(data.title) > 64) errs.push(`标题 ${len(data.title)} 字，公众号上限 64 字`);
    if (data.digest && len(data.digest) > 120) errs.push(`摘要 ${len(data.digest)} 字，上限 120 字`);
    if (!data.cover) warns.push('没有 cover 封面图，发草稿会失败（wenyan 需要封面）');
    if (len(body) < 800) warns.push(`正文仅 ${len(body)} 字，公众号长文通常 1500–4000 字`);
    return { errs, warns };
  },
};

let failed = false;
for (const file of process.argv.slice(2)) {
  const { data, body } = parseFrontmatter(fs.readFileSync(file, 'utf8'));
  const platform = data.platform || (path.basename(file).startsWith('note') ? 'xhs' : 'wechat');
  const { errs, warns } = rules[platform](data, body.trim());
  const text = `${data.title || ''}\n${body}`;
  for (const [level, words] of Object.entries(banned)) {
    const hits = words.filter(w => text.includes(w));
    if (hits.length) (level === 'block' ? errs : warns).push(`${level === 'block' ? '违禁/引流词' : '慎用词'}：${hits.join('、')}`);
  }
  console.log(`\n[${platform}] ${file}`);
  for (const e of errs) console.log(`  ❌ ${e}`);
  for (const w of warns) console.log(`  ⚠️  ${w}`);
  if (!errs.length && !warns.length) console.log('  ✅ 通过');
  if (errs.length) failed = true;
}
process.exit(failed ? 1 : 0);
