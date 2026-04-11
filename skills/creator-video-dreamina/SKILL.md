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

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 集数（如 ep01）
- `$ARGUMENTS[1]` — 镜头信息（JSON 格式，由 generate-video 传入，包含每个镜头的编号、替换后的 prompt、图片路径列表、时长）

## 职责描述

接收 generate-video 传入的镜头信息，调用脚本提交视频生成任务，将结果记录到 tasks.json。

## 流程

### 阶段 1: 准备

1. 读取 `config.md` 中 `## 视频生成配置`，获取：
   - `即梦视频模型版本`（如 `seedance2.0fast`）
   - `视频比例`（如 `16:9`）
   - `视频分辨率`（如 `720p`）
2. 使用 Bash 执行 `dreamina user_credit` 检查登录状态
   - 失败 → 输出"即梦CLI未登录，请先执行 `dreamina login` 完成登录"并结束
3. 使用 Bash 确保输出目录存在：`mkdir -p story/episodes/{集数}/videos`

### 阶段 2: 逐镜头提交

解析 `$ARGUMENTS[1]` 中的 JSON 镜头列表，对每个镜头：
1. 取出镜头编号、替换后的 prompt、图片路径列表（逗号分隔）、时长
2. 使用 Bash 调用：`bash scripts/video-gen-dreamina.sh "{prompt}" "story/episodes/{集数}/videos/shot{NN}.mp4" "{图片路径列表}" "{时长}" "{比例}" "{模型版本}"`
3. 根据退出码处理：
   - exit 0，stdout 以 `SUBMITTED` 开头 → 提取 `submit_id`，记录 `{"shot": N, "submit_id": "xxx", "status": "submitted"}`
   - exit 1，stdout 以 `FAIL` 开头 → 记录 `{"shot": N, "submit_id": "", "status": "failed", "fail_reason": "..."}`

### 阶段 3: 写入 tasks.json

1. 若 `story/episodes/{集数}/videos/tasks.json` 已存在 → 读取现有内容，合并（按 shot 编号更新或追加）
2. 使用 Write 写入更新后的 tasks.json
3. 输出提交摘要：成功提交 N 个、提交失败 N 个

## 输出

### 返回内容
- 提交结果摘要 → 返回给调用方
