---
name: storyboarder-storyboard
description: Storyboarder将小说原文转化为完整分镜提示词。包含内部台词密度自检循环（最多3轮）。
user-invocable: false
context: fork
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep
---

## 输入

### 文件读取
- 从 `story/episodes/$ARGUMENTS[0]/outline.md` 的「本集资产清单」中提取本集引用的资产名称
- 使用 Glob 获取 `assets/**/*.md` 全部文件路径列表，仅读取文件名与清单中资产名称匹配的文件
- `story/episodes/$ARGUMENTS[0]/novel.md` — 必须读取
- `story/episodes/$ARGUMENTS[0]/outline.md` — 必须读取（含资产清单）
- `config.md` — 必须读取
- 根据 $ARGUMENTS[0] 计算上一集集数（如 $ARGUMENTS[0] 为 ep02 则上一集为 ep01），读取 `story/episodes/{上一集}/outline.md` — 若上一集存在则读取
- `story/episodes/{上一集}/storyboard.md` — 若存在则读取末尾 2-3 个镜头
- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循（输出格式、字段约束、规则）

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 ep01）

## 职责描述

将小说原文转化为完整的分镜提示词，包含镜头类型、运动、时长、转场和时间线叙事描写，并执行自检循环确保质量。

## 规则参考

- `skills/storyboarder-storyboard/rules.md` — 必须读取并严格遵循

## 分镜自检

生成分镜后执行自检循环（最多 3 轮）：
1. **自检输出格式** — 每个镜头是否严格使用了规定的字段结构（引用资产/镜头类型/镜头运动/视频风格/时长/转场/画面与声音描述）？是否存在「景别」「运镜」「画面描述」「视觉提示词」「音效/音乐」等非规定字段？若存在，必须按正确模板重写整个分镜。每个镜头的「画面与声音描述」是否为连贯叙事段落？是否存在台词/画面/音效分离列举的错误格式？（对照上方正确/错误示例）
2. **自检输出语言** — 所有内容语言是否与 config.md `语言` 设置一致？是否有混用语言的情况？
3. 自检每个分镜的台词充足性和声音连续性：是否有长时间无台词或无声音的空挡，台词是否足够丰富
4. 自检台词时长匹配：台词量是否与时间段时长匹配，是否存在语速过快的情况
5. 自检画面文字：画面描述中是否包含需要视频 AI 生成的具体文字或数字
6. 自检镜头间连贯性：相邻镜头之间是否有不合理的姿态/表情/场景跳变
7. 自检版权规避：是否存在现实中的明星或公众人物名字、真实地名、商标名
8. 全部达标 → 完成
9. 不达标 → 修正问题（格式错误则重写为连贯叙事，语言错误则统一为 config 语言，台词不足向 Writer 请求补充，时长不匹配调整时间段，画面文字改为角色台词，版权问题替换为虚构名称）→ 重新自检
10. 3 轮后仍有不足 → 接受当前结果

## 输出

### 文件操作
- 使用 Write 将分镜写入 `story/episodes/$ARGUMENTS[0]/storyboard.md`
