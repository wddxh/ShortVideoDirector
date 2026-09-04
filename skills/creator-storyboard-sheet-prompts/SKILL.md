---
name: creator-storyboard-sheet-prompts
description: Use when an approved episode storyboard needs storyboard-sheet planning cards before image generation.
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

# Storyboard Sheet Prompts

## 输入

必须读取：
- `story/episodes/$ARGUMENTS[0]/storyboard.md` 必须是已审核 storyboard；读取同目录 `.review-storyboard.md`，其最后一轮必须为“通过”，否则报上游错误并停止。
- `config.md`，取得项目语言、视频比例、视频风格和图像模型约束。
- Glob `assets/**/*.md`，建立资产名和真实路径映射；按 storyboard 当前 shot 实际引用读取所需资产卡。
- `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`，严格使用 card schema 和分板规则。

### 动态参数

- `$ARGUMENTS[0]`：ep，如 `ep01`。
- `$ARGUMENTS[1]`：模式，`full` 或 `incremental`；缺省 `full`。
- `$ARGUMENTS[2]`：`incremental` 必填的 shots，空格分隔 canonical shot 编号，如 `shot03 shot08`。

## 边界

唯一可写产物是 `assets/storyboard-sheets/{ep}/shotNN.md`。不修改 `storyboard.md`、config、资产卡、review 文件或 pipeline；不生图，也不删除或读取图片。旧 pipeline 未调用本 skill 时行为保持不变。

每张 card 只规划一个已审核 storyboard shot。missing asset 是上游错误：不得臆造资产、路径或替代物；把对应 shot 记入 failed 并明确要求修复 storyboard/资产清单。

## 同步流程

1. 解析 storyboard 的全集顺序 `### shot N`，将 N 格式化为 `shotNN`；提取时长、景别、机位/摄影机运动、出场人物、引用资产及带时间码的画面 beat。
2. 校验每个 shot 的 character、location、item、building 等资产均可唯一解析到现有 `.md`。KF 不是 sheet card 的参考资产；不要把它当作 current asset link。
3. `full`：为 storyboard 中所有 shot 创建或覆盖 card；删除目录中不再对应任何 storyboard shot 的孤儿 orphan card。全覆盖不表示无条件改写：内容相同计 preserved。
4. `incremental`：只处理 `$ARGUMENTS[2]` 的 shots，其他 card 保持不动。开始前比较 storyboard shot 集合和现有 card 集合；发现新增、删除、重排或编号变化，拒绝增量并要求 `full`。不得删除 orphan。
5. 按 rules 分解动态 Panel，无固定数量和上限；生成完整 prompt 后写 card。失败 shot 不写半成品，其他 shot 可继续。
6. 写后重新读取目标 card，确认 section 顺序、时间覆盖、链接路径与 Markdown 子集；只报告磁盘实际变化。

禁止用 Bash 写文件；Bash 仅可用于只读校验及在 `full` 中删除已确认的 orphan `.md`。

## 返回

返回机器可辨且人类可读的摘要，六项均须出现：

```text
created: shotNN ...
updated: shotNN ...
preserved: shotNN ...
deleted: shotNN ...
failed: shotNN: reason ...
actual changed shots: shotNN ...
```

`actual changed shots` 是 `created + updated + deleted` 的去重集合；无项目写 `none`。incremental 返回中必须能证明未请求 shots 被 preserved。
