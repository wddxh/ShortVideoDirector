---
name: creator-image-dreamina
description: 使用即梦CLI为指定的资产列表生成参考图片，包含登录检查、生成、轮询和超时处理。
---

## 输入

### 文件读取
- `config.md` — 必须读取（获取 `## 图像生成配置` 中的即梦模型版本、图片比例、图片分辨率）
- 每个资产的 `.md` 文件 — 读取 `## 图像生成提示词` 内容

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS` — 资产文件路径列表（如 `"assets/characters/张三.md" "assets/locations/小巷.md"`）

## 职责描述

使用即梦CLI为指定资产生成参考图片。处理登录检查、逐个生成、pending轮询和超时记录。

## 流程

### 阶段 1: 准备

1. 使用 Bash 调用 `bash scripts/read-config.sh "即梦模型版本"` 等获取配置值（即梦模型版本、图片比例、图片分辨率）
2. 若模型版本非 `4.0`（即使用付费模型），计算预估积分消耗（资产数 × 3），提醒用户并等待确认
3. 使用 Bash 执行 `dreamina user_credit`，检查返回是否成功
   - 失败 → 输出"即梦CLI未登录，请先执行 `dreamina login` 完成登录"并结束

### 阶段 2: 分类排序

遍历所有资产路径，读取每个资产文件的 `## 基本信息`，按类型分为两组：
- **基础资产**（类型非「造型变体」）— 先生成
- **造型变体**（类型为「造型变体」）— 后生成，依赖基础角色图片作为参考

先处理全部基础资产（包括等待 pending），确保基础角色图片就绪后，再处理造型变体。

### 阶段 3: 逐个生成

对每个资产路径（先基础资产，后造型变体）：
1. 读取资产文件中 `## 图像生成提示词` 部分的内容
2. 根据资产路径推导输出图片路径（使用 Bash 调用 `bash scripts/asset-to-image-path.sh "{资产路径}"` 推导图片路径）
3. 判断是否为造型变体资产（资产文件中 `## 基本信息` 包含 `类型：造型变体`）：
   - 若是造型变体 → 从 `## 基本信息` 中的 `基础角色` 链接提取基础角色名，推导基础角色图片路径 `assets/images/characters/{基础角色名}.png`，确认该图片存在后作为参考图
   - 若基础角色图片不存在 → 记录失败（"基础角色图片缺失，无法生成变装图"），跳过该资产
   - 若不是造型变体 → 无参考图
4. 使用 Bash 执行：`bash scripts/image-gen-dreamina.sh "{提示词}" "{输出路径}" "{比例}" "{分辨率}" "{模型版本}" "{参考图路径或空}"`
4. 根据退出码和 stdout 处理：
   - exit 0，stdout 以 `OK` 开头 → 记录成功
   - exit 1，stdout 以 `FAIL` 开头 → 记录失败，记下失败原因
   - exit 2，stdout 以 `PENDING` 开头 → 提取 `submit_id`，连同 `asset_path` 和 `output_path` 加入待查列表

### 阶段 4: 轮询 pending 任务

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

输出结果摘要：
- 成功：N 张图片已生成
- 失败：N 张图片生成失败（列出失败原因）
- 超时待查：N 张图片仍在排队（已记录到 pending.json，可稍后用 repair skill 恢复）

## 输出

### 返回内容
- 生成结果摘要 → 返回给调用方
