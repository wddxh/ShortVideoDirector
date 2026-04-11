# 视频生成定时任务 设计文档

> **执行方式：** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。

**目标：** 创建定时任务自动管理视频生成的异步流程：查询状态、下载完成视频、自动重试因并行限制失败的任务。

**架构：** 用户可调用 skill（`auto-video`）通过 CronCreate 创建定时任务，定时执行检查脚本。tasks.json 扩展记录完整 prompt 信息，重新提交时直接复用。

---

## 1. 用户入口

**`/auto-video`** — 用户可调用 skill，也可由 `generate-video` 自动调用。

```
/auto-video ep01              # 监控 ep01，默认每 1200 秒（20 分钟）检查
/auto-video ep01 300          # 监控 ep01，每 300 秒检查
/auto-video all               # 监控所有集
/auto-video all 600           # 监控所有集，每 600 秒检查
```

**参数：**
- `$ARGUMENTS[0]` — 集数（如 `ep01`）或 `all`
- `$ARGUMENTS[1]` — 检查间隔秒数（可选，默认 `1200`）

## 2. tasks.json 扩展

每条记录从原来的 3 字段扩展为：

```json
{
  "shot": 1,
  "submit_id": "xxx",
  "status": "submitted",
  "prompt": "替换后的完整镜头块...",
  "images": "assets/images/characters/林知意.png,assets/images/items/铜镜.png",
  "duration": 15,
  "fail_reason": ""
}
```

- `prompt` — 完整的替换后镜头 markdown 块（含 `[名称:{图片N}]` 格式）
- `images` — 逗号分隔的图片路径列表（与 `--image` 传入顺序一致）
- `duration` — 镜头时长秒数
- `fail_reason` — 失败原因（仅 failed 状态时有值）
- `retriable` — 是否可自动重试（布尔值，由 LLM 判断 fail_reason 后设置。true = 并行限制/服务端临时错误，false = 需人工介入，默认 false）

**status 值域：** `submitted` / `done` / `failed`

## 3. 对 creator-video-dreamina 的修改

在阶段 4（写入 tasks.json）中，`upsert` 的 JSON 条目需包含完整的 prompt、images、duration 字段。原来只写 `shot`、`submit_id`、`status`，现在扩展为完整 6 字段。

## 4. 对 generate-video 的修改

在阶段 5（完成）追加：
```
3. 使用 Skill tool 调用 `auto-video` skill，传递参数：`{集数} 1200`
```

提交完视频任务后自动开始定时监控。

## 5. auto-video skill

**frontmatter：**
- `name: auto-video`
- `description: 创建定时任务自动监控视频生成状态，下载完成视频，重试因并行限制失败的任务。`
- `user-invocable: true`
- `allowed-tools: Read, Write, Glob, Bash, CronCreate, CronDelete, CronList`
- `argument-hint: "[集数|all] [检查间隔秒数]"`

**流程：**

1. 解析参数：集数（或 `all`）、间隔（默认 1200）
2. 使用 CronCreate 创建定时任务，命令为 `bash scripts/auto-video-check.sh {集数|all}`，间隔为指定秒数
3. 输出：已创建定时任务，每 {N} 秒检查一次，任务全部完成后自动停止

## 6. 检查脚本 `scripts/auto-video-check.sh`

**用法：**
```bash
bash scripts/auto-video-check.sh ep01
bash scripts/auto-video-check.sh all
```

**每次执行逻辑：**

### 步骤 1: 确定目标 + 同步已有视频

- 若参数为 `all` → 扫描 `story/episodes/*/videos/tasks.json`
- 若参数为集数 → 只检查 `story/episodes/{集数}/videos/tasks.json`
- 若无 tasks.json → 输出"无任务"并退出

对每个目标集，扫描 `story/episodes/{集数}/videos/shot*.mp4`，对于已有视频文件但 tasks.json 中无对应条目的镜头，调用 `task-status.sh upsert` 创建一条记录：
```json
{"shot": N, "submit_id": "", "status": "done", "prompt": "", "images": "", "duration": 0, "fail_reason": ""}
```
确保进度统计准确反映已有视频。

### 步骤 2: 查询 submitted 任务

对每个 tasks.json：
- 调用 `bash scripts/task-status.sh query "{tasks.json路径}" "{临时下载目录}"`
- 解析输出，对每个结果：
  - `success` → mv 下载文件到 `shot{NN}.mp4`，用 `task-status.sh update` 更新 status 为 `done`
  - `fail` → 分析 fail_reason：
    - 若包含并行限制相关关键词（如 `rate_limit`、`concurrent`、`too_many_requests`、`queue_full` 等）→ 用 `task-status.sh update` 更新 status 为 `pending_retry`
    - 否则 → 用 `task-status.sh update` 更新 status 为 `failed`，记录 fail_reason
  - `querying` → 不动

### 步骤 3: 重新提交 pending_retry 任务

扫描 tasks.json 中 status 为 `pending_retry` 的任务：
- 从记录中提取 `prompt`、`images`、`duration`
- 读取 config 获取视频模型配置（`bash scripts/read-config.sh "即梦视频模型版本"` 等）
- 逐个调用 `bash scripts/video-gen-dreamina.sh "{prompt}" "{输出路径}" "{images}" "{duration}" "{比例}" "{模型版本}"`
- 提交成功 → 用 `task-status.sh upsert` 更新为新 submit_id + status `submitted`
- 提交失败且 fail_reason 是并行限制 → 停止提交剩余 pending_retry 任务（已达到限制）
- 提交失败且 fail_reason 非并行限制 → 更新为 `failed`

### 步骤 4: 清理临时目录

`rm -rf {临时下载目录}`

### 步骤 5: 检查终止条件

统计所有 tasks.json 中的状态：
- 若所有任务都是 `done` 或 `failed`（无 `submitted` 和 `pending_retry`）→ 输出最终摘要，退出码 0（触发 cron 自动停止）
- 否则 → 输出进度摘要，退出码非 0（继续定时执行）

**退出码约定：**
- `0` — 所有任务已完成，定时任务应停止
- `1` — 仍有进行中的任务，继续定时执行

## 7. CronCreate 的终止机制

CronCreate 的定时任务需要能根据脚本退出码自动停止。若 CronCreate 不支持基于退出码停止，则在 auto-video skill 中额外说明：脚本检测到全部完成时，自行调用 CronDelete 删除定时任务。

具体实现取决于 CronCreate 的能力，skill 中需要读取 CronCreate 返回的 cron ID，传给脚本用于自删除。

## 8. 不在本次范围内

- 自动修复非并行限制导致的失败（仍由 `/check-video` 手动处理）
- 视频拼接/合成
