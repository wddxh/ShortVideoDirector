---
name: "director-review-assets-visual"
description: "批量 dispatch director-review-asset-visual-single 对所有 asset 做 visual review。参数 --type 控制范围。"
metadata:
  svd-context: "fork"
  svd-agent: "director"
  svd-user-invocable: "false"
  svd-model: "opus"
---

> **执行上下文**：本 skill 被设计为由 `director` 子代理通过 `task` 工具派发执行。当你看到此 skill 内容时，你已在正确的子代理上下文中；按下方流程执行即可。

## 输入

### 文件读取
- `story/config.md` — 必须读取（取 `视觉_review_并发数` 字段；缺省 5）
- 按 `--type` 收集 asset .md 列表（Glob）

### Skill 调用
- `director-review-asset-visual-single` — 对每个 asset 调用一次

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — `--type=<逗号分隔>`：`characters` / `locations` / `items` / `buildings` / `keyframes` / `all`
- `$ARGUMENTS[1]` — ep（如 `ep01`）。仅当 type 含 `keyframes` 时必填；其他类型可省略

## 职责描述

### 核心使命

把单 asset visual review 的结果**纯透传聚合**为全集（或指定范围）完整的 visual review 结果。直接下游是 `creator-fix-asset-image`：本 skill 输出"通过"或"需修改 + 意见列表 + dirty list"，fix 据 dirty list 改 prompt 重抽。**纯透传——不做跨 asset 比较**（如"角色 A 和角色 B 风格不统一"），跨 asset 一致性由 `creator-create-assets` 模板保证；本 skill 只负责调度单 asset review 与聚合输出。

### 工作思路

1. **解析 --type**：拆分逗号分隔的 type 列表；`all` 等价于 `characters,locations,items,buildings,keyframes`
2. **收集 asset .md 列表**（按 type）：
   - `characters`: Glob `assets/characters/*.md`
   - `locations`: Glob `assets/locations/*.md`
   - `items`: Glob `assets/items/*.md`
   - `buildings`: Glob `assets/buildings/*.md`
   - `keyframes`: Glob `assets/keyframes/{ep}/*.md`（ep 必填）
3. **计算 image path**：对每个 asset .md 调用 `bash scripts/asset-to-image-path.sh <asset.md列表>` 批量得到对应 .png 路径（每行一个）
4. **读 config 取并发数**：`视觉_review_并发数`，缺省 5；上限 5（OC 单 message 并行限制）
5. **分批 dispatch**：按 (asset_path, image_path) 对的全局顺序（type 顺序 → 同 type 内 Glob 顺序）切批，每批 ≤并发数
6. **逐批执行**：
   - 在主 skill 单条 message 内，对批内每个 (asset_path, image_path) 对**并行使用 Skill tool 调用** `director-review-asset-visual-single`，传递参数：`{asset_path} {image_path}`
   - 等批内全部 done
   - 失败者（subagent 抛错 / 返回非空非 JSON）→ 同批内再 dispatch 1 次；仍失败计入「无法判定」列表
7. **进度日志**：每批 dispatch 前主 skill 输出一行 `批 i/N: {type}/{首-末 asset 名}`
8. **收集每次返回**：
   - 空字符串 → 通过
   - JSON 对象 → 加入意见列表，asset_path 加入 dirty list
   - 重试仍失败 → 加入「无法判定」列表（不入 dirty list）
9. **聚合输出**（按 asset_path 全局顺序排序）

### 常见误区（失败模式）

- **批量参数错误** — `--type` 拼写错 / keyframes type 没传 ep → asset 列表为空或越界 — 严格校验 --type，keyframes 必带 ep
- **跨 asset 比较** — 在聚合层做"角色 A 和角色 B 风格不一致"判断 — 聚合器不做跨 asset 比较，纯透传单 asset 结果
- **dirty list 格式不一致** — dirty list 中混入不同分隔符 / 缺字段 → 下游 `creator-fix-asset-image` 解析失败 — 严格按下方"输出格式"段
- **并发数过高** — 单 message 内 dispatch > 5 个 task → OC 限流 — 默认 5，config 配置上限同样 5
- **改写单 asset 意见** — 收到单 asset JSON 后改写 issue / prompt_direction 文字 — 原样透传
- **无法判定混入 dirty list** — 重试失败的 asset 也加进 dirty list 让 fix 处理 — 不能加，fix 不知道改什么方向

## 输出格式

审核结果写入 `story/episodes/$ARGUMENTS[1]/.review-assets-visual.md`（append 模式，每轮追加一段）；若 type 不含 `keyframes` 且未传 ep，则写入 `story/.review-assets-visual.md`（全局 asset 范围）。

**Round 自检**：Read 目标文件（不存在视为第 1 轮；存在则 grep `^## 第 [0-9]+ 轮` 取最大 N，本次为 N+1）。用 Write（首次）或 Edit（append；oldString 用文件末尾 30-50 字符 anchor）追加本轮段。

**本轮段 heading（4 变体）**：

| 情形 | heading |
|---|---|
| M=0, K=0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过` |
| M=0, K>0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过 ({K} 项无法判定)` |
| M>0, K=0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)` |
| M>0, K>0 | `## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项, {K} 项无法判定)` |

M = 意见条数，K = 无法判定条数。

**本轮段 body**（M>0 时含意见列表与 dirty list；K>0 时含无法判定列表；均按 asset_path 全局顺序排序）：

```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项, {K} 项无法判定)

### 意见列表
1. **{asset_path}：** {issue} → {prompt_direction}
2. **{asset_path}：** {issue} → {prompt_direction}
...

### dirty list
assets/characters/张三.md|assets/images/characters/张三.png
assets/keyframes/ep01/KF-EP01-005.md|assets/images/keyframes/ep01/KF-EP01-005.png

### 无法判定（subagent 重试失败）
assets/locations/古宅.md|assets/images/locations/古宅.png
```

dirty list 格式：每行一个 entry，`{asset_path}|{image_path}`（管道符分隔），供下游 `creator-fix-asset-image` 直接消费。「无法判定」段同格式但 fix skill 自然跳过。

通过时（M=0, K=0）仅 heading 行 + 前置空行。

## 规则

- **分批并行调用单 asset skill**：每批 ≤并发数（默认 5），主 skill 单条 message 内并行 dispatch；批内同步等待全部 done，批间串行
- **重试规则**：单 asset 失败最多重试 1 次；仍失败计入「无法判定」，不入 dirty list
- 调度顺序严格按 type 顺序（characters → locations → items → buildings → keyframes）→ 同 type 内 Glob 顺序
- 单 asset skill 返回的 JSON 内容不二次加工，原样透传
- 不接管子 agent 的 review 工作

## 输出

### 文件操作
- 使用 Bash 调 `scripts/asset-to-image-path.sh` 批量算 image path
- 使用 Write 或 Edit 维护 `.review-assets-visual.md`（append 模式）

### 返回内容

简报（4 变体）→ 返回给调用方：

| 情形 | 简报 |
|---|---|
| M=0, K=0 | `pass` |
| M=0, K>0 | `pass {K}_unknown` |
| M>0, K=0 | `needs_revision {M}` |
| M>0, K>0 | `needs_revision {M} {K}_unknown` |

调用方判断：
- `needs_revision` 开头 → 进入 fix 循环
- `pass` 开头 → 本轮通过

详细意见、dirty list、无法判定列表已写入文件，下游 fix skill 自行读取最后一轮段。



