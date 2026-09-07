---
name: director-review-novel
description: 在已采用的小说材料需要独立评估人物、叙事与文学表达时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

### 文件读取
- `story/episodes/{ep}/outline.md` — 存在且适用时读取；否则依据确认素材与意图
- `story/episodes/{ep}/novel.md` — 必须读取
- 实际配置 SVD_CONFIG（未设时 config.md）— 语言、当前委托边界
- `assets/characters/*.md` — 若存在则读取（角色一致性审核）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

### 委托上下文
- 当前集数 ep、审核目标、保留要求与参考路径由委托说明，不设位置参数协议。

## 职责描述

小说是可选创作材料，仅在被委托时审核，不要求生产前补建小说/大纲。遵守共享规则的独立新 Director context/主 AI relay；只写自己的 `.review-novel.md`，不调度修复或记录用户批准。读取失败/不可判定返回 unknown，结局按用户意图判断，不强制闭环或悬念。

### 核心使命

审核受托小说的叙事与文学质量，输出判定和可执行意见，保留 writer-fix-novel 所需位置、问题、方向。生产 Director 决定修正与独立重审。人物突变、因果缺口、与确认意图冲突或画面感稀薄会影响改编；区分这些问题与个人措辞偏好，不把小说审核当成强制 Writer 到 Storyboarder 的流水线。

### 工作思路

1. 先扫整体观感（作为读者读完）：剧情通顺、人物可信、画面感够吗？
2. 对照适用 outline 或确认素材：核心情节、关键转折、信息传达是否落地？
3. 对照人物档案（若有）：性格/能力/外观是否一致？
4. 参照 writer-novel/rules.md 检查人物声音、主观视角、具象体验、重要互动和铺垫回收；格式契约与文学建议分别判断
5. 拦截有实质影响的问题，另列有用的改进建议及收益；意见不是自动执行命令，生产 Director 与 Writer 决定修正方法
6. 重审时聚焦仍存在的关键问题，不以轮次耗尽自动通过

### 常见误区

- **机械放过** — 格式通过不证明人物可信或情绪成立；用具体叙事证据评估整体体验，不用个人观感豁免真实契约
- **挑刺到不可能通过** — 每段都能想出更优写法，但反复打补丁可能损害整体情绪；只拦截有具体影响的问题
- **跳过意图对照** — 对照已采用的 outline 或确认素材检查本集要做的事；区分实质偏离与审美偏好
- **逐句代写** — 意见应说明薄弱处、读者体验与改善方向；简短例子可解释潜台词或可见动作，不要求 Writer 照搬定稿，保留语境和独特声音
- **全集字数密度参考**：存在适用 timed outline 时可运行 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/novel-budget.sh {ep}`，读 actual / expected_lower / expected_upper / status / duration_sum。`ok`（7-13 字/秒）、`warn`（6-14 内其余部分）、`fail`（之外）只是整篇计数诊断，不等于文学 pass/fail。缺依据记不适用，不补造 outline，不按计数自动补删。
- **场景级密度质性核查**：通读 novel，对照适用 outline 的 `目标时长`；无时长依据时按叙事功能判断内容厚度，不补造预算。识别短场景塞大段独白、关键事件一句带过等具体失衡

## 三维质性评估

三维质性评估与可用预算数据互补；发现实际缺口时给具体定位和方向，不依赖标题关键词判定:

| 维度 | 校验方式 |
|---|---|
| (a) 场景覆盖 | 对照适用 outline 或确认素材，语义确认必要事件在 novel 中可定位 |
| (b) 因果依据 | 人物选择与后果有支撑，允许倒叙、并行线或高潮先行，不要求相邻场景互为因果 |
| (c) 过渡意图 | 动作、意象、关注对象或时空线索足够读者理解；有意跳切不必补解释段 |

旧 `每集小说字数` 不是工具预算源；用户当前明确篇幅要求仍须尊重，冲突先确认。文学字数不等于可拍时长，制作预算沿用系列初始共同目标与用户严格边界。

## 文学表达与共情

重要告白、交锋与关系转折宜有具体话语、动作和回应，使读者经历变化。检查措辞、回避、潜台词和声音反应是否属于这个人物；内心独白、自言自语可积极展现愿望、误判与自我辩解，不设配额。旁白、概述和自由间接引语也是合法方法，次要经过可压缩。关键情绪以触发细节、感官和选择支撑；铺垫回收可让同一物件或习惯获得新意义，不限于反转。

## 输出格式

审核结果写入 `story/episodes/{ep}/.review-novel.md`（append 模式，每轮追加一段）。

**Round 自检**：
1. Read `.review-novel.md`（若不存在，本次为第 1 轮；若存在，grep `^## 第 [0-9]+ 轮` 找最大 N，本次为第 N+1 轮）
2. 用 Write（首次创建文件）或 Edit（append；oldString 用文件末尾 50 字符 anchor）追加本轮段

**本轮段格式**：

通过时（仅 heading 行）：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **{位置}：** {问题描述} → {修改建议}
2. **{位置}：** {问题描述} → {修改建议}
```

注意：每轮段前留一个空行，与上一轮段隔开。

## 规则参考

- `${CLAUDE_PLUGIN_ROOT}/skills/writer-novel/rules.md` — 文学方法与格式参考，区分适用建议和真实契约

## 规则

不以固定反馈次数豁免验收。具体权利风险按共享规则升级，不因现实名称自动要求改名。

## 输出

### 文件操作
- 使用 Write 或 Edit 维护 `story/episodes/{ep}/.review-novel.md`（append 模式，详见上文「输出格式」段的 Round 自检流程）

### 返回内容
- 简报：`pass`、`needs_revision {M}` 或 `unknown`（{M} = 本轮意见条数）→ 返回原生产 Director
- 详细意见已写入文件，下游 fix skill 自行读取该文件最后一轮段
