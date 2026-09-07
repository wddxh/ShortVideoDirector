---
name: director-review-storyboard-sheet-prompts
description: Use when episode storyboard-sheet cards need a quality gate before sheet image generation or after targeted revisions.
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

# Review Storyboard Sheet Prompts

## 输入

- 委托中的 ep、审核 outcome 与可选完整 card paths；没有显式范围时核对当前所需 cards 的证据。
- 读取当前 `story/episodes/{ep}/storyboard.md`、实际配置（SVD_CONFIG 或 config.md）、范围内 cards，以及 `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`。用下述转换器取得与生成相同的完整 prompt、images、settings、sourcePath，再按 images 定位直接参考卡；不独立猜测引用集合。材料身份与适用性须核对，但这些数据依赖不规定前置 skill 调用链。
- 维护 `story/episodes/{ep}/.review-storyboard-sheet-prompts.md`；不得修改 card、storyboard、资产或图片。
- 必读共享 review-meta-rules/output-language，在独立新 Director context 执行。kind=`sheet-prompt`，target=canonical card path；本轮先声明 scope，实际阅读前/完成后 fingerprint 全部查阅的项目输入，补齐每目标一个 result 后关闭轮次。

## Round 控制

1. 依据当前材料与证据确定本轮目标；开工声明后读取范围内 cards 与必要参考，不用历史总结替代当前输入。
2. 列举本集 card 路径核对 shot/card 一对一集合；这是结构检查，不因此阅读全部卡片内容。范围外结构问题作为额外 findings 回报 Director，不扩大本轮内容验收 scope。
3. 未给 scope 时核对全部当前所需 cards 的最新证据，只审缺失、过时、未通过项；显式完整 card paths 只审该 scope，必须属于当前 ep。缺卡仍保留该 target 为 unknown。
4. review 文件不存在时为第 1 轮；存在时按最大标题 N append N+1，保留未完成旧轮，不回退旧 pass。
5. 按完整 card path 去重写 dirty list；本轮无问题且输入未变才 pass，有问题 needs_revision；缺卡、读取失败或不可判定 unknown，保留所请求路径。

第 1 轮使用 Write。后续使用 Edit，已完成旧轮可用唯一 footer 作 anchor；未完成旧轮保留并按共享规则追加新标题。本轮开始先声明 scope，结束更新同一证据块。每个完成轮末尾必须写：

```markdown
---
<!-- /round-{N} -->
```

写后 Read 自检当前 footer 恰好一次，才可返回状态。

## 审核清单

方位按 card rules 引用的通用原则 6 核对各 PANEL 内部画面，不把整板格位当场景坐标。有依据的反打／运镜投影变化可成立；关键位置缺依据时说明影响并按源 shot 或 Panel 的实际根因归 owner，不要求卡片编造方位或固定跨角度左右。

以下是结构与专业判断维度，不规定审核思考顺序：

按共享单次请求边界审核转换后的完整源 shot + 完整 Panel 规划 + 整板要求，而非只看 `图像生成提示`。源 shot 是叙事权威，Panel 选择相容的静态 beats；整板 section 仅管格式、阅读顺序、比例、风格与 labels，不再写有损剧情摘要。完整对白、旁白、声音用于理解表情和姿态，不自动画成字幕、不逐句配格、不因文本密度要求加格。Panel 的具体目标须完整保留。

裸名字在全局绑定下合法；按 images 核对声明及必要参考卡，不要求未来 PNG 已生成。缺声明/卡或无法解析不能靠摘要、删引用或在脑中补剧本解决。非资产对象可按已有设计描述可见特征。previous 仅提供声明属性，当前 Panel 的姿态与空间仍须明确；其他镜头未进入请求的内容不当模型上下文。

- storyboard 每个 shot 恰有一张同号 card，无缺失、重复或 orphan；H1、ep、对应分镜、时长、类型和 `Panel 数量` 严格符合 card schema。
- PANEL 编号连续；时间从 0s 起、升序、相接并完整覆盖时长。以关键动作结果、反应与空间信息选择静态瞬间；cut 两侧的不同信息应覆盖，机位/景别/运动变化是候选依据，不要求每次变化都新增格。格数结合辨识度与画布容量，不设统一数量。
- 每格景别、机位、摄影机、画面和连续性可拍、相互协调，进入/离开状态无跳变。
- 引用为源 header + sheet 补充并集；源正文 links 须由源 header 声明，不能由 sheet 补漏。Card 相对 links 和源根相对 links 归同一 slot，裸名字无需正则替换；不手写 `{图片N}`，不要求 card 重复全源声明。
- previous 仅相邻且确有声明的连续元素；无 previous 必须为 `无`；组合请求限定不复制前板网格、panel、构图、机位。
- 整板按本卡已解析图片比例组织网格，左→右上→下、一致窄格缝；panel 内保持独立的项目视频比例，必要时留边而非裁掉主体。风格按实际配置，可彩色或授权黑白；短英文 label 含编号、时间码、景别、机位、运动五项，满足安全 Markdown 子集。

只拦截会造成内容漏拍、连续性错误、资产/转换失败、布局含混或高重复的具体问题。

`## 基本信息` 四项 `已解析图像提供方/已解析图像模型版本/已解析图片比例/已解析图片分辨率` 应各出现一次且为真实非空、非 none 值。当前 parser 支持 provider=dreamina、正整数宽:高；模型与分辨率非空不等于组合受支持，须核对当前能力和授权。不能把空值或 auto 当授权，也不能把示例 16:9/2k 当默认。

在项目根运行 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-sheet-to-prompt.sh" --json "{card}"`，返回 images、prompt、settings（provider/model/ratio/resolution）、sourcePath。解析不要求当前/参考 PNG 存在，也不证明 Panel 时间、可读性或艺术质量全合格；实际图片就绪由生成 runner 检查。`check-storyboard-sheets.mjs EP` 会读全体卡并检查图片集合，不适合作为局部或尚未生图的提示审核前置门禁。

旧卡冗余提示仍由转换器保留，不自动重写或视作迁移成功；审核具体冲突、遗漏和生产影响，不仅因重复文字宣判艺术失败。缺唯一非空 `Panel 规划` 或实际源 shot 的旧卡无法按当前契约解析，记录 unknown 与定位，交生产 Director 协调授权修卡/上游修正，不自行补副本或修改用户项目。

检查摄影机指令与静态关键画面是否协调：光线帮助读懂形体、视线和动作落点；动作过程通过有信息差的起落状态表达，不在一格堆多个时间阶段。源 shot 的旁白/内心声合法，panel 选其可见反应，不把声音强制渲染成剧情字幕。

## 意见与 owner

每项意见必须定位到 `shotNN/PANEL NN` 或 `shotNN/整板`，并有且仅有一个 owner：

合法枚举严格为 `owner=generator|prompt-fix|upstream-storyboard`，实际每项只写其中一个完整值。

- `owner=generator`：卡片结构、metadata、时间拆分、Panel 数量、资产链接等需要重新生成的确定性问题。
- `owner=prompt-fix`：结构和源信息正确，仅 Panel 描述、连续性表达或图像生成提示需要定向改善。
- `owner=upstream-storyboard`：源 storyboard 缺失、冲突、编号/时长错误或缺资产；不得要求 card 层编造。

不得把同一意见拆给多个 owner。意见说明 observed、expected 和最小修复方向，不直接重写整张卡。

## Orchestrator Handoff

需修改轮保留 `### orchestrator handoff` 作为 findings 工作单，不是执行顺序。列出 sheet review path、每类完整 card paths 和最小建议；空列表写 `none`。若建议重建，集合/编号问题标 `full`，现存卡内容问题标 `incremental`，由生产 Director 判断实际修正范围。

owner 是建议责任归属，reviewer 不调用 generator/fixer、不写 `.review-storyboard.md`、不强制后续顺序。跨 owner 的 observed/expected/direction 连同原 review path 回传生产 Director，由其协调并委托独立重审。

## 输出格式

以下是保留给 fixer 消费的 Markdown 外形。每个完成轮在 footer 前必须含共享规则的 `<!-- svd-review-evidence -->` JSON，顶层 version/kind/scope/results；通过轮也不能省略。无法判定写 `### 无法判定` 和路径原因，不冒充通过。

通过轮：

```markdown
## 第 {N} 轮 ({timestamp}) - 通过

---
<!-- /round-{N} -->
```

需修改轮：

```markdown
## 第 {N} 轮 ({timestamp}) - 需修改 ({M} shots)

### dirty list
- assets/storyboard-sheets/{ep}/shot03.md
- assets/storyboard-sheets/{ep}/shot08.md
- assets/storyboard-sheets/{ep}/shot09.md
- assets/storyboard-sheets/{ep}/shot10.md

### 意见列表
- location: shot03/整板
  owner=generator
  observed: metadata 与源 shot 不一致
  expected: 严格匹配 card schema
  direction: 重新生成该 card
- location: shot08/整板
  owner=generator
  observed: Panel 时间未完整覆盖
  expected: 连续覆盖 shot 时长
  direction: 重新拆分并生成该 card
- location: shot09/整板
  owner=upstream-storyboard
  observed: storyboard 缺少所引用资产
  expected: 上游补全资产声明
  direction: 建议补足源 storyboard 的资产依据，卡片层不编造
- location: shot10/PANEL 02
  owner=prompt-fix
  observed: 动作结束状态不明确
  expected: 说明手和道具最终位置
  direction: 在 PANEL 02 画面和连续性中补足可见落点

### orchestrator handoff
- review path: story/episodes/{ep}/.review-storyboard-sheet-prompts.md
- upstream-storyboard: assets/storyboard-sheets/{ep}/shot09.md
- generator mode: incremental
- generator cards: assets/storyboard-sheets/{ep}/shot03.md, assets/storyboard-sheets/{ep}/shot08.md, assets/storyboard-sheets/{ep}/shot09.md
- prompt-fix: assets/storyboard-sheets/{ep}/shot10.md
- final: 由生产 Director 协调修正与独立重审

---
<!-- /round-{N} -->
```

dirty list 每行必须是 `assets/storyboard-sheets/{ep}/shotNN.md` 完整 card path；禁止只写 `shotNN`。`M` 是本轮 dirty card path 去重数，不是意见条数。落盘并自检后返回 `pass`、`needs_revision {M}`、`unknown {K}` 或 `needs_revision {M} {K}_unknown`。

`needs_revision {M}` 后的返回简报复述该 handoff。
