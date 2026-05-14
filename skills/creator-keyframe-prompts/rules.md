## 输出格式（每张关键帧的 .md 文件）

文件路径：`assets/keyframes/{集数}/{KF-id}.md`（如 `assets/keyframes/ep01/KF-EP01-001.md`）

```markdown
# {KF-id}

## 基本信息
- 所属集数：{集数}
- 类型：关键帧
- 剧情功能：{narrative_purpose 字段原文}

## 引用资产
- [{资产名1}]({资产 .md 相对路径1})
- [{资产名2}]({资产 .md 相对路径2})
- ...

## 视觉描述
{composition 字段原文，保留 <资产名> 标签}

镜头：{shot_size}，{camera_position}
光线：{lighting_tone}
情绪：{emotion}
动作：{action}

## 图像生成提示词
{融合后的 prompt：纯自然语言，资产名以裸名字出现，不带 markdown 链接、不带 <> 标签}
```

## prompt 翻译规则

prompt 必须按以下顺序拼接（用空格或合适的标点分隔，不要换行）：

1. **镜头语言段**：`{shot_size}，{camera_position}` → 比如 "中景，侧面齐胸平视，主体居左"
2. **画面段**：composition 内容，但把每个 `<资产名>` 标签替换为**裸名字**（不带 markdown 链接、不带角括号）
   - 示例：`<张三>站在栏杆前` → `张三站在栏杆前`
3. **光线段**：`光线：{lighting_tone}` 或自然融入画面段
4. **动作段**：`{action}` 或自然融入画面段（动作和 composition 描述若重复，优先 composition）
5. **风格 suffix**：从 config.md 读取"视频风格"，追加到末尾（"3D写实风格"、"2D动漫风格"等）

完整 prompt 示例：
> 中景，侧面齐胸平视，主体居左。雨中天台夜景，张三站在栏杆前侧脸朝向镜头，右手举着黑色翻盖手机贴近耳侧，屏幕亮着冷蓝色光打亮他下巴。远处城市霓虹模糊在雨幕中。冷蓝雨夜，3D写实风格。

引用关系**完全由 `## 引用资产` 区块声明**，prompt 正文不出现 markdown 链接或角括号。下游 `scripts/keyframe-to-prompt.sh` 只扫 `## 引用资产` 区块拿参考图列表，按首次出现顺序编号成 `{图片N}`，拼到送模型层 prompt 的头部 `**引用资产：** [name:{图片N}]、...` 行。

## 字段约束

- **prompt 语言** — 严格遵循 config.md 中 `语言` 设置（auto 跟随小说原文，zh 全中文，en 全英文）
- **`## 引用资产` 区块** — 列出 composition 中 `<>` 标签**首次出现**顺序的全部资产，**去重**。每条形如 `- [资产名](资产 .md 相对路径)`。这是引用关系的唯一来源——下游 `scripts/keyframe-to-prompt.sh` 只扫此区块。
- **prompt 正文格式** — 「图像生成提示词」段是**纯自然语言**：资产名以裸名字出现，不带 markdown 链接、不带角括号。引用关系靠 `## 引用资产` 区块承载。
- **不出现具体文字数字** — 招牌、屏幕内容、车牌等具体文字数字不要写进 prompt
- **不写不可感知信息** — 气味、温度、触感、味道不写进 prompt
- **不写运镜过程** — 推/拉/摇/移不写（关键帧是静态）
- **风格 suffix 必加** — 每条 prompt 末尾必须包含 config 视频风格描述

## 资产引用解析规则

1. 解析 composition 中每个 `<资产名>` 标签
2. 在 Glob 出的 `assets/**/*.md` 列表中查找文件名 = `{资产名}.md` 的文件
3. 找到 → 计算从当前 keyframe .md 文件到该资产 .md 的相对路径，写入 `## 引用资产` 区块为 `- [资产名](相对路径)`。**按首次出现顺序写入，去重**——同一资产在 composition 里出现多次只占一个引用条目。
4. 找不到 → 报错"资产 '{资产名}' 在 assets/ 中未找到对应 .md 文件，请检查 outline 资产清单"，跳过该 keyframe（不影响其他 keyframe），记录到失败列表
5. composition 中的 `<资产名>` 标签同时还要在「图像生成提示词」段以**裸名字**出现（按 prompt 翻译规则）。「图像生成提示词」段不写 markdown 链接也不写角括号

## 增量模式工作流

当 `$ARGUMENTS[1] == "incremental"` 时：

1. 解析 `$ARGUMENTS[2]` dirty 列表（空格分隔的 KF id）
2. 仅处理列表中的 KF id，其他保持原 .md 文件不动
3. 列表为空 → 输出"无需处理"并结束
4. 对列表中的每个 KF id：
   - 在 keyframes.json 中存在 → 重新生成 .md（覆写）
   - 在 keyframes.json 中不存在 → 该关键帧已被 director 删除，使用 Bash 删除 `assets/keyframes/{集数}/{id}.md`

## 全量模式工作流

当 `$ARGUMENTS[1] == "full"` 或缺省时：

1. 处理 keyframes.json 中所有 keyframes（已存在的 .md 文件覆写）
2. 清理孤儿 .md：使用 Glob 列出 `assets/keyframes/{集数}/*.md`，对每个文件，若其 KF-id 不在 keyframes.json 的 keyframes 数组中，则使用 Bash 删除该文件

## 摘要输出格式

```
## creator-keyframe-prompts 摘要

- 模式：{full|incremental}
- 处理：N 张
- 成功：N 张（写入 assets/keyframes/{集数}/）
- 删除：N 张（孤儿 .md 文件）
- 失败：N 张
  - {KF-id}：{失败原因}
```
