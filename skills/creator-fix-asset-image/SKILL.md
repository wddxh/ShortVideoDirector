---
name: "creator-fix-asset-image"
description: "通用 asset 图修复。消费 dirty list，按 asset 类型修改 .md 的\"图像生成提示\" section → 删旧 .png → 重新 generate。"
metadata:
  svd-context: "fork"
  svd-agent: "creator"
  svd-user-invocable: "false"
  svd-model: "sonnet"
---

> **执行上下文**：本 skill 被设计为由 `creator` 子代理通过 `task` 工具派发执行。当你看到此 skill 内容时，你已在正确的子代理上下文中；按下方流程执行即可。

## 输入

### 文件读取
- `$ARGUMENTS[0]` — `.review-assets-visual.md` 路径（如 `story/episodes/ep01/.review-assets-visual.md` 或 `story/.review-assets-visual.md`）。必须读取，取**最后一轮**的 `### dirty list` 与对应 `### 意见列表`
- 对 dirty list 中每个 asset_path 读取该 .md 卡（按需 Edit）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `$SVD_PLUGIN_DIR/skills/_meta/rules/visual-prompt-craft-common.md` — 必须读取（视觉 prompt 5 条核心原则 + 资产引用分场景规则）

### Skill 调用
- `creator-generate-images` — 删旧图后调用，自然补回新图

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — review 结果文件路径
- `$ARGUMENTS[1]` — ep（可选；若 dirty list 含 keyframes 则必填，传给 generate-images）

## 职责描述

### 核心使命

把 asset visual review 的"prompt 改进方向"落实为 asset .md 的 `## 图像生成提示` section 的**最小必要修订** + **重抽对应图片**。下游消费者是下一轮 visual review 或 workflow 收尾。**只改 dirty list 中的 asset，其他 asset 不动**。视觉问题的根因永远是图像 prompt 不到位，fix 的核心动作是把 `## 图像生成提示` section 改到位，然后让生图管道自然重跑。**不读图**——只用 .md 卡 + dirty list 中的 issue / prompt_direction 反馈。

### 工作思路

1. **解析 dirty list**：Read `$ARGUMENTS[0]`，grep `^## 第 [0-9]+ 轮` 定位最大 N 段，取该段的 `### dirty list`（每行 `{asset_path}|{image_path}`）与 `### 意见列表`（按 asset_path 匹配 issue + prompt_direction）
2. **逐条修改 asset .md**——对每个 dirty entry：
   a. Read asset_path 完整内容
   b. **只 Edit `## 图像生成提示` section**（其他 section 如 `## 视觉描述` / `## 出场记录` 等一律不动）
   c. 按 prompt_direction 把方向具体化写入 prompt（如方向"补充服装描述"→ prompt 中加"黑色长款风衣"）
3. **删旧 .png**：用 Bash 批量 `rm -f {image_path}`（dirty list 中**所有** image_path）；必须先删，否则 `creator-generate-images` 的 skip 检测会让它不重生
4. **重抽**：调用 task 工具触发 `creator-generate-images`（参数按 dirty list 中涉及的 asset 类型 + ep 填入），它扫到缺图自然补回
5. **通知 re-review**：输出 fix 摘要并建议用户再跑一次 `director-review-assets-visual` 确认

### 常见误区（失败模式）

- **读图** — fix 不需要看图，只用 .md 卡 + dirty list 的 issue/prompt_direction 反馈 — 严禁 Read PNG
- **改非 `## 图像生成提示` section** — 顺手调 `## 视觉描述` 或别的字段 — 视觉描述是 source of truth，fix 只动 prompt section；若意见指向视觉描述本身的问题，应让用户走 `creator-fix-asset` 而非本 skill
- **忘删旧 .png** — `creator-generate-images` 见图存在就跳过 → 重抽不发生 — 必须先删旧 .png 再调 generate
- **越权改非 dirty asset** — 看到顺手就把别的 asset 一并优化 — 严格只动 dirty list 中的 asset_path
- **照抄 prompt_direction 写到 prompt** — review 给的是"方向"（如"补充服装描述"），fix 要把方向具体化（"补充：黑色风衣"）— 不照搬方向文字
- **fix 完不通知 re-review** — fix 后默认通过，但 prompt 改了 ≠ 图一定对 — fix 结束必须输出"建议 re-review"提醒

## 规则

- **dirty list 严格边界** — 只动 dirty list 中的 asset_path，其他 asset 的 .md、图都不动
- **section 严格边界** — asset .md 只改 `## 图像生成提示` section，其他 section 一律不动
- **删图在前，generate 在后** — 严禁顺序颠倒
- **明星/真名替换兜底** — 改 prompt 时若发现现实明星名/真实地名/商标名，替换为虚构名

## 输出格式

```
## creator-fix-asset-image 摘要

- 处理 dirty list：N 项
- 修改 `## 图像生成提示`：N 项
  - {asset_path}：{改动要点}，原因：{意见简述}
- 删旧图：N 张
- 重抽结果：{creator-generate-images 摘要}
- **建议**：请运行 `director-review-assets-visual` 再次确认本轮修复是否到位
```

## 输出

### 文件操作
- 使用 Edit 修改 dirty list 中每个 asset .md 的 `## 图像生成提示` section
- 使用 Bash 删除 dirty list 中所有 image_path
- 使用 task 工具调用 `creator-generate-images`

### 返回内容
- fix 摘要（含 re-review 提醒）→ 返回给调用方


