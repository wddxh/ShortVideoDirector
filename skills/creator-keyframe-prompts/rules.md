## 输出格式（每个唯一 KF-id 的 .md 文件）

文件路径：`assets/keyframes/{集数}/{KF-id}.md`（如 `assets/keyframes/ep01/KF-EP01-001.md`）

```markdown
# {KF-id}

## 基本信息
- 所属集数：{集数}
- 类型：关键帧
- 首次出现：shot {N}（{首帧|尾帧|参考}）
- 剧情功能：{从 storyboard 上下文推断的简短功能描述}

## 引用资产
- [{资产名1}]({资产 .md 相对路径1})
- [{资产名2}]({资产 .md 相对路径2})
- ...

## 视觉描述
{composition：从 shot prose 中 KF 标记附近的画面叙述摘录，保留 asset 名（不带 markdown 链接）}

镜头：{shot_size}，{camera_position}
光线：{lighting_tone，从 prose 推断；无法推断则留空}
情绪：{emotion，从临场表演描述推断；无法推断则留空}
动作：{action，从 prose 中动作动词提取}

## 图像生成提示
{融合后的 prompt：纯自然语言，asset 名以裸名字出现，不带 markdown 链接、不带角括号}
```

## prompt 翻译规则

prompt 必须按以下顺序拼接（用空格或合适标点分隔，不要换行）：

1. **镜头语言段**：`{shot_size}，{camera_position}`
2. **画面段**：composition 内容（asset 名以裸名字出现）
3. **光线段**：`光线：{lighting_tone}` 或自然融入画面段
4. **动作段**：`{action}` 或自然融入画面段
5. **风格 suffix**：从 config.md 读取"视频风格"，追加到末尾

完整 prompt 示例：
> 中景，侧面齐胸平视。雨中天台夜景，张三站在栏杆前侧脸朝向镜头，右手举着黑色翻盖手机贴近耳侧。冷蓝雨夜，3D写实风格。

引用关系**完全由 `## 引用资产` 区块声明**，prompt 正文不出现 markdown 链接或角括号。下游 `scripts/keyframe-to-prompt.sh` 只扫 `## 引用资产` 区块拿参考图列表。

## 字段约束

- **prompt 语言** — 见 `$SVD_PLUGIN_DIR/skills/_meta/rules/output-language.md`（规约所有产出文本含 prompt 字段的语言）
- **`## 引用资产` 区块** — 列出 storyboard shot 字段「出场人物」+「引用资产」中所有非 KF asset，按出现顺序、去重
- **prompt 正文格式** — 纯自然语言，asset 名以裸名字出现
- **不出现具体文字数字** — 招牌、屏幕、车牌等具体文字数字不写进 prompt
- **不写不可感知信息** — 气味、温度、触感、味道不写
- **不写运镜过程** — 推/拉/摇/移不写（关键帧是静态）
- **风格 suffix 必加** — 每条 prompt 末尾必须包含 config 视频风格描述

## 解析流程详解

### 步骤 A：调用 parse-storyboard-kf.sh

```
bash scripts/parse-storyboard-kf.sh story/episodes/{集数}/storyboard.md
```

输出每行 TSV `KF-id<TAB>position<TAB>shot_number`，position ∈ {首帧, 尾帧, 参考}。

**退出码处理**：
- `0` + 非空输出 → 进入步骤 B
- `0` + 空输出 → 本集无 KF 引用，输出"无需生成"并结束
- `1` → 文件不存在 / 参数错 → 报错终止
- `2` → 解析失败（KF 缺位置语义）→ 报错"storyboard 含 KF 引用但缺位置语义标记（必须用 `画面首帧是 [KF-id]` / `画面尾帧是 [KF-id]` / `画面参考 [KF-id]`）。请通知 storyboarder-fix-storyboard 修复。"，终止处理，**不静默跳过**

### 步骤 B：去重 + 按首次 shot 提取上下文

去重保留每个 KF-id 的**最小 shot_number**作为"首次出现 shot"。Read storyboard.md，定位到该 shot 块（从 `### shot N` 到下一个 `### shot` 或 `## 场景` 之前），抽取以下字段：

- 镜头类型 → `shot_size`
- 镜头运动 → `camera_position`（如"固定"→"主体居中"，"推"→"主体居中拉近"，etc.）
- 出场人物（角色名）→ `characters` 数组
- 引用资产（location / item，过滤掉 KF 自身条目）→ `scene` / `props`
- 画面与声音描述 prose 中 KF 标记**所在段落**（同一 `[Xs-Ys]` 时间块）→ `composition` + `action` + `emotion`

## 资产引用解析规则

1. 收集本 shot「出场人物」字段角色名 + 「引用资产」字段中非 KF 链接
2. 在 Glob 出的 `assets/**/*.md` 列表中查找文件名 = `{资产名}.md`
3. 找到 → 计算从当前 keyframe .md 文件到该 asset .md 的相对路径（示例：`assets/keyframes/ep01/KF-EP01-001.md` 引用 `assets/characters/张三.md` → 相对路径 `../../characters/张三.md`），写入 `## 引用资产` 区块
4. 找不到 → 报错"资产 '{资产名}' 未找到，请检查 outline 资产清单"，跳过该 keyframe，记录失败列表
5. 「图像生成提示」段以**裸名字**出现，不写 markdown 链接也不写角括号

## 增量模式工作流

当 `$ARGUMENTS[1] == "incremental"` 时：

1. 解析 `$ARGUMENTS[2]` dirty 列表（空格分隔的 KF id）
2. 仅处理列表中的 KF id，其他 .md 不动
3. 列表为空 → 输出"无需处理"并结束
4. 对列表中的每个 KF id：
   - 在 parse 输出中存在 → 重新生成 .md（覆写）
   - 在 parse 输出中不存在 → 该关键帧已被 storyboarder 删除，使用 Bash 删除 `assets/keyframes/{集数}/{id}.md`

## 全量模式工作流

当 `$ARGUMENTS[1] == "full"` 或缺省时：

1. 处理 parse 输出中所有唯一 KF-id（已存在的 .md 覆写）
2. 清理孤儿 .md：使用 Glob 列出 `assets/keyframes/{集数}/*.md`，对每个文件，若其 KF-id 不在 parse 输出中，则使用 Bash 删除该文件

## 失败模式（禁止清单）

1. **漏标 KF**：storyboard 含 `[KF-id]` 但 parse 输出却缺该 id（说明 parse 脚本 bug 或位置语义标记错位）→ 必须排查不得跳过
2. **KF 字段缺失**：shot 缺镜头类型 / 出场人物等 → 智能填充能填的，留空填不了的，但不得伪造（不要无中生有"光线：温暖暖色"）
3. **解析失败静默跳过**：parse-storyboard-kf.sh exit≠0 时继续生成"能生成的部分"→ 错。必须报错终止，由调用方决定是否修 storyboard 后重试
4. **位置语义信息丢失**：「基本信息」中必须记录"首次出现：shot N（{首帧|尾帧|参考}）"，方便下游 dreamina 提交时回查
5. **prompt 正文写 markdown 链接** / **`## 引用资产` 区块漏写或顺序乱** — 同字段约束
6. **跨集风格漂移**：依赖 asset .md 卡保证一致；本 skill 不得"参考上一集 KF 的画面"等越权

## 摘要输出格式

```
## creator-keyframe-prompts 摘要

- 模式：{full|incremental}
- 解析：{N} 个 KF-id 引用 ({M} 个唯一)
- 成功：N 张（写入 assets/keyframes/{集数}/）
- 删除：N 张（孤儿 .md 文件）
- 失败：N 张
  - {KF-id}：{失败原因}
```
