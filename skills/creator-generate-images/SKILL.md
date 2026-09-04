---
name: creator-generate-images
description: 按 basic、storyboard-sheets 或 paths scope 路由图片生成。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Glob, Skill, Bash
model: sonnet
---

## 动态参数

- `$ARGUMENTS[0]`：集数，如 `ep01`
- `$ARGUMENTS[1]`：scope，必须为 `basic`、`storyboard-sheets` 或 `paths`
- `$ARGUMENTS[2..]`：`paths` scope 的明确卡片路径

## 路由

1. 读取 `config.md` 的图像模型。若为 `none`，输出 `images:skipped`；对于 `storyboard-sheets` 额外输出 `storyboard-sheet-images:skipped`。
2. `basic`：从本集资产清单收集 character/location/item/building 卡，跳过已有 PNG。使用 Skill tool 调用 `creator-image-{图像模型值}` skill，参数为 `basic {卡片路径...}`。
3. `storyboard-sheets`：Glob `assets/storyboard-sheets/{ep}/shotNN.md`，删除 `assets/images/storyboard-sheets/{ep}/` 下没有对应 canonical card 的 orphan PNG。使用 Skill tool 调用 `creator-image-{图像模型值}` skill，参数为 `storyboard-sheets {ep} {卡片路径...}`。
4. `paths`：只接受显式基础资产或 sheet card 路径，并按原顺序去重。使用 Skill tool 调用 `creator-image-{图像模型值}` skill，参数为 `paths {卡片路径...}`。

任何 scope 都不截断参考图。Provider 限制作为 provider 原始错误返回。

## 输出

返回 scope、成功、跳过、失败和 pending 数量；保留每个失败路径与原始原因。
