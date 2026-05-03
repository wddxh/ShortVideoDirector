---
name: generate-video
description: 将分镜提示词提交为视频生成任务。读取分镜和资产图片，提交到即梦CLI，异步跟踪任务状态。使用 /generate-video ep01 提交整集，或 /generate-video ep01 镜头3 镜头5 提交指定镜头。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
argument-hint: "集数 [镜头N ...]"
model: opus
---

## 使用示例

```
/generate-video ep01
/generate-video ep01 镜头3 镜头5
/generate-video ep03 镜头1-镜头8
```

## 约束

- 严禁自行编写脚本（包括 Python、Node.js、内联 bash 脚本等）。只能调用插件内 `scripts/` 目录下的现有脚本。
- tasks.json 的读取和写入由你（LLM）直接完成：用 Read 工具读取，用 Write 工具写入。不要用脚本操作 tasks.json。
- 调用插件脚本时，如果相对路径 `scripts/xxx.sh` 找不到，使用 Glob 工具搜索 `**/scripts/xxx.sh` 找到插件目录下的脚本绝对路径。
- 提交视频生成任务的唯一入口是 `creator-video-dreamina` skill（仅处理 pending shot）；本 skill 不得在预登记以外直接调 dreamina CLI 提交任何任务（包括测试、验证、调试用途）。
- 预登记阶段是本 skill 更新 tasks.json 中 prompt / images / duration 字段的唯一时机；完成预登记后进入提交阶段，不得再改这些字段。

## 流程

### 阶段 1: 配置检查

1. 使用 Bash 调用 `bash scripts/read-config.sh "视频模型"` 获取视频模型值
2. 若视频模型为 `none` → 进入视频模型交互式配置流程：
   a. 询问视频模型：A) none B) dreamina
   b. 若选择 none → 提示"已取消"并结束
   c. 若选择 dreamina → 继续询问：
      - 即梦视频模型版本：A) seedance2.0fast（推荐） B) seedance2.0 C) seedance2.0fast_vip D) seedance2.0_vip
      - 视频比例：A) 16:9（推荐） B) 9:16 C) 1:1 D) 其他
      - 视频分辨率：A) 720p（当前仅支持 720p）
   d. 使用 Edit 更新 config.md：将 `视频模型: none` 改为 `视频模型: dreamina`，追加 `## 视频生成配置` 区域

### 阶段 2: 解析参数

1. 从 `$ARGUMENTS[0]` 获取集数（如 `ep01`）
2. 从 `$ARGUMENTS[1..]` 获取可选的镜头列表（如 `镜头3 镜头5`）
3. 读取 `story/episodes/{集数}/storyboard.md`
4. 解析分镜中的所有镜头（`### 镜头 N` 块）
5. 若指定了镜头 → 过滤出目标镜头；否则使用全部镜头

### 阶段 3: 前置检查

1. 从每个目标镜头的 `**引用资产：**` 行提取所有资产链接
2. 使用 Bash 调用 `bash scripts/asset-to-image-path.sh "{资产路径}"` 转换为图片路径
3. 使用 Glob 检查每个图片是否存在
4. 若有缺失 → 列出缺失清单，提示用户先生成图片（使用 `/series-edit-story 重新生成XXX的参考图片` 或确保图像模型已配置），结束
5. 全部存在 → 继续

### 阶段 4: 预登记到 tasks.json

1. 使用 Bash 执行 `mkdir -p story/episodes/{集数}/videos`
2. 使用 Read 读取 `story/episodes/{集数}/videos/tasks.json`（不存在视为空数组 `[]`）
3. 对每个目标镜头：
   a. 使用 Bash 调用 `bash scripts/storyboard-to-prompt.sh "story/episodes/{集数}/storyboard.md" {镜头编号}` 获取 prompt / images / duration
   b. 查找 tasks.json 中是否存在该 shot 记录：
      - **不存在** → 添加 `{shot: N, submit_id: "", status: "pending", prompt, images, duration, fail_reason: ""}`
      - **status == pending** → 用新值刷新 prompt / images / duration（保持 status 为 pending）
      - **status ∈ {submitted, done, failed}** → 用新值刷新 prompt / images / duration，保持 status 不变。若 prompt / images / duration 中任一与原值不同 → 输出警告行：`⚠️ shot {N}：storyboard 已变更，tasks.json 中 prompt/images/duration 已刷新，但视频状态仍为 {status}，未自动重提。后续行为按 status 不同：若 status=submitted，当前用旧 prompt 在 dreamina 排队，最终成功则视频丢失编辑（强制重生成需等查询完成后手删 mp4 + tasks.json 条目重跑 /generate-video），最终失败则下次 /check-video --auto 用新 prompt 重提；若 status=done，不会自动重提（需手删 shot{NN}.mp4 + tasks.json 条目后重跑 /generate-video）；若 status=failed，下次 /check-video --auto 若分类为 retryable（如并发限制、临时网络错误）则自动用新 prompt 重试无需手删，若分类为 human-needed（如内容安全、参数错误）则需 /check-video 交互模式介入或手删条目重跑。`
4. 使用 Write 把完整 JSON 数组写回 tasks.json（保留非目标 shot 的记录不动）
5. 统计本次需要提交的镜头 = 此时 status 为 pending 的目标镜头。若为空 → 输出"无 pending 镜头，无需提交"并跳到阶段 7

### 阶段 5: 提交任务

1. 读取 `config.md` 获取视频模型值
2. 使用 Skill tool 调用 `creator-video-{视频模型值}` skill，传递参数：`{集数} {目标 pending 镜头编号列表，如 "1 3 5" 或 "all"}`

### 阶段 6: 启动自动监控

1. 使用 Skill tool 调用 `auto-video` skill，传递参数：`{集数} 1200`

### 阶段 7: 完成

1. 输出提交摘要
