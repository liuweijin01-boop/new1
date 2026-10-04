# AI 图文创作工作室

这个仓库是一条「一次创作，公众号 + 小红书双发」的图文流水线，在 Claude Code 里运行。

## 每次创作前
1. 先读 `profile.md`（账号画像）。如果关键字段还是空的，先引导用户补全，或调用 `content-strategy` 技能做定位。
2. 每篇内容都放在 `content/<日期>-<slug>/`，用 `node scripts/new-post.mjs <slug> "<选题>"` 创建。

## 流水线（技能按顺序）
| 阶段 | 技能 | 产物 |
|---|---|---|
| 0 定位 | `content-strategy` | 更新 `profile.md` |
| 1 选题 | `topic-research` | `brief.md` |
| 2 长文 | `wechat-article` | `article.md` |
| 3 小红书 | `xhs-note` | `note.md`、`cards.md`、`cards/*.png` |
| 4 发布 | `publish` | 公众号草稿、小红书笔记 |
| 一条龙 | `content-pipeline` | 以上全部，每个阶段之间停下来让用户确认 |

## 硬性规则
- **发布前必须得到用户明确确认**。公众号只推送到草稿箱；小红书默认 `visibility: 仅自己可见`，用户在 App 里看过再改公开。
- 发布前必须跑 `node scripts/check.mjs <note.md> <article.md>`，有 ❌ 不发。
- 不编造数据、案例、引用；没有来源的数字要标注「示例」或删掉。用户亲身经历优先于泛泛而谈。
- 小红书：标题 ≤ 20 字，正文 ≤ 1000 字，不放外链和联系方式，图片 ≤ 18 张。
- 公众号：标题 ≤ 64 字，摘要 ≤ 120 字，必须有封面 `cover`。
- 去 AI 味：不用「在当今时代」「总而言之」「让我们一起」「赋能」「深度剖析」这类套话；多用短句、具体细节、第一人称经历。

## 常用命令
```bash
node scripts/new-post.mjs <slug> "<选题>"      # 新建内容目录
node scripts/render-cards.mjs <dir>/cards.md      # 渲染小红书卡片 → <dir>/cards/
node scripts/check.mjs <dir>/note.md <dir>/article.md   # 发布前检查
```
渲染卡片如提示超出（退出码 2），删减该页文字或拆页后重新渲染。

## MCP（见 `.mcp.json`）
- `wenyan-mcp`：`publish_article`（file=article.md 路径，theme_id）把 Markdown 排版后推到公众号草稿箱。
- `xiaohongshu-mcp`：`search_feeds` / `get_feed_detail` 用于选题调研；`publish_content` 发布笔记（images 用绝对路径）。需本地先启动服务并扫码登录。
