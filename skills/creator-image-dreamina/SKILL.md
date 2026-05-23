---
name: creator-image-dreamina
description: 使用即梦CLI为指定的资产列表生成参考图片，包含登录检查、生成、轮询和超时处理。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Glob, Bash
model: sonnet
---

## 输入

### 文件读取
- `config.md` — 必须读取（获取 `## 图像生成配置` 中的即梦模型版本、图片比例、图片分辨率）
- 每个资产的 `.md` 文件 — 读取 `## 图像生成提示` 内容

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS` — 资产文件路径列表（如 `"assets/characters/张三.md" "assets/locations/小巷.md"`）

## 职责描述

使用即梦CLI为指定资产生成参考图片。按"基础资产 → 造型变体 → 关键帧"三档拓扑顺序生成，每档全部完成（含 pending 轮询）才进入下一档：基础资产用 text2image，造型变体用 image2image（1 张参考图 = 基础角色图），关键帧用 image2image（1–10 张参考图 = composition 引用的所有资产图）。处理登录检查、逐档生成、pending 轮询和超时记录。

## 流程

### 阶段 1: 准备

1. 使用 Bash 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh "即梦模型版本"` 等获取配置值（即梦模型版本、图片比例、图片分辨率）
2. 若模型版本非 `4.0`（即使用付费模型），计算预估积分消耗（资产数 × 3），提醒用户并等待确认
3. 使用 Bash 执行 `dreamina user_credit`，检查返回是否成功
   - 失败 → 输出"即梦CLI未登录，请先执行 `dreamina login` 完成登录"并结束

### 阶段 2: 分类排序

遍历所有资产路径，读取每个资产文件的 `## 基本信息` 中的 `类型` 字段，按类型分为三组：
- **档 1 基础资产**（类型 ∉ {造型变体, 关键帧}）— 第 1 档生成，无参考图，text2image
- **档 2 造型变体**（类型 = `造型变体`）— 第 2 档生成，1 张参考图（基础角色图），image2image
- **档 3 关键帧**（类型 = `关键帧`）— 第 3 档生成，N 张参考图（composition 引用的所有资产图），image2image

按"档 1 → 档 2 → 档 3"严格串行：每档全部资产处理完（包括 pending 轮询全部结束）才能进入下一档。档 2 依赖档 1 的角色图，档 3 依赖档 1 + 档 2 的全部图。

### 阶段 3: 逐个生成

按档 1 → 档 2 → 档 3 顺序处理。每档共用「OK / FAIL / PENDING 三态处理」逻辑：
- exit 0，stdout 以 `OK` 开头 → 记录成功
- exit 1，stdout 以 `FAIL` 开头 → 记录失败，记下失败原因
- exit 2，stdout 以 `PENDING` 开头 → 提取 `submit_id`，连同 `asset_path` 和 `output_path` 加入待查列表

每档处理完所有资产后，**先跑阶段 4 的 pending 轮询**把本档 pending 全部消化（成功/失败/超时），再进入下一档。

#### 档 1：基础资产

对每个基础资产路径：
1. 读取资产文件中 `## 图像生成提示` 部分的内容
2. 根据资产路径推导输出图片路径（使用 Bash 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/asset-to-image-path.sh "{资产路径}"`）
3. 使用 Bash 执行：`bash ${CLAUDE_PLUGIN_ROOT}/scripts/image-gen-dreamina.sh "{提示词}" "{输出路径}" "{比例}" "{分辨率}" "{模型版本}" ""`（第 6 参数为空字符串 → text2image）
4. 按三态处理结果

#### 档 2：造型变体

对每个造型变体资产路径：
1. 读取资产文件中 `## 图像生成提示` 部分的内容
2. 根据资产路径推导输出图片路径（同档 1）
3. 从 `## 基本信息` 中的 `基础角色` 链接提取基础角色名，推导基础角色图片路径 `assets/images/characters/{基础角色名}.png`，确认该图片存在后作为参考图
4. 若基础角色图片不存在 → 记录失败（"基础角色图片缺失，无法生成变装图"），跳过该资产
5. 使用 Bash 执行：`bash ${CLAUDE_PLUGIN_ROOT}/scripts/image-gen-dreamina.sh "{提示词}" "{输出路径}" "{比例}" "{分辨率}" "{模型版本}" "{基础角色图片路径}"`（第 6 参数为单个 png 路径）
6. 按三态处理结果

#### 档 3：关键帧

对每个关键帧资产路径（路径形如 `assets/keyframes/{集数}/{KF-id}.md`）：
1. 使用 Bash 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/keyframe-to-prompt.sh "{关键帧 .md 路径}"`
   - 退出码非 0 → 记录失败（"keyframe-to-prompt 失败：{stdout 第 1 行}"），跳过该关键帧
   - 退出码 0 → 解析 stdout：第 1 行 `IMAGES:逗号分隔图片路径`、`---` 之后是最终 prompt（含头部 `**引用资产：**` 行 + 空行 + 正文）
2. 依赖图存在性校验：用 Bash `test -f "{png}"` 逐张检查 `IMAGES:` 行里每个 .png 是否存在
   - 任一缺失 → 记录失败（"依赖资产图缺失：{第一个缺失的 png}"），跳过该关键帧（不阻塞其他关键帧）
3. 推导输出路径：`bash ${CLAUDE_PLUGIN_ROOT}/scripts/asset-to-image-path.sh "{关键帧 .md 路径}"` → `assets/images/keyframes/{集数}/{KF-id}.png`
4. 使用 Bash 执行：`bash ${CLAUDE_PLUGIN_ROOT}/scripts/image-gen-dreamina.sh "{prompt 文本}" "{输出路径}" "{比例}" "{分辨率}" "{模型版本}" "{IMAGES 逗号分隔字符串}"`
   - 第 1 参数 `{prompt 文本}` 是 step 1 中 `---` 之后的整段（从 `**引用资产：**` 行到末尾），原样传递，**不要剥离头部**——dreamina 需要看到 `[name:{图片N}]` 头部才能把名字对应到参考图槽位
5. 按三态处理结果。**注意**：dreamina CLI 一次最多 10 张参考图，超出会 FAIL；本档不在脚本层兜底，超出由 dreamina 报错→记 FAIL→由 `creator-fix-asset-image` 阶段判断是 director 拆帧还是减资产

### 阶段 4: 轮询 pending 任务

**调用时机：每档结束时调用一次（不是全局一次）。本档 pending 全部处理完成后回到阶段 3 继续下一档。**

若待查列表非空：
1. 等待 30 秒
2. 对每个 pending 项，使用 Bash 执行：`dreamina query_result --submit_id={submit_id} --download_dir=/tmp/dreamina-pending`
3. 检查返回 JSON 中 `gen_status`：
   - `success` → 找到下载的文件（`/tmp/dreamina-pending/{submit_id}_image_1.png`），使用 Bash 执行 `mkdir -p "$(dirname "{output_path}")" && mv "/tmp/dreamina-pending/{submit_id}_image_1.png" "{output_path}"`，记录成功，从待查列表移除
   - `fail` → 记录失败，从待查列表移除
   - `querying` → 保留在待查列表
4. 若待查列表仍非空，重复步骤 1-3（最多 5 轮，共约 2.5 分钟额外等待）
5. 5 轮后仍有 pending → 用 Read 读取 `assets/images/pending.json`（不存在则视为 `[]`），追加超时任务条目，用 Write 写回。pending.json 格式如下：

```json
[
  {"submit_id": "abc123", "output_path": "assets/images/characters/林知意.png", "asset_name": "林知意"}
]
```

| 字段 | 类型 | 说明 |
|------|------|------|
| submit_id | string | dreamina 返回的任务 ID |
| output_path | string | 图片应保存的目标路径 |
| asset_name | string | 资产名称 |

### 阶段 5: 摘要

输出结果摘要（按档分组）：
- 档 1 基础资产：成功 N 张 / 失败 N 张 / 超时待查 N 张
- 档 2 造型变体：成功 N 张 / 失败 N 张 / 超时待查 N 张
- 档 3 关键帧：成功 N 张 / 失败 N 张 / 超时待查 N 张
- 失败明细（含 asset 路径与失败原因）
- 超时待查记录已写入 assets/images/pending.json

## 常见误区

- **跨档并行** — 档 1 还有 pending 就开始档 2 → 档 2 依赖的角色图可能还没下载完 → 档 2 大量"基础角色图片缺失" — 严格按档串行，每档 pending 全消化才进下一档
- **档 3 单帧失败阻塞整批** — 某张关键帧依赖图缺失就抛错退出 — 单帧依赖缺失只跳过该帧并记 FAIL，其他帧正常处理
- **关键帧调 image-gen-dreamina 时第 6 参数传单 png 路径** — 关键帧的参考图是 `keyframe-to-prompt.sh` 输出的 `IMAGES:` 整串（逗号分隔），直接透传；不要拆 png 分别调
- **关键帧 > 10 张资产时手动截断** — 超 10 张应让 dreamina 报错→记 FAIL→由 fix 阶段决定（多半是 director 拆帧）；不要在本 skill 截断

## 输出

### 返回内容
- 生成结果摘要 → 返回给调用方
