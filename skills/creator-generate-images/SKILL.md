---
name: creator-generate-images
description: 批量为指定集的资产生成参考图片。读取config后将工作委托给对应的模型skill。
user-invocable: false
context: fork
agent: creator
allowed-tools: Read, Glob, Skill
---

## 输入

### 文件读取
- `config.md` — 必须读取（获取图像模型值）
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（从「本集资产清单」获取资产列表）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

读取 config 中的图像模型配置，收集需要生成图片的资产列表，委托给对应的模型 skill 执行图片生成。

## 流程

1. 读取 `config.md`，获取 `图像模型` 值（使用 Bash 调用 `bash scripts/read-config.sh "图像模型"` 获取图像模型值）
2. 若图像模型为 `none` → 输出"图像模型未配置，跳过图片生成"并结束
3. 读取 `story/episodes/{集数}/outline.md` 中的 `## 本集资产清单`，收集所有资产文件路径（包括新增资产和已有资产）
4. 对每个资产，根据其路径推导图片路径（使用 Bash 调用 `bash scripts/asset-to-image-path.sh "{资产路径}"` 转换路径，然后检查文件是否存在），已存在则跳过
5. 若所有图片均已存在 → 输出"所有资产图片已存在，无需生成"并结束
6. 使用 Skill tool 调用 `creator-image-{图像模型值}` skill，传递参数：需要生成图片的资产路径列表（空格分隔，每个路径用引号包裹）
7. 输出生成摘要：成功数、跳过数、失败数

## 输出

### 返回内容
- 生成摘要 → 返回给调用方
