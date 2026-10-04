---
name: publish
description: 把已完成的内容发布到公众号草稿箱和小红书。当用户说"发布""发出去""推到草稿箱""发小红书"时使用。
---

# 发布

## 前置检查（全部通过才继续）
1. `node scripts/check.mjs <dir>/note.md <dir>/article.md` 无 ❌。
2. `<dir>/cards/` 下有图片；article.md 的 `cover` 文件存在。
3. 向用户展示将要发布的：标题、平台、图片数、可见范围/时间，**等用户明确回复"确认"再发**。

## 公众号（wenyan-mcp）
- 调用 `publish_article`：`file` = article.md 的绝对路径，`theme_id` 取 profile.md 偏好（默认 `default`）。
- 只会进**草稿箱**。告诉用户去公众号后台「草稿箱」预览后手动群发。
- 常见报错：`invalid ip` → 本机公网 IP 未加入公众号后台白名单；`40001` → AppSecret 错误。

## 小红书（xiaohongshu-mcp）
- 先 `check_login_status`；未登录则 `get_login_qrcode` 让用户扫码。
- 调用 `publish_content`：
  - `title`、`content`（note.md 正文，不含 # 标签）、`tags`（note.md 的 tags）
  - `images`：`<dir>/cards/*.png` 的**绝对路径**，按文件名排序
  - `visibility`：默认 `仅自己可见`，用户确认手机端效果后再在 App 里改为公开；用户明确要求时才直接公开
  - 可选 `schedule_at` 定时（1 小时 – 14 天内），推荐工作日 12:00 或 20:00–22:00
  - `is_original: true`（原创内容）
- 风控提醒：同一账号不要同时在其他网页端登录；新号先实名；每天发布不要超过 2–3 篇。

## 收尾
在 `profile.md` 的复盘表追加一行（数据先留空），提醒用户 3 天后回来填数据。
