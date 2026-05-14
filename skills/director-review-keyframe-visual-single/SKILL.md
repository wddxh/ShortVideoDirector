---
name: director-review-keyframe-visual-single
description: Director 审核单张关键帧图片是否忠实实现了 .md 描述与资产卡，输出"通过"或"需修改 + prompt 改进方向"。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Glob
model: opus
---

## 输入

### 文件读取
- `assets/images/keyframes/$ARGUMENTS[0]/$ARGUMENTS[1].png` — 必须读取（当前帧图）
- `assets/keyframes/$ARGUMENTS[0]/$ARGUMENTS[1].md` — 必须读取（当前帧 prompt 与视觉描述）
- `story/episodes/$ARGUMENTS[0]/keyframes.json` — 必须读取（取当前帧的结构化字段：composition / characters / props / scene / shot_size / camera_position / lighting_tone / action / emotion）
- `assets/images/keyframes/$ARGUMENTS[0]/$ARGUMENTS[2].png` — 仅当 `$ARGUMENTS[2]` 非空时读取（上一帧图，衔接判断用）
- 当前帧引用的资产 .md（按 keyframes.json 的 characters / props / scene 字段，逐个 Glob 定位 `assets/**/{资产名}.md` 并读取） — 用于"图与资产卡是否一致"对比

### 动态参数（$ARGUMENTS）
- `$ARGUMENTS[0]` — 当前集数（如 `ep01`）
- `$ARGUMENTS[1]` — 当前 KF-id（如 `KF-EP01-005`）
- `$ARGUMENTS[2]` — 上一帧 KF-id（可选，第一帧时为空字符串）

## 职责描述

### 核心使命

判断**单张关键帧图片**是否忠实实现了 .md 描述、keyframes.json 结构化字段与资产卡。直接下游是汇总层 `director-review-keyframes-visual`：本 skill 输出空（通过）或 `{KF-id, 问题, prompt 改进方向}`（需修改），汇总层聚合成完整意见列表与 dirty list 给 `creator-fix-keyframe-image`。**本 skill 不评描述本身的合理性**——描述合理性是 narrative review 的职责；本 skill 只判"图是否实现了描述"。**只读不写**。

### 工作思路

1. **建立"应有画面"的脑内基准**：先读 keyframes.json 中本帧的结构化字段（composition / shot_size / camera_position / lighting_tone / action / emotion / characters / props / scene）+ 本帧 .md 的最终 prompt，在脑中重建"这张图应该长什么样"
2. **看图对比基准**：打开图片，逐项核对：景别对吗？机位对吗？主体位置/朝向对吗？光线色温对吗？情绪对吗？道具齐全吗？场景对吗？
3. **资产卡一致性**：对每个出场的角色/场景/道具，读其资产 .md，对比图中对应元素的外观（角色长相/服装、道具样式、场景特征）是否与资产卡描述一致——这是单帧内能做的"跨帧一致性"代理
4. **上一帧衔接判断**（仅有上一帧时）：读上一帧图，对比当前帧——衔接是否自然？variation_from_prev 字段描述的变化是否在画面上体现？是否存在不可解释的视觉跳跃（光线突变 / 角色突然换装 / 场景突变）？
5. **prompt 改进方向归因**：若发现问题，定位到 .md prompt 的具体段落给出改进方向——是构图段没说清主体位置？光线段缺色温？资产引用语法漏了？画面段缺关键道具？
6. **不可解释的图问题**：若图本身有明显瑕疵（多手指/扭曲）但 prompt 写得到位，仍标"需修改"并给出"加强构图段对主体清晰度的描述"等方向（fix 阶段会重抽，prompt 微调可能改善）
7. **通过的判断**：景别/机位/主体/光线/资产外观/上一帧衔接全部对得上 → 通过

### 常见误区

- **评描述合理性** — 看到"composition 写得不够精彩"就打回 — 本 skill 只评图实现度，描述合理性归 narrative review
- **替 fix 写 prompt** — 把"prompt 改进方向"写成完整 prompt 文本 — 只说方向（"构图段需补充主体在画面中的位置"），prompt 字面操作由 fix 决定
- **挑刺到不可能通过** — 每张图都能想出"更好的画面"，但本 skill 是质量门槛不是优化器 — 只拦"图与描述/资产卡明显不符"的问题
- **跨帧一致性越界** — 想"这张图的张三和上集 KF-007 的张三不像" — 本 skill 只看上一帧（衔接），跨多帧一致性靠资产引用机制兜底
- **忽略上一帧衔接** — 第二帧及之后必须读上一帧图判断衔接，模型容易跳过 — 上一帧 KF-id 非空时必须读其图

## 输出格式

通过时返回**空字符串**（无任何文字）。

需修改时返回单条 JSON 对象（无 markdown 包裹）：

```json
{
  "kf_id": "KF-EP01-005",
  "issue": "图中张三穿着白衬衫，但本帧 .md 的 composition 段未指定服装；资产卡 张三.md 描述为黑色风衣",
  "prompt_direction": "在画面段补充对张三服装的描述，明确为黑色风衣（与资产卡一致）"
}
```

字段含义：
- `kf_id`：当前帧 id
- `issue`：发现的问题（一句话说清"图与什么不符"）
- `prompt_direction`：prompt 改进方向（说方向，不写最终 prompt 文本）

## 规则

- 只读不写，无文件操作
- 单帧只输出一条（通过为空 / 需修改为单 JSON 对象）；本帧多个问题合并为一条 issue + 一个 prompt_direction
- 不输出"通过"字样的文字——空字符串即代表通过（汇总层据此判断）

## 输出

### 返回内容
- 空字符串（通过）或单条 JSON 对象（需修改） → 返回给 `director-review-keyframes-visual`
