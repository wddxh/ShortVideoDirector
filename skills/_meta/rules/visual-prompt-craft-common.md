# 视觉 Prompt 创作通用规则（共享）

本文件被所有写视觉 prompt 的 skill（creator-create-assets / creator-fix-asset / creator-keyframe-prompts / creator-fix-asset-image / storyboarder-storyboard）必读引用。规约所有视觉 prompt（图像 + 视频共通部分）的核心表达原则。

**重要前提**："prompt 能写的就假定模型能做到"——本文件聚焦"如何精确表达"，不聚焦"模型做不到什么"。Seedance 2.0 / Veo 3 / LTX-2 等新模型能力快速演化，避免硬编码"当前能力上限"。**半年内复审本文件以避免规则陈旧**。

## 5 条核心原则

### 原则 1 — 写电影摄影指令而非小说叙事

每条描述必须可执行（具体动作 / 镜头位置 / 时长 / 颜色 / 字号 / 角度等）。

| 反例（文学叙事）| 正例（电影摄影指令）|
|---|---|
| `半张脸藏在散落发丝里，眼尾上挑的那一点锋利清清楚楚` | `MEDIUM CLOSE-UP，3/4 侧脸，黑色长发覆盖左半张脸到颧骨，右眼可见，眼尾自然上扬约 15°` |

### 原则 2 — Positive-only（不出现想避免的对象 token）

**机制原理**：diffusion 模型不解析否定词，"严禁 X"/"不要 X"/"无 X" 中的 X token 在 cross-attention 中被当 positive 处理，反向激活目标。

| 反例（negative phrasing）| 正例（positive 具象描述）|
|---|---|
| `严禁正面立体大宝剑浮雕/金柄红刃宝剑图案/可辨汉字或符文字形/红色符文带`（"宝剑"/"汉字"/"符文" token 全部被反向激活，导致图里出现这些元素）| `晶壳为不透明实心古玄铁，表面仅有发丝级随机走向细密刻痕（无方向性，不构成任何具象轮廓）；内部金红色流光从晶壳表面数道随机分布的细缝中向外透出微弱光线，光源完全位于晶壳内部` |

**改写法则**：
- "不要 X" → 不提 X，描述真实想要的对象
- "no X" → 替换为正面对应词（"clean surface" 代替 "no text"）
- 想避免某具象（如剑形）→ prompt 完全不提该对象的任何 token

### 原则 3 — 显式分解复杂效果

层级 / 位置 / 内容 / 颜色 / 字号 / 边框等参数具体指定，不留模糊空间。

| 反例（参数模糊）| 正例（参数具体）|
|---|---|
| `画面下方四个金字："古法异常体·沈"` | `画面下沿叠加金色繁体中文字幕："古法异常体·沈"，字号占屏宽 70%，正中对齐，字体宋体加粗` |

> **数量节制**：每张画面尽量 1 处可读文字。多处文字相互干扰，容易出现错字、字形扭曲、位置错乱。密集招牌街景属例外（按场景需要）但每处仍需单独描写参数。

### 原则 4 — 比喻与心理转译为可见画面

模型只能渲染可见的东西。所有文学修辞（"X 形隐喻 / X 的暗影 / X 的呼吸感"）和心理描写必须转译为具体视觉/动作。

| 反例（文学比喻 / 心理描写）| 正例（可见画面 / 动作转译）|
|---|---|
| `剑芒沿她剪影向上撕开像她影子长出一双火翼`（"火翼"被当具象渲染）| `金红色火焰光柱从女性剪影背后向上喷出，两侧对称形似翅膀，火焰高度为剪影身高 2 倍` |
| `怕自己被那道红光记住`（心理动机）| `群演手腕反向翻转，掌心从向上翻为向下，0.5 秒内完成，掌心覆盖悬浮光屏` |

**禁用修辞清单**：
- "像 X 一样" / "X 形隐喻" / "X 的暗示" / "X 的呼吸感" / "X 的灵气"
- "他害怕 X" / "她想起了 X" / "感到 X"（心理状态必须转可见动作 / 表情）

### 原则 5 — 资产引用：分场景使用，避免重复描述外观

| 场景 | 自包容程度 | 引用机制 | 应该写 | 不要写 |
|---|---|---|---|---|
| 基础角色 / 物品 / 场景 / 建筑 prompt | 完全自包容 | 不引用其他 asset | 详尽具象描述外观（细到五官 / 服装 / 比例 / 颜色 / 材质 / 光影），保证 text2image 稳定生成 | 引用其他 asset（基础 asset 不能依赖别的卡）|
| 造型变体 prompt | 重述基础外貌 + 造型差异 | `## 基本信息` 中 `基础角色: [{角色名}](...)` 字段单向引用，参考图自动 = 基础角色 .png | **基础外貌特征**（保持与基础角色一致）+ 造型变化的具体描述（如外卖工作服款式 / 颜色 / 配饰）| 仅描述差异（image2image 仍需 prompt 重述基础特征以维持稳定）|
| keyframe prompt | 引用多 asset，正文不重复外观 | `## 引用资产` 区块 markdown 链接 | 正文用**裸名字**（如「张三站在街口」）；引用关系在区块声明 | 在正文重复描述被引用 asset 外观；自己写 `{图片N}` 占位符（脚本自动）|
| storyboard shot prose | 引用多 asset，prose 不重复外观 | 「出场人物」/「引用资产」字段 markdown 链接独立声明 + prose 裸名字 + 位置标记 | prose 用**裸名字** + 位置标记（`画面首帧是 [KF-X]` / `画面尾帧是 [KF-X]` / `画面参考 [KF-X]`）| 在 prose 重复描述被引用 asset 外观；自己写 `{图片N}` 占位符 |

**关键 anti-pattern**：
1. **基础 asset 引用其他基础 asset** — ❌ 基础角色 prompt 引用某个 location 卡（基础 asset 必须自包容；造型变体是唯一例外）
2. **造型变体只写差异不写基础特征** — ❌ "外卖工作服" 一句话；✅ 重述基础角色五官/发型/体型 + "外卖工作服款式"
3. **keyframe / storyboard 正文重复描述外观** — ❌ "张三，黑色长发，杏眼，165cm，3/4 侧脸" + 引用 张三.md；✅ "张三 3/4 侧脸，凝视镜头" + 引用 张三.md
4. **LLM 手写 `{图片N}` 占位符** — ❌ 自己在 prompt 写 `[{图片1}]` 或 `[张三:{图片1}]`；✅ 用 markdown 链接 `[张三](assets/characters/张三.md)`，让脚本自动转换

## 转换链路全图（脚本自动处理 `{图片N}` 占位符）

```
[基础 asset .md `## 图像生成提示`]
  → image-gen-dreamina.sh (text2image, 第 6 参数为空)
  → assets/images/{type}/{name}.png

[造型变体 .md `## 图像生成提示`] + [基础角色 .png]
  → image-gen-dreamina.sh (image2image, 第 6 参数=基础角色 png)
  → assets/images/characters/{name}-{variant}.png

[keyframe .md `## 引用资产` + `## 图像生成提示词`]
  → keyframe-to-prompt.sh: 解析引用 → IMAGES:p1,p2,... + 头部 [name:{图片N}] tokens
  → image-gen-dreamina.sh (image2image, 第 6 参数=IMAGES 逗号串)
  → assets/images/keyframes/{ep}/{KF-id}.png

[storyboard.md shot N]
  → storyboard-to-prompt.sh: 解析字段 + 替换 markdown 链接 → IMAGES + prompt 含 [name:{图片N}] / [{图片N}] tokens + DURATION
  → tasks.json (prompt + images + duration)
  → creator-video-dreamina + video-gen-dreamina.sh (multimodal2video, 按位置语义重排 --image)
  → submit_id → check-video 轮询下载 → mp4
```

**LLM 关键认知**：你**不需要**手写 `{图片N}` 占位符。上游脚本会自动处理。你只需用 markdown 链接（如 `[张三](assets/characters/张三.md)`）做引用声明，prose / 正文中用裸名字（如「张三」）。

## 适用边界

- ✅ 图像生成 prompt（asset .md 卡 `## 图像生成提示` 段 / keyframe `## 图像生成提示词` 段）
- ✅ 视频生成 prompt（storyboard shot prose）
- ✅ 视觉 review skill 的"prompt 表达"审核维度
- ❌ 不直接适用：narrative 文本（novel / script / outline / arc）

## 与其他共享规则的关系

- `output-language.md`：管 prompt 字段**语言**，本文件管 prompt **内部表达技巧**
- `visual-prompt-craft-video.md`：本文件覆盖图像 + 视频通用部分；视频独有规则（事件密度 / 镜头运动 / 转场 / 音视频）见 -video.md
- `review-meta-rules.md`：visual prompt review skill 出意见时引用本文件给改进方向
