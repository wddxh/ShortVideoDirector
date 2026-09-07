# 输出语言一致性规则（共享）

本文件被所有产出文本的 skill 必读引用。规约所有产出文本（含 narrative / review 意见 / asset id / **prompt 字段**）的语言一致性。

## 核心规则

1. **自然语言产出遵循实际配置 SVD_CONFIG（未设时 config.md）的 `语言` 设置**；配置缺失或冲突需澄清，不换用其他配置猜测。
2. **auto 时跟随用户输入语言**，已有确认沿用；正文保持一致，原文引用、人物特有说法或用户明确的多语言表达可保留。
3. **跨语言技术名词**（如 `MP4` / `H.264` / `PANEL 05` / `MEDIUM SHOT` 等）可保留英文标识，不视为混语言
4. **数据身份不翻译**：现有资产 id、路径、schema 字段、状态枚举及完整短英文 panel 标签保持协议原值。新名称依项目语言；语言检查不是批量改名或改写合法素材的授权。

## 反例 + 正例

| # | 场景 | 反例（错误）| 正例（改写后）|
|---|---|---|---|
| 1 | config=zh，review 意见混英文 | `This dialogue feels too cheesy, 应改为更内敛的表达` | `这段对白略显刻意，应改为更内敛的表达` |
| 2 | config=zh，新建资产无依据转写 | 把新角色 `沈昭` 写成 `Shen_Zhao` | 使用 `沈昭`；若已有 id 为 `Shen_Zhao` 则保留既有路径 |
| 3 | config=zh，prompt 字段中英混用 | `A young woman with black hair, 微笑, neon-lit street` | `一位黑色长发的年轻女性，微笑，霓虹灯光照亮的街道` |

## 适用范围

- ✅ Narrative 文本（novel / script / outline / arc）
- ✅ Review 意见（所有 `*-review-*` skill 的输出）
- ✅ 新 Asset id / 文件名；既有身份与引用保持稳定
- ✅ Prompt 字段（含 character/location/item/building/storyboard sheet / storyboard shot prose）
- ❌ 不适用：跨语言技术名词（保留英文）

## 与其他共享规则的关系

- `visual-prompt-craft-common.md` / `visual-prompt-craft-video.md`：提供摄影表达、可见状态等 prompt 技巧，本文件管语言；目标状态措辞是推荐，不是审核意见通用否定词禁令
- `review-meta-rules.md`：review 意见格式专属规约，含语言条款引用本文件
