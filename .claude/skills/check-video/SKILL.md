---
name: check-video
description: 查询视频生成任务的状态，下载已完成的视频，处理失败的任务。使用 /check-video ep01 查询。
user-invocable: true
argument-hint: 集数 [--auto]
allowed-tools: Read, Write, Edit, Glob, Bash, Skill, Agent
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
- **本 skill 仅在两条路径调用 dreamina 提交：(a) **阶段 5a 自动重试** —— failed 且分类为可自动重试，使用 tasks.json 原 prompt/images 重提，不得修改；(b) **阶段 5b 交互重试** —— 用户明确给出修改意见 → 调 fix-storyboard/fix-asset 改 storyboard → 重跑 storyboard-to-prompt.sh → 新 prompt 写入 tasks.json → 用新 prompt 重提。其他任何场景（测试、验证、调试、未登记 shot、已 submitted/done 的 shot）一律禁止提交。**

## tasks.json 格式

文件路径：`story/episodes/{集数}/videos/tasks.json`

每条记录包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| shot | number | 镜头编号（主键，从 1 开始） |
| submit_id | string | dreamina 返回的任务 ID（未提交时为 `""`） |
| status | string | `pending`（已登记未提交）/ `submitted`（等待结果）/ `done`（视频已下载）/ `failed`（生成失败） |
| prompt | string | 提交时使用的完整 prompt 文本 |
| images | string | 逗号分隔的参考图片路径列表 |
| duration | number | 视频时长（秒） |
| fail_reason | string | 失败原因（成功时为 `""`） |

完整示例（含所有 status）：

```json
[
  {"shot": 1, "submit_id": "0a7fdfa1711442ee", "status": "done", "prompt": "### 镜头 1\n- **镜头类型：** 特写\n...", "images": "assets/images/characters/林知意.png,assets/images/locations/郊外泥地.png", "duration": 15, "fail_reason": ""},
  {"shot": 2, "submit_id": "ba99c56731e2bf2a", "status": "submitted", "prompt": "### 镜头 2\n- **镜头类型：** 中景\n...", "images": "assets/images/characters/林知意.png", "duration": 15, "fail_reason": ""},
  {"shot": 3, "submit_id": "", "status": "failed", "prompt": "### 镜头 3\n...", "images": "assets/images/characters/林知意.png", "duration": 15, "fail_reason": "ExceedConcurrencyLimit"}
]
```

写入规则：
- 每个 shot 编号只能有一条记录，更新时替换已有条目
- 写入完整 JSON 数组，不要追加或部分修改
- 必须用 Read 读取最新内容后再修改，避免覆盖其他 shot 的变更

## 流程

### 阶段 1: 读取任务状态

1. 从 `$ARGUMENTS[0]` 获取集数（如 `ep01` 或 `all`）
2. 从 `$ARGUMENTS[1]` 获取可选模式；若其为 `--auto` 则启用自动模式，否则使用交互模式
3. 若 `$ARGUMENTS[0]` 为空：
   - **交互模式**：提示"请提供集数参数，例如 `/check-video ep01` 或 `/check-video ep01 --auto`"，结束
   - **`--auto` 模式**：输出异常 JSON 摘要（`recoverable=false`，`error` 描述缺少集数参数），然后结束
4. 若集数为 `all` → 使用 Glob 扫描 `story/episodes/*/videos/tasks.json`；否则读取指定集的 tasks.json
5. 若文件不存在（或 `all` 模式下 Glob 无匹配）：
   - **交互模式**：提示"未找到视频生成任务，请先使用 `/generate-video {集数}` 提交任务"，结束
   - **`--auto` 模式**：按"异常时的 JSON 输出"章节要求输出 JSON 摘要（`recoverable=false`，`error` 描述文件缺失），然后结束。不要仅输出人类可读的提示而跳过 JSON
6. 使用 Read 工具读取 tasks.json，解析 JSON 内容

### 阶段 2: 逐个查询 submitted 任务

若 tasks.json 中存在 status 为 `pending` 的记录 → 输出一行提示："检测到 {N} 个 shot 为 pending 状态（已登记未提交）。请运行 `/generate-video {集数}` 完成提交。本 skill 仅处理 submitted/done/failed。" → 继续处理其他状态的 shot。

对每个 status 为 `submitted` 且 submit_id 非空的任务：
1. 查询状态：`bash scripts/video-check-dreamina.sh "{submit_id}" "story/episodes/{集数}/videos/shot{NN}.mp4"`
2. 根据输出更新 tasks.json 中该 shot 的记录（用 Read 读取最新内容，修改后用 Write 写回）：
   - `success` → 将 status 改为 `done`
   - `fail:{原因}` → 将 status 改为 `failed`，将 fail_reason 改为 `{原因}`
   - `querying` → 不修改，仍为 submitted

**`--auto` 模式异常处理：** 若 `scripts/video-check-dreamina.sh` 返回非预期输出或非零退出码，按"JSON 摘要契约 → 异常时的 JSON 输出"章节规则处理——记录 `error`（说明哪个 shot 查询失败），继续处理其他 shot，最终输出时标记 `recoverable=true`。不要因单个 shot 查询失败就跳出整个流程。

### 阶段 3: 同步已有视频文件

1. 使用 Bash `ls story/episodes/{集数}/videos/shot*.mp4` 列出已有视频文件
2. 对比 tasks.json，如果某个 shot 有视频文件但 status 不是 `done` → 将 status 改为 `done`
3. 如果某个 shot 有视频文件但不在 tasks.json 中 → 添加一条 done 记录

### 阶段 4: 输出进度摘要

1. 统计各状态数量：pending / done / submitted / failed（`all` 模式下跨所有集合计）
2. 输出人类可读摘要：已登记未提交 N 个 / 完成 N 个 / 排队中 N 个 / 失败 N 个

**`--auto` 模式额外要求**：在本 skill 所有输出的**最后一行**追加一行 JSON 摘要，供自动化调用方（如 auto-video 的 sub-agent）解析。字段与填充规则见下方"JSON 摘要契约"章节。human_needed 列表在阶段 5 收集完毕后并入本 JSON。

交互模式（非 `--auto`）不输出 JSON，保持现状。

### 阶段 5: 失败处理（仅当有 failed 任务时）

对每个 status 为 `failed` 的任务，按 `src/workflows/check-video/failure-classification.md` 中的规则分类为"可自动重试"或"需人工介入"。每次失败都重新分类（同一镜头多次失败原因可能不同）。

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

**自动模式（`--auto`）：**
1. 不询问用户
2. 将该 shot 加入 human_needed 列表：`{"ep": "{集数}", "shot": {镜头编号}, "reason": "{fail_reason 原文}"}`
3. 该列表在阶段 5 全部 failed 任务分类完成后，并入阶段 4 要输出的 JSON 摘要的 `human_needed` 字段
4. 输出人类可读提示：失败镜头和原因，提示用户可用 `/check-video {集数}` 手动处理

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

## JSON 摘要契约（仅 `--auto` 模式）

### 正常 JSON 格式

```json
{
  "target": "ep01",
  "pending": 0,
  "done": 12,
  "submitted": 3,
  "failed": 2,
  "all_complete": false,
  "human_needed": [
    {"ep": "ep01", "shot": 5, "reason": "内容安全拦截"},
    {"ep": "ep01", "shot": 9, "reason": "参数错误"}
  ]
}
```

### 字段

| 字段 | 类型 | 说明 |
|------|------|------|
| target | string | 原样回传（`epNN` 或 `all`） |
| pending | number \| `"unknown"` | 已登记未提交的数量（需用户运行 `/generate-video` 完成提交） |
| done | number \| `"unknown"` | done 数量，all 模式下跨所有集合计 |
| submitted | number \| `"unknown"` | 仍在排队的数量 |
| failed | number \| `"unknown"` | 最终仍 failed（含需人工介入类） |
| all_complete | bool | `(pending == 0) && (submitted == 0) && (failed == human_needed.length)` |
| human_needed | array | 阶段 5 分类为"需人工介入"的 failed；每条 `{"ep": "...", "shot": N, "reason": "fail_reason 原文"}` |
| error | string | *仅异常时*；简短错误描述（≤100 字） |
| recoverable | bool | *仅异常时*；错误性质（见"异常时的 JSON 输出"） |

### 规则

- 数值字段无法统计时填字符串 `"unknown"`（不要填 0）
- 异常场景下 `all_complete` 强制为 `false`
- `human_needed` 在阶段 5 `--auto` 分支完成分类后填充
- JSON 必须是**单行有效 JSON**（无注释、无多余换行），作为 skill 输出的最后一行
- `all_complete` 仅当 `pending`/`done`/`submitted`/`failed` 均为数字时才按公式计算；任一字段为 `"unknown"` 时强制 `false`

### 异常时的 JSON 输出（仅 `--auto` 模式）

skill 在 `--auto` 模式下遇到任何异常（文件不存在、Glob 无匹配、tasks.json 格式损坏、脚本偶发失败等），**仍必须输出 JSON 摘要**，字段：

- `target`：原样
- `pending` / `done` / `submitted` / `failed`：已统计到的填数字，完全无法统计的填字符串 `"unknown"`
- `all_complete`：`false`（强制）
- `human_needed`：`[]`
- `error`：简短错误描述（≤100 字，不要 dump 堆栈）
- `recoverable`：bool。按错误性质判断：
  - **可恢复**（临时性、外部环境性）：某个 shot 查询脚本偶发失败、临时文件锁、dreamina API 抖动等；后续调用有机会成功
  - **不可恢复**（根因性、配置性）：目标集数对应 tasks.json 不存在、Glob 无匹配（`all` 模式下没有任何 ep 目录）、tasks.json 格式彻底损坏需人工修复；后续调用仍会同样失败

**判定原则：** LLM 按语义判断，不硬编码关键词。不确定时偏向 `recoverable=true`（保守）。

示例（tasks.json 不存在）：

```json
{"target":"ep99","pending":"unknown","done":"unknown","submitted":"unknown","failed":"unknown","all_complete":false,"human_needed":[],"error":"tasks.json 不存在：story/episodes/ep99/videos/tasks.json","recoverable":false}
```

示例（某 shot 查询脚本偶发失败，但其他 shot 已统计）：

```json
{"target":"ep01","pending":0,"done":10,"submitted":2,"failed":1,"all_complete":false,"human_needed":[],"error":"shot 3 查询脚本返回非预期输出","recoverable":true}
```

**不得因异常跳过 JSON 输出**——自动化调用方依赖它判断 cron 生命周期。

## 输出

### 返回内容
- 进度摘要 + 失败处理结果
