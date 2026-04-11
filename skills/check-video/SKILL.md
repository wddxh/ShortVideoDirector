---
name: check-video
description: 查询视频生成任务的状态，下载已完成的视频，处理失败的任务。使用 /check-video ep01 查询。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "集数"
---

## 使用示例

```
/check-video ep01
```

## 流程

### 阶段 1: 读取任务状态

1. 从 `$ARGUMENTS[0]` 获取集数（如 `ep01`）
2. 读取 `story/episodes/{集数}/videos/tasks.json`
3. 若文件不存在 → 提示"未找到视频生成任务，请先使用 `/generate-video {集数}` 提交任务"，结束
4. 过滤出 status 为 `submitted` 的任务（跳过已 `done` 的）

### 阶段 2: 逐个查询

对每个 status 为 `submitted` 的任务：
1. 使用 Bash 执行 `dreamina query_result --submit_id={submit_id} --download_dir=story/episodes/{集数}/videos/tmp`
2. 解析返回 JSON 中的 `gen_status`：
   - `success` → 找到下载的视频文件，使用 Bash 执行 `mv "story/episodes/{集数}/videos/tmp/{submit_id}_video_1.mp4" "story/episodes/{集数}/videos/shot{NN}.mp4"`，更新 tasks.json 中该条目 status 为 `done`
   - `querying` → 保持 status 为 `submitted`（仍在排队/生成中）
   - `fail` → 提取 `fail_reason`，更新 tasks.json 中该条目 status 为 `failed`，记录 `fail_reason`
3. 清理临时目录：`rm -rf story/episodes/{集数}/videos/tmp`

### 阶段 3: 更新 tasks.json

1. 使用 Write 写入更新后的 tasks.json

### 阶段 4: 输出进度摘要

1. 统计各状态数量：done / submitted / failed
2. 输出摘要：完成 N 个 / 排队中 N 个 / 失败 N 个

### 阶段 5: 失败处理（仅当有 failed 任务时）

对每个 status 为 `failed` 的任务：
1. 显示镜头编号和 `fail_reason` 原文
2. 询问用户："镜头 {N} 生成失败，原因：{fail_reason}。您有修改建议吗？（输入建议，或回复「自动修复」交给我判断）"
3. **用户有建议** → 根据建议内容判断目标类型并调用相应 skill：
   - 涉及分镜/画面描述修改 → 检查是否存在 `story/episodes/{集数}/script.md`（短视频）或 `story/episodes/{集数}/novel.md`（系列视频），使用对应的 fix-storyboard skill（`short-fix-storyboard` 或 `storyboarder-fix-storyboard`）
   - 涉及资产/图片修改 → 读取 `config.md` 获取图像模型值，调用 `creator-fix-asset` skill + `creator-image-{图像模型值}` skill
4. **用户选择自动修复** → skill 自行分析 `fail_reason`，判断最可能的原因并调用相应 skill
5. 修改完后，读取 `config.md` 获取视频模型值，使用 Skill tool 调用 `creator-video-{视频模型值}` skill 重新提交该镜头
6. 更新 tasks.json 中该条目为新的 submit_id 和 status `submitted`
7. 提示用户稍后再次使用 `/check-video {集数}` 查询

## 输出

### 返回内容
- 进度摘要 + 失败处理结果
