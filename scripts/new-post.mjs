#!/usr/bin/env node
// 新建一篇内容的工作目录：content/<日期>-<slug>/，放好 brief / article / note / cards 模板。
// 用法：node scripts/new-post.mjs ai-workflow "普通人用AI做图文"
import fs from 'node:fs';
import path from 'node:path';

const [slug, topic = ''] = process.argv.slice(2);
if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
  console.error('用法：node scripts/new-post.mjs <英文-slug> ["选题"]');
  process.exit(1);
}
const now = new Date();
const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
const dir = path.join('content', `${date}-${slug}`);
if (fs.existsSync(dir)) {
  console.error(`${dir} 已存在`);
  process.exit(1);
}
fs.mkdirSync(path.join(dir, 'images'), { recursive: true });

const files = {
  'brief.md': `# 选题简报\n\n- 选题：${topic}\n- 目标读者：\n- 读者痛点 / 想要的结果：\n- 核心观点（一句话）：\n- 素材与依据（亲身经历、数据、链接）：\n- 对标笔记 / 文章：\n`,
  'article.md': `---\nplatform: wechat\ntitle: ${topic}\nauthor:\ncover: ./cards/01.png\ndigest:\n---\n`,
  'note.md': `---\nplatform: xhs\ntitle:\ntags: []\n---\n`,
  'cards.md': `---\ntheme: cream\nauthor:\n---\n# 封面标题\n\n副标题\n\n===\n\n## 第 2 页\n`,
};
for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
console.log(dir);
