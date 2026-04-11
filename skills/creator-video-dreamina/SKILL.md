---
name: creator-video-dreamina
description: 使用即梦CLI multimodal2video为分镜提交视频生成任务，构造prompt并记录任务到tasks.json。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash
---

## 输入

### 文件读取
- `config.md` — 必须读取（获取 `## 视频生成配置` 中的即梦视频模型版本、视频比例、视频分辨率）
- `story/episodes/$ARGUMENTS[0]/storyboard.md` — 必须读取

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 集数（如 ep01）
- `$ARGUMENTS[1]` — 目标镜头编号列表（如 `1 3 5` 或 `all`）

## 职责描述

读取分镜，构造 prompt（替换资产链接为图片引用），调用脚本提交视频生成任务，将结果记录到 tasks.json。

## 流程

### 阶段 1: 准备

1. 读取 `config.md` 中 `## 视频生成配置`，获取：
   - `即梦视频模型版本`（如 `seedance2.0fast`）
   - `视频比例`（如 `16:9`）
   - `视频分辨率`（如 `720p`）
2. 使用 Bash 执行 `dreamina user_credit` 检查登录状态并显示当前积分余额
   - 失败 → 输出"即梦CLI未登录，请先执行 `dreamina login` 完成登录"并结束
3. 使用 Bash 确保输出目录存在：`mkdir -p story/episodes/{集数}/videos`

### 阶段 2: 解析分镜 + 构造 prompt

1. 读取 `story/episodes/{集数}/storyboard.md`，解析所有镜头（`### 镜头 N` 块）
2. 根据 `$ARGUMENTS[1]` 过滤目标镜头（`all` 则使用全部）
3. 对每个目标镜头：
   a. 提取 `**引用资产：**` 行中的所有资产链接，按顺序编号
   b. 将每个 `[资产名](../../../assets/{category}/{name}.md)` 替换为 `[资产名:{图片N}]`（N 从 1 开始）
   c. 收集对应的图片文件路径列表（逗号分隔）：`assets/images/{category}/{name}.png`
   d. 从 `**时长：**` 行提取秒数（如 `15s` → `15`）

### 阶段 3: 逐镜头提交

对每个目标镜头：
1. 使用 Bash 调用：`bash scripts/video-gen-dreamina.sh "{替换后的prompt}" "story/episodes/{集数}/videos/shot{NN}.mp4" "{图片路径列表}" "{时长}" "{比例}" "{模型版本}"`
3. 根据退出码处理：
   - exit 0，stdout 以 `SUBMITTED` 开头 → 提取 `submit_id`，记录 `{"shot": N, "submit_id": "xxx", "status": "submitted"}`
   - exit 1，stdout 以 `FAIL` 开头 → 记录 `{"shot": N, "submit_id": "", "status": "failed", "fail_reason": "..."}`

### 阶段 4: 写入 tasks.json

1. 若 `story/episodes/{集数}/videos/tasks.json` 已存在 → 读取现有内容，合并（按 shot 编号更新或追加）
2. 使用 Write 写入更新后的 tasks.json

### 阶段 5: 摘要

1. 使用 Bash 执行 `dreamina user_credit`，显示提交后的积分余额
2. 输出提交摘要：成功提交 N 个、提交失败 N 个

## 输出

### 返回内容
- 提交结果摘要 → 返回给调用方
