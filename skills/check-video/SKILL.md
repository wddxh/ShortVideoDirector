---
name: check-video
description: 查询视频生成任务的状态，下载已完成的视频，处理失败的任务。使用 /check-video ep01 查询。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "集数 [--auto]"
---

## 使用示例

```
/check-video ep01              # 交互模式，失败任务询问用户
/check-video ep01 --auto       # 自动模式，只处理可自动重试的失败，跳过需人工介入的
/check-video all --auto        # 自动模式，检查所有集
```

## 模式

- **交互模式**（默认）：失败任务分为可自动重试和需人工介入两类，人工介入的会询问用户
- **自动模式**（`--auto`）：只处理可自动重试的失败任务，需人工介入的仅输出提示，不询问用户。由 `auto-video` 定时调用

## 约束

- **严禁自行编写脚本（包括 Python、Node.js、内联 bash 脚本等）。只能调用插件内 `scripts/` 目录下的现有脚本。**
- **tasks.json 的读取和写入由你（LLM）直接完成：用 Read 工具读取，用 Write 工具写入。不要用脚本操作 tasks.json。**
- **调用插件脚本时，如果相对路径 `scripts/xxx.sh` 找不到，使用 Glob 工具搜索 `**/scripts/xxx.sh` 找到插件目录下的脚本绝对路径。**

## tasks.json 格式

```json
[
  {"shot": 1, "submit_id": "abc123", "status": "submitted", "prompt": "...", "images": "a.png,b.png", "duration": 15, "fail_reason": ""}
]
```

status 取值：`submitted`（已提交等待结果）、`done`（视频已下载）、`failed`（生成失败）

## 流程

### 阶段 1: 读取任务状态

1. 从 `$ARGUMENTS` 中解析集数（如 `ep01` 或 `all`）和模式（是否有 `--auto`）
2. 若为 `all` → 使用 Glob 扫描 `story/episodes/*/videos/tasks.json`；否则读取指定集的 tasks.json
3. 若文件不存在 → 提示"未找到视频生成任务，请先使用 `/generate-video {集数}` 提交任务"，结束
4. 使用 Read 工具读取 tasks.json，解析 JSON 内容

### 阶段 2: 逐个查询 submitted 任务

对每个 status 为 `submitted` 且 submit_id 非空的任务：
1. 查询状态：`bash scripts/video-check-dreamina.sh "{submit_id}" "story/episodes/{集数}/videos/shot{NN}.mp4"`
2. 根据输出更新 tasks.json 中该 shot 的记录（用 Read 读取最新内容，修改后用 Write 写回）：
   - `success` → 将 status 改为 `done`
   - `fail:{原因}` → 将 status 改为 `failed`，将 fail_reason 改为 `{原因}`
   - `querying` → 不修改，仍为 submitted

### 阶段 3: 同步已有视频文件

1. 使用 Bash `ls story/episodes/{集数}/videos/shot*.mp4` 列出已有视频文件
2. 对比 tasks.json，如果某个 shot 有视频文件但 status 不是 `done` → 将 status 改为 `done`
3. 如果某个 shot 有视频文件但不在 tasks.json 中 → 添加一条 done 记录

### 阶段 4: 输出进度摘要

1. 统计各状态数量：done / submitted / failed
2. 输出摘要：完成 N 个 / 排队中 N 个 / 失败 N 个

### 阶段 5: 失败处理（仅当有 failed 任务时）

对每个 status 为 `failed` 的任务，判断 `fail_reason` 属于哪种类型：
- 并行限制/频率限制/服务端临时错误 → 可自动重试
- 内容安全/合规拒绝/参数错误/其他 → 需人工介入

每次失败都重新判断（因为同一个镜头多次失败的原因可能不同）。

**a. 可自动重试的任务：**
1. 告知用户该镜头因临时原因失败，正在自动重试
2. 从 tasks.json 中读取该 shot 的 `prompt`、`images`、`duration`
3. 读取配置：`bash scripts/read-config.sh "即梦视频模型版本"` 和 `bash scripts/read-config.sh "视频比例"`
4. 重新提交：`bash scripts/video-gen-dreamina.sh "{prompt}" "story/episodes/{集数}/videos/shot{NN}.mp4" "{images}" "{duration}" "{比例}" "{模型版本}"`
5. 根据提交结果，用 Read 读取 tasks.json 最新内容，修改该 shot 的记录后用 Write 写回：
   - 成功 → 更新 submit_id、status 改为 `submitted`、清空 fail_reason
   - 失败 → status 保持 `failed`、更新 fail_reason
6. 若提交失败且仍为并行限制 → 停止重试剩余任务，提示用户稍后再试

**b. 需人工介入的任务：**

**自动模式（`--auto`）：** 仅输出失败镜头和原因，提示用户可用 `/check-video {集数}` 手动处理，不询问用户。

**交互模式（默认）：**
1. 显示镜头编号和 `fail_reason` 原文
2. 询问用户："镜头 {N} 生成失败，原因：{fail_reason}。您有修改建议吗？（输入建议，或回复「自动修复」交给我判断）"
3. **用户有建议** → 根据建议内容判断目标类型并调用相应 skill：
   - 涉及分镜/画面描述修改 → 检查是否存在 `story/episodes/{集数}/script.md`（短视频）或 `story/episodes/{集数}/novel.md`（系列视频），使用对应的 fix-storyboard skill（`short-fix-storyboard` 或 `storyboarder-fix-storyboard`）
   - 涉及资产/图片修改 → 使用 Bash 调用 `bash scripts/read-config.sh "图像模型"` 获取图像模型值，调用 `creator-fix-asset` skill + `creator-image-{图像模型值}` skill
4. **用户选择自动修复** → 自行分析 `fail_reason`，判断最可能的原因并调用相应 skill
5. 重新生成 prompt：`bash scripts/storyboard-to-prompt.sh "story/episodes/{集数}/storyboard.md" {镜头编号}`
6. 读取配置：`bash scripts/read-config.sh "即梦视频模型版本"` 和 `bash scripts/read-config.sh "视频比例"`
7. 重新提交：`bash scripts/video-gen-dreamina.sh "{新prompt}" "story/episodes/{集数}/videos/shot{NN}.mp4" "{images}" "{duration}" "{比例}" "{模型版本}"`
8. 用 Read 读取 tasks.json，更新该 shot 记录（新 submit_id、status、prompt），用 Write 写回
9. 提示用户稍后再次使用 `/check-video {集数}` 查询

## 输出

### 返回内容
- 进度摘要 + 失败处理结果
