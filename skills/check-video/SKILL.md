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

### 阶段 2: 批量查询 + 更新

1. 使用 Bash 调用 `bash scripts/task-status.sh query "story/episodes/{集数}/videos/tasks.json" "story/episodes/{集数}/videos/tmp"` 批量查询所有 submitted 任务
2. 解析脚本输出（每行 `{submit_id}:{gen_status}:{详情}`），对每个结果：
   - `success` → 使用 Bash 将下载的文件 mv 到目标路径：`mv "story/episodes/{集数}/videos/tmp/{submit_id}_video_1.mp4" "story/episodes/{集数}/videos/shot{NN}.mp4"`，然后调用 `bash scripts/task-status.sh update "story/episodes/{集数}/videos/tasks.json" {submit_id} done`
   - `fail` → 调用 `bash scripts/task-status.sh update "story/episodes/{集数}/videos/tasks.json" {submit_id} failed`，记录 fail_reason
   - `querying` → 不更新，保持 submitted 状态
3. 清理临时目录：`rm -rf story/episodes/{集数}/videos/tmp`

### 阶段 3: 输出进度摘要

1. 统计各状态数量：done / submitted / failed
2. 输出摘要：完成 N 个 / 排队中 N 个 / 失败 N 个

### 阶段 4: 失败处理（仅当有 failed 任务时）

对每个 status 为 `failed` 的任务，先判断 `fail_reason` 属于哪种类型：

**a. 可自动重试（并行限制/频率限制/服务端临时错误）：**
1. 告知用户该镜头因临时原因失败，正在自动重试
2. 从 tasks.json 中读取该 shot 的 `prompt`、`images`、`duration`
3. 使用 Bash 调用 `bash scripts/read-config.sh "即梦视频模型版本"` 和 `bash scripts/read-config.sh "视频比例"` 获取配置
4. 使用 Bash 调用 `bash scripts/video-gen-dreamina.sh "{prompt}" "{输出路径}" "{images}" "{duration}" "{比例}" "{模型版本}"` 重新提交
5. 使用 Bash 调用 `bash scripts/task-status.sh upsert` 更新为新 submit_id + status `submitted`
6. 若提交失败且仍为并行限制 → 停止重试剩余任务，提示用户稍后再试

**b. 需人工介入（内容安全/合规拒绝/参数错误/其他）：**
1. 显示镜头编号和 `fail_reason` 原文
2. 询问用户："镜头 {N} 生成失败，原因：{fail_reason}。您有修改建议吗？（输入建议，或回复「自动修复」交给我判断）"
3. **用户有建议** → 根据建议内容判断目标类型并调用相应 skill：
   - 涉及分镜/画面描述修改 → 检查是否存在 `story/episodes/{集数}/script.md`（短视频）或 `story/episodes/{集数}/novel.md`（系列视频），使用对应的 fix-storyboard skill（`short-fix-storyboard` 或 `storyboarder-fix-storyboard`）
   - 涉及资产/图片修改 → 使用 Bash 调用 `bash scripts/read-config.sh "图像模型"` 获取图像模型值，调用 `creator-fix-asset` skill + `creator-image-{图像模型值}` skill
4. **用户选择自动修复** → 自行分析 `fail_reason`，判断最可能的原因并调用相应 skill
5. 修改完后，需要重新生成该镜头的 prompt（因为分镜内容已改变）：使用 Bash 调用 `bash scripts/storyboard-to-prompt.sh "story/episodes/{集数}/storyboard.md" {镜头编号}` 获取新 prompt
6. 使用 Bash 调用 `bash scripts/read-config.sh "即梦视频模型版本"` 和 `bash scripts/read-config.sh "视频比例"` 获取配置
7. 使用 Bash 调用 `bash scripts/video-gen-dreamina.sh` 重新提交
8. 使用 Bash 调用 `bash scripts/task-status.sh upsert` 更新记录（含新 prompt）
9. 提示用户稍后再次使用 `/check-video {集数}` 查询

## 输出

### 返回内容
- 进度摘要 + 失败处理结果
