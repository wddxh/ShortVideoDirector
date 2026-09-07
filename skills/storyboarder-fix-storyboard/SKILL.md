---
name: storyboarder-fix-storyboard
description: 在已有分镜需要局部修正、连续性排查或可生成性诊断时使用。
user-invocable: false
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill
model: sonnet
---

## 输入

- 委托本集的 `story/episodes/{ep}/storyboard.md`
- `story/episodes/{ep}/script.md`
- 与本次问题相关的已有规划或邻镜材料（可选）
- `story/episodes/{ep}/.review-storyboard.md`（委托以审核意见为依据时读取）
- 实际配置（`SVD_CONFIG` 或 `config.md`）与相关基础资产卡
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md` 与 `visual-prompt-craft-video.md`（同目录，共享视听表达方法）

## 委托上下文

- 确定 ep、目标 shots、修改或诊断目的、保留内容与授权范围。审核修正读取最新涉及目标的意见并核对当前材料，不回退旧 pass。
- 直接委托使用实际指令，不要求或拼接历史 review。范围不清先澄清，不从 skill 加载推定整集重写授权。

## 修正检查视角

按根因选择检查顺序；对白超载宜先算配速，越轴或持有物跳变宜先对照邻镜。下面的 schema、授权和输出边界始终适用。

- 问题定位：检查剧本、资产卡与邻镜，区分表达不清和上游事实矛盾。纯诊断返回依据与建议，不写文件。
- 修改范围：只修改意见涉及的 shot；增删或重编号时同步更新授权范围内受影响引用，范围外报告影响。
- 连续性与预算：修改动作后核对终态、朝向、屏幕方向、持有物与空间关系；修改时长后重算场景及整集 shot 合计，仍遵守初始用户集目标，不只检查局部或拉长预算。
- 产物边界：本次不修改 sheet 卡片或图片；报告受影响卡片和连续性事实，由 Director 协调兼容性评估，不自动重建。
- 输出契约：七字段 schema、资产边界、对白原文和配速约束保持有效。
- 单镜独立性：以最终文本与实际 refs 核对当前状态，把跨镜承接落实为本地姿态、朝向和持有关系；未绑定物件补足可见特征或合法引用。场景预算/制作备注放回源元数据，完整保留本镜声音特征、对白、内心声和运镜。

## 输出

有授权且实际需要修改时更新 `story/episodes/{ep}/storyboard.md`；纯诊断或无变化保留原文件。返回四个机器可读集合：

```text
changed shots: 2,5
added shots: none
deleted shots: none
renumbered shots: none
```

集合无成员时写 `none`。同时报告未处理问题和跨负责人建议。这些集合描述实际变化及潜在依赖影响，不要求调用方选择 Creator 的内部方法；Director 协调所需成果与授权范围，Creator 判断卡片是否需同步。修正后的独立审核由 Director 另行委派。
