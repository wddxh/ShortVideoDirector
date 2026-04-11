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

## 约束

- **严禁自行编写脚本（包括 Python、Node.js、内联 bash 脚本等）。只能调用插件内 `scripts/` 目录下的现有脚本。**
- **tasks.json 的读取和写入由你（LLM）直接完成：用 Read 工具读取，用 Write 工具写入。不要用脚本操作 tasks.json。**
- **调用插件脚本时，如果相对路径 `scripts/xxx.sh` 找不到，使用 Glob 工具搜索 `**/scripts/xxx.sh` 找到插件目录下的脚本绝对路径。**

## tasks.json 格式

文件路径：`story/episodes/{集数}/videos/tasks.json`

每条记录包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| shot | number | 镜头编号（主键，从 1 开始） |
| submit_id | string | dreamina 返回的任务 ID（未提交时为 `""`） |
| status | string | `submitted`（等待结果）/ `done`（视频已下载）/ `failed`（生成失败） |
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

### 阶段 2: 解析分镜 + 构造 prompt

1. 读取 `story/episodes/{集数}/storyboard.md`，解析所有镜头（`### 镜头 N` 块）
2. 根据 `$ARGUMENTS[1]` 过滤目标镜头（`all` 则使用全部）
3. 若为 `all` 模式且 `story/episodes/{集数}/videos/tasks.json` 已存在 → 用 Read 读取 tasks.json，排除 status 为 `submitted` 或 `done` 的镜头（只提交尚未提交过的镜头）
4. 若过滤后无需提交的镜头 → 输出"所有镜头已提交，无需重复提交"并结束
5. 对每个目标镜头，使用 Bash 调用 `bash scripts/storyboard-to-prompt.sh "story/episodes/{集数}/storyboard.md" {镜头编号}` 获取替换后的 prompt、图片路径列表和时长

### 阶段 3: 逐镜头提交并记录

对每个目标镜头：
1. 提交视频生成：`bash scripts/video-gen-dreamina.sh "{替换后的prompt}" "story/episodes/{集数}/videos/shot{NN}.mp4" "{图片路径列表}" "{时长}" "{比例}" "{模型版本}"`
2. 根据退出码处理：
   - exit 0，stdout 以 `SUBMITTED` 开头 → 提取 `submit_id`
   - exit 1，stdout 以 `FAIL` 开头 → 提取失败原因
3. 用 Read 读取 tasks.json 最新内容（如果文件不存在则视为空数组 `[]`），按 shot 编号找到对应条目并更新（不存在则添加），然后用 Write 写回完整 JSON

### 阶段 4: 摘要

1. 使用 Bash 执行 `dreamina user_credit`，显示提交后的积分余额
2. 输出提交摘要：成功提交 N 个、提交失败 N 个

## 输出

### 返回内容
- 提交结果摘要 → 返回给调用方
