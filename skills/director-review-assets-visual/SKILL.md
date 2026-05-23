---
name: "director-review-assets-visual"
description: "批量 dispatch director-review-asset-visual-single 对所有 asset 做 visual review。参数 --type 控制范围。"
metadata:
  svd-context: "fork"
  svd-agent: "director"
  svd-user-invocable: "false"
  svd-model: "opus"
---

<EXTREMELY-IMPORTANT>

本 skill 是**纯调度层**。对每张图的 review **必须**通过 Skill 工具调用 `director-review-asset-visual-single`，由独立的 fork 子代理在自己的隔离 context 中完成。

**严禁在本 skill 的 context 内自行读取 .png 做 review**——即便你认为"我已是 director / single skill 是 standalone / 直接读 .md+.png 更省事"。

**根因（必须理解）**：本 skill 的 context 还要承载调度逻辑（按批 dispatch、收集结果、轮转 dirty list、写入 review 文件等）。若你把 N 张 .png 都读进本 context：

1. 单张 .png 通常 1-5MB（编码成 token 也是数千到上万 token/张）；N 张图 × token = context 接近上限
2. context 被图像 token 撑爆后，模型对调度逻辑的注意力下降 → 漏写 review 文件 / dirty list 格式错乱 / 漏调用 single skill / 输出截断
3. 多张图同时在 context 内还会发生**跨图判断污染**——本应独立审核的两张图互相参照，违反 single review"1-image 约束"的设计意图

**正确做法**：每张图独占一次 Skill 工具调用（即一次独立 fork 子代理），本 context 只保留"已派发 X 张 / Y 张完成 / dirty 列表 = [...]"这类轻量调度状态。

</EXTREMELY-IMPORTANT>

> **执行上下文**：本 skill 被设计为由 `director` 子代理通过 `task` 工具派发执行。当你看到此 skill 内容时，你已在正确的子代理上下文中；按下方流程执行即可。

## 输入

### 文件读取
- `story/config.md` — 必须读取（取 `视觉_review_并发数` 字段；缺省 5）
- 按 `--type` 收集 asset .md 列表（Glob）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

### Skill 调用
- `director-review-asset-visual-single` — 对每个 asset 调用一次

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — `--type=<逗号分隔>`：`characters` / `locations` / `items` / `buildings` / `keyframes`。**`all` 已废弃**——会触发 type 互斥校验失败（见工作思路 step 1.5）。请显式使用 `characters,locations,items,buildings` 或 `keyframes`
- `$ARGUMENTS[1]` — ep（如 `ep01`）。**所有 type 必填**（透传给 single review 用于读 script.md）

## 职责描述

### 核心使命

把单 asset visual review 的结果**纯透传聚合**为全集（或指定范围）完整的 visual review 结果。直接下游是 `creator-fix-asset-image`：本 skill 输出"通过"或"需修改 + 意见列表 + dirty list"，fix 据 dirty list 改 prompt 重抽。**纯透传——不做跨 asset 比较**（如"角色 A 和角色 B 风格不统一"），跨 asset 一致性由 `creator-create-assets` 模板保证；本 skill 只负责调度单 asset review 与聚合输出。

### 工作思路

1. **解析 --type**：拆分逗号分隔的 type 列表；`all` 等价于 `characters,locations,items,buildings,keyframes`
1.5 **type 互斥校验**：
   - 若 --type 解析后既含 basic asset 类型（characters/locations/items/buildings 任一）又含 keyframes（含 `all` 展开后混合）→ 立即报错退出
   - 错误信息："不支持混合 type；请分两次调用：先 basic asset，后 keyframes"
2. **收集 asset .md 列表**（按 type）：
   - `characters`: Glob `assets/characters/*.md`
   - `locations`: Glob `assets/locations/*.md`
   - `items`: Glob `assets/items/*.md`
   - `buildings`: Glob `assets/buildings/*.md`
   - `keyframes`: Glob `assets/keyframes/{ep}/*.md`（ep 必填）
3. **计算 image path**：对每个 asset .md 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/asset-to-image-path.sh <asset.md列表>` 批量得到对应 .png 路径（每行一个）
3.5 **缺图预扫描**（pre-dispatch filter）：
   对每对 (asset_path, image_path) 用 Bash `test -f "{image_path}"` 检查 .png 存在性
   - 不存在 → **直接构造 dirty 条目**，不派 single review：`{"asset_path": "...", "image_path": "...", "issue": "图缺失（首次生图失败或超时未生成）", "prompt_direction": "依据 .md 卡 ## 图像生成提示 段重新生成图片"}`
   - 存在 → 进入后续 dispatch 流程

   缺图条目和 dispatch 返回的条目最后**合并到同一 dirty list**（按 asset_path 全局顺序排序）。第 6 步"逐批执行"的输入只包含"存在图的 asset"。
4. **读 config 取并发数**：`视觉_review_并发数`，缺省 5；上限 5（OC 单 message 并行限制）
5. **分批 dispatch**：按 (asset_path, image_path) 对的全局顺序（type 顺序 → 同 type 内 Glob 顺序）切批，每批 ≤并发数
6. **逐批执行**：
   - 在主 skill 单条 message 内，对批内每个 (asset_path, image_path) 对**并行使用 Skill tool 调用** `director-review-asset-visual-single`，传递参数：`{asset_path} {image_path} {ep}`
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
- **缺图派发 review** — 对 image_path 不存在的 asset 也派发 single review → 子代理 Read PNG 报错 → 计入"无法判定"列表 → fix 永远拿不到这些 asset — 必须预扫描，缺图直接进 dirty list
- **混合 type 调用** — 一次 `--type=characters,keyframes` 或 `--type=all` → 触发 type 互斥校验失败 — 必须分两次调用：先 basic asset 一次，后 keyframes 一次

## 输出格式

**输出文件路径**（按 type 二选一）：

| --type 取值 | 输出文件 |
|---|---|
| 纯 basic asset（`characters` / `locations` / `items` / `buildings` 任意组合） | `story/episodes/{ep}/.review-basic-assets-visual.md` |
| 纯 keyframes（`--type=keyframes`） | `story/episodes/{ep}/.review-keyframes-visual.md` |
| **混合**（basic asset 与 keyframes 同时出现，含 `all`） | **拒绝执行**（已在工作思路 step 1.5 校验失败） |

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
- 使用 Write 或 Edit 维护对应的 review 文件（`.review-basic-assets-visual.md` 或 `.review-keyframes-visual.md`，append 模式）

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



