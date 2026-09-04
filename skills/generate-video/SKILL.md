---
name: generate-video
description: 将已审核分镜转换为 sheet-first 视频任务并提交。使用 /generate-video ep01 [镜头N...]。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "集数 [镜头N ...]"
model: opus
---

## 约束

- 只能通过现有 scripts 和 `creator-video-dreamina` 提交；禁止测试性调用 provider。
- tasks.json 用 Read/Write 完整维护，每个 shot 唯一。
- 预登记后 creator 只更新 submit_id/status/fail_reason，不改 prompt/images/duration。

## 流程

1. 解析 `$ARGUMENTS[0]` 为 canonical ep，读取 config 和 `story/episodes/{ep}/storyboard.md`。
2. 先执行 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/detect-legacy-kf.sh "{ep}" "{storyboard}" "{tasks}"`。非零立即原码停止；旧持久任务不得重提。
3. 只将严格 heading `### shot N` 视为 shot。验证编号有序、唯一、连续；重复 shot、缺号或非 canonical heading 立即失败。按用户镜头参数筛选，不允许近似匹配（shot 1 不匹配 shot 10）。
4. 对每个目标 shot 调用 `storyboard-to-prompt.sh`。任何 converter 失败立即停止，不写半成品。解析：
   - `IMAGES:` 后的逗号分隔字符串原样存入 `images`。
   - `DURATION:` 存入 `duration`。
   - `---` 后全部文本原样存入 `prompt`。
5. 逐项验证 images 中每一张图片存在；sheet PNG 必须为 CSV 第一项。空字段或缺图失败。
6. 预登记到 `story/episodes/{ep}/videos/tasks.json`：
   - 不存在：新增 `{shot,submit_id:"",status:"pending",prompt,images,duration,fail_reason:""}`。
   - `pending`：刷新 converter 三字段。
   - `failed`：刷新 converter 三字段但保持 failed，交 check-video 重试。
   - `submitted` / `done`：完全保护，不刷新、不自动重提；若 converter 已变化只输出人工处理警告。
7. 按 storyboard 原顺序收集目标 pending shot。使用 Skill tool 调用 `creator-video-dreamina` skill，参数 `{ep} {shot numbers}`。
8. 使用 Skill tool 调用 `auto-video` skill，参数 `{ep} 1200`。

视频模型为 `none` 时交互配置或取消。最终报告新增、刷新、保护、提交和失败数量。
