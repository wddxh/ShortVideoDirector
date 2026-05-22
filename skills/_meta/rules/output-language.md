# 输出语言一致性规则（共享）

本文件被所有产出文本的 skill 必读引用。规约所有产出文本（含 narrative / review 意见 / asset id / **prompt 字段**）的语言一致性。

## 核心规则

1. **所有产出文本的语言 = `config.md` 中的 `语言` 设置**
2. **auto 时跟随输入语言**（用户首次输入的语言决定）；**同一产物内不混语言**
3. **跨语言技术名词**（如 `MP4` / `H.264` / `KF-EP01-005` / `MEDIUM SHOT` 等）可保留英文标识，不视为混语言

## 反例 + 正例

| # | 场景 | 反例（错误）| 正例（改写后）|
|---|---|---|---|
| 1 | config=zh，review 意见混英文 | `This dialogue feels too cheesy, 应改为更内敛的表达` | `这段对白略显刻意，应改为更内敛的表达` |
| 2 | config=zh，asset id 英文化 | `char-沈昭` 或 `Shen_Zhao` | `沈昭` |
| 3 | config=zh，prompt 字段中英混用 | `A young woman with black hair, 微笑, neon-lit street` | `一位黑色长发的年轻女性，微笑，霓虹灯光照亮的街道` |

## 适用范围

- ✅ Narrative 文本（novel / script / outline / arc）
- ✅ Review 意见（所有 `*-review-*` skill 的输出）
- ✅ Asset id / 文件名
- ✅ Prompt 字段（asset .md 卡 `## 图像生成提示` 段，含 character/location/item/building/keyframe 全部类型 / storyboard shot prose）
- ❌ 不适用：跨语言技术名词（保留英文）

## 与其他共享规则的关系

- `visual-prompt-craft-common.md` / `visual-prompt-craft-video.md`：管 prompt **内部表达技巧**（电影摄影指令式 / positive-only 等），本文件管 prompt **语言**
- `review-meta-rules.md`：review 意见格式专属规约，含语言条款引用本文件
