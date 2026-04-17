---
name: creator-video-dreamina
description: 使用即梦CLI multimodal2video 执行已登记 pending 镜头的状态转移（pending → submitted/failed），更新 tasks.json。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash
---

## 输入

### 文件读取
- `config.md` — 必须读取（获取 `## 视频生成配置` 中的即梦视频模型版本、视频比例、视频分辨率）
- `story/episodes/$ARGUMENTS[0]/videos/tasks.json` — 必须读取（由 generate-video 预登记创建）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 集数（如 ep01）
- `$ARGUMENTS[1]` — 目标镜头编号列表（如 `1 3 5` 或 `all`）

## 职责描述

从 tasks.json 加载 pending 镜头，读取其 prompt / images / duration，调用脚本提交视频生成任务，将结果（submit_id / status / fail_reason）写回 tasks.json。

## 约束

- **严禁自行编写脚本（包括 Python、Node.js、内联 bash 脚本等）。只能调用插件内 `scripts/` 目录下的现有脚本。**
- **tasks.json 的读取和写入由你（LLM）直接完成：用 Read 工具读取，用 Write 工具写入。不要用脚本操作 tasks.json。**
- **调用插件脚本时，如果相对路径 `scripts/xxx.sh` 找不到，使用 Glob 工具搜索 `**/scripts/xxx.sh` 找到插件目录下的脚本绝对路径。**
- **本 skill 只做 `pending → submitted / failed` 状态转移。严禁：(a) 处理 tasks.json 中不存在的 shot（视为上游 bug，输出错误提示并跳过该 shot 继续下一个，不得尝试提交）；(b) 处理 status ≠ pending 的 shot（submitted/done/failed 由 check-video 处理）；(c) 以测试、验证、调试名义提交任何任务；(d) 修改 tasks.json 的 prompt / images / duration（本 skill 仅更新 submit_id / status / fail_reason）。视频生成成本高，任何灰色操作直接烧钱。**

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

完整示例：

```json
[
  {"shot": 1, "submit_id": "0a7fdfa1711442ee", "status": "submitted", "prompt": "### 镜头 1\n- **镜头类型：** 特写\n...", "images": "assets/images/characters/林知意.png,assets/images/locations/郊外泥地.png", "duration": 15, "fail_reason": ""},
  {"shot": 2, "submit_id": "", "status": "failed", "prompt": "### 镜头 2\n...", "images": "assets/images/characters/林知意.png", "duration": 15, "fail_reason": "ExceedConcurrencyLimit"}
]
```

写入规则：
- 每个 shot 编号只能有一条记录，更新时替换已有条目
- 写入完整 JSON 数组，不要追加或部分修改
- 必须用 Read 读取最新内容后再修改，避免覆盖其他 shot 的变更

## 流程

### 阶段 1: 准备

1. 使用 Bash 调用 `bash scripts/read-config.sh "即梦视频模型版本"` 等获取配置值（即梦视频模型版本、视频比例、视频分辨率）
2. 使用 Bash 执行 `dreamina user_credit` 检查登录状态并显示当前积分余额
   - 失败 → 输出"即梦CLI未登录，请先执行 `dreamina login` 完成登录"并结束
3. 使用 Bash 确保输出目录存在：`mkdir -p story/episodes/{集数}/videos`

### 阶段 2: 加载 pending 任务

1. 使用 Read 读取 `story/episodes/{集数}/videos/tasks.json`（由 generate-video 预登记创建）
2. 若文件不存在 → 输出错误提示"tasks.json 不存在：generate-video 预登记未执行或已失效。请重跑 `/generate-video {集数}`"，结束
3. 根据 `$ARGUMENTS[1]` 过滤目标镜头：
   - `all` → 使用 tasks.json 中所有 status == `pending` 的记录
   - 具体编号列表（如 `1 3 5`）→ 在 tasks.json 中匹配这些 shot
4. 对过滤结果分类：
   - status == `pending` → 本次要提交
   - status ∈ {`submitted`, `done`, `failed`} → 跳过，输出一行提示"shot {N} status={status}，跳过（由 check-video 处理）"
   - 目标 shot 未在 tasks.json 中 → 输出错误"shot {N} 未登记，generate-video 预登记未覆盖。请重跑 `/generate-video`"，跳过该 shot 继续下一个
5. 若本次要提交的镜头为空 → 输出"无 pending 镜头"并结束

### 阶段 3: 逐镜头提交（状态转移）

对阶段 2 筛出的每个 pending 镜头：
1. 从 tasks.json 该 shot 记录读取 `prompt` / `images` / `duration`
2. 提交视频生成：`bash scripts/video-gen-dreamina.sh "{prompt}" "story/episodes/{集数}/videos/shot{NN}.mp4" "{images}" "{duration}" "{比例}" "{模型版本}"`
3. 根据退出码处理：
   - exit 0，stdout 以 `SUBMITTED` 开头 → 提取 `submit_id`，状态转移 pending → submitted
   - exit 1，stdout 以 `FAIL` 开头 → 提取失败原因，状态转移 pending → failed
4. 用 Read 读取 tasks.json 最新内容，按 shot 编号找到对应条目，**只更新 `submit_id` / `status` / `fail_reason` 三个字段**（prompt / images / duration 保持不变），然后用 Write 写回完整 JSON
5. 提交失败 → 写入 failed + fail_reason → 继续下一个 shot，本次运行中不得再次尝试该 shot
6. 若提交失败原因为并发限制 → 可提前停止本次提交剩余 pending，输出"已达并发上限，剩余 pending 镜头将在下次运行时重试"

### 阶段 4: 摘要

1. 使用 Bash 执行 `dreamina user_credit`，显示提交后的积分余额
2. 输出提交摘要：成功提交 N 个、提交失败 N 个

## 输出

### 返回内容
- 提交结果摘要 → 返回给调用方
