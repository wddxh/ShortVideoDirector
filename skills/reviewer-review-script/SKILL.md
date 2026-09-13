---
name: reviewer-review-script
description: 在单集 script.md 需要独立评估叙事、可拍性、视觉节点和资产清单时使用。
user-invocable: false
agent: reviewer
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
---

## 输入
委托说明集数 ep、短篇/新系列/续集语境、当前目标、保留要求与参考路径；mode 是语境，不是函数入参协议。

## 必读文件
- `story/episodes/{ep}/script.md` — 必读 (review 目标)
- `story/episodes/{ep}/outline.md` — 存在且适用于当前委托时对照；用户素材与已确认意图也可作为依据
- 实际配置 `SVD_CONFIG`（未设时 `config.md`）— 必读（用户每集时长目标及确认边界）
- `assets/characters/*.md`, `assets/locations/*.md`, `assets/items/*.md`, `assets/buildings/*.md` — Glob 列出 (asset 引用核对)
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/rules.md` — 剧本 schema、时长契约与表演表达指南
- [对白 craft](../scriptwriter-script/dialogue-craft.md) 与 [视听 craft](../_meta/rules/audiovisual-craft.md) — 人物语言、观众证据、声音空间及声画关系的语义判断依据
- `${CLAUDE_PLUGIN_ROOT}/skills/reviewer-review-script/series.md` (when mode in {new-series, continue-series}) — 必读
- `${CLAUDE_PLUGIN_ROOT}/skills/reviewer-review-script/short.md` (when mode=short) — 必读
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/review-meta-rules.md` — 必须读取（review 意见格式规约）

## 接管说明
本 skill 同时承担叙事审核职责。script 是叙事骨架；storyboard 和逐镜输入包各自接受独立审核。

按共享规则在独立新 Reviewer context 审核，kind=`script`，target=`story/episodes/{ep}/script.md`。指定临时目录先存在，在读取 script/config 前以显式 SVD_CONFIG 运行 `review-round.mjs start script EP TARGET STATE [EXTRA_INPUT...]`；新语义参考在首次读取前 `add-input STATE PATH...`。不预跑依赖后续图片的全生产 readiness。

## 审核维度

### 适用指南
按委托选用 series.md 或 short.md，区分已有事实、已确认意图与可选素材；下面分组是检查维度，不规定思考方法或强制 skill 链。

### 当前材料与预算
- 以下数值时长检查依 scriptwriter-script/rules.md 的适用边界执行。用户已明确不限时长/不设上限时保留原决定、核对实际合计及其余限制，并报告 helper 不适用，不把工具无法表达误判为缺授权或伪报 PASS。
- Read script.md、实际配置与相关已存在的 outline/用户素材
- Glob assets/ 建立已注册 asset 集合
- 按 mode 文件指引读相关已存在的上下文 (series 可参考 arc / 上集 script)
- 按 scriptwriter-script/rules.md 从实际配置取目标与确认边界、换算秒数并实跑 scene-duration.sh：已确认 ±10% 的单值用 `--target N`；显式范围/更严格限制用 `--target-min M --target-max X`（精确值 M=X），不得扩大范围。记录真实 sum、边界、退出状态，不只接受作者自述。系列核对初始共同目标，不以前集实际时长重设预算；目标缺失/冲突报告待澄清，超界交生产 Director 协调修订或询问用户，不以节奏审美豁免。

### 剧本判断

先按全篇观看顺序分别判断事件链与观众理解链。必要身份、关系、处境、欲望、利害及世界规则是否在所依赖的行动/情绪之前可理解？指出背景缺失、动机不足、因果跳步或信息过晚的具体位置与后果；不把设定文件中的知识当观众已知，也不要求所有信息首场讲完。

有意谜团可延迟原因或身份，只要当前经验能跟随、问题有意义、后续揭示或开放落点有支撑。线索出现、人物注意到、理解其含义和据此选择是不同判断；剧本须给足必要联系，不以“看懂了”或事后补设定兜底。审核关注真实缺口，不要求逐步解释推理、把说明都变成屏幕，或禁止直接讲解。

1. **节奏分布合理性**
   - `scene-duration.sh` 输出: PASS / FAIL 状态 + sum 秒数
   - 节奏曲线: 按场景目标与表演看压力、策略、认知和情绪的变化，持续冲突或静观都可成立
   - 检查动作、对白与反应是否有空间，重复是否挤掉关键表达；长短场景不是独立失败标准
   - 分配是否来自实际叙事容量与完整场景的估时，是否因早期秒数/均分而压掉理解过程或填入无作用内容；粗剧情、暂定场景、完整台词动作、专家估时及按需预演的精度不同，不以初始估计未精确判失败。显式范围、精确值或不设上限按公共 rules 的适用边界判断。
   - 一场景只挂一个节奏角色 (公共规则呼应)

2. **视觉节点覆盖**
   - 剧本每个场景的"视觉摘要"字段是否覆盖该场景的关键视觉点 (构图焦点 / 道具 / 对比 / 符号)
   - 视觉摘要不能写成"一个紧张的场景"等抽象描述——必须给具体可拍画面
   - 用户确认的核心事件及适用 outline 事件是否落实为可拍场景；已授权改编不要求逐字照搬，遗失关键因果/情绪落点才打回

3. **asset 列表完整性 (双向核对)**
   - 用 `episode-assets.mjs "story/episodes/{ep}/script.md" all` 解析 script 的 `## 本集资产清单`，含新增和已有两小节；script 是唯一 inventory 来源，不回退 outline
   - 从正文场景提取四类资产，与清单双向核对，不能用清单自身证明出场；遗漏和冗余都给具体路径。新增卡尚未创建不是早期 script review 失败，已有引用须核对实际材料
   - **资产引用路径**：与 scriptwriter-script/rules.md 一致，角色、地点及需独立视觉身份的道具/建筑在场景元数据或正文首次使用处写 `<名称> (assets/<type>/<名称>.md)`。后续同名提及可省路径；不能因对白或重复提及未带路径打回。真正未标识的出镜资产仍须定位并补齐，清单不能替代正文核对
   - 列出所有 dangling 引用 + 冗余声明

4. **表演与观众体验**：按完整交流判断倾听、回应、语言选择及关系是否成立，不要求每句推进事件。重要情绪核对触发、对人物的个人意义、回应和后果，不要求输出固定四栏。词汇、句法、称呼和比喻有生活及关系依据，音色差异不能代替语言个性，机器人身份不自动等于冷淡。必要信息可直接讲解，主题可在有个人利害的论述中表达。内心声、自语、旁白、画外对话或字幕按作用使用，明确谁能听见/看见；不设数量或不可替代门槛。按 [转场与片中文字](../_meta/rules/transition-craft.md) 核对正式原词、时间事实、知情时点和卡片预算，区分已有跳时的呈现设计与新增跳时的叙事变更；观众 SUPER 不要求人物阅读，黑底/简洁卡片本身不失败。

5. **mode 专属 review 项**: 见 series.md / short.md

6. **场景级内容密度参考**
   - 可运行 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/script-budget.sh {ep}`，读取真实每场与汇总 status；工具按场景文字计数，不是对白或表演计时器
   - 低于 8 或高于 10.4 字/秒的 `warn` 仅提示检查；沉默调度可用少量文字，长描述可表达瞬时画面，不自动判艺术失败或补删独白
   - 汇总分别读 `scenes_warn`、`scenes_ok`、`scenes_missing`，status 优先 `missing` > `warn` > `ok`；缺剧本/场景可只返回 missing 而无汇总。exit 0 只表示诊断返回，不是验收，`ok` 也不证明可拍
   - 结合试读、动作复杂度与反应时间发现真实不可拍或遗漏，才给定位与方向。`missing:duration` 是计算依据缺失；剧本确实缺少必需时长字段时另按 schema 报告。scene-duration 与实际对白配速等时长 gates 不变

本次不代替资产卡或图片的专门审核，也不把模板存在当作它们已通过的证明。

### 表演与事实落地

关键成片事实、必要屏幕/纸面内容及决定理解的原字、行动结果和反应应在 script 中，而非等 Storyboarder 发明。区分戏剧动作、必要连续性和摄影实现细节：检查所需事实能否落实，不要求剧本写景别/机位/阅读秒数，也不要求每次拿放都同等展开。

通读场景及已采用幕之间的真实时间、因果、信息与情绪联系，包含非相邻铺垫、必要进入/离开状态和余波。转场/幕标签不是联系本身；可信省略、有意反差和平行关系不是缺陷，不强制幕结构或过桥场。生成任务不是小电影，不因分组而要求停下、收束后重新起步。发现后场失效时回查前文支撑，定位实际根因与范围；源中的动作/声音可持续跨界，具体切点归分镜。

区分作者背景与观众实际得到的证据。年份、方位与装置前情可留背景；本场必须传达的事实应有既有设计支持的可见或可听表达。核对人物和道具的当前状态、必要的注意力变化及其视听依据，保持已有站位与持有关系，不因已由对白或声音传清就要求另补手势。

沿关键揭示核对观众先注意什么、证据何时显露、人物何时获知及如何反应。环境细节应有地点生活感、行动或注意层次，而非只加形容词；声源的远近、阻隔与主次应支撑听觉信息。沉默检查停了什么、留下什么；使用声桥时区分后声先入的 J-cut、前声延续的 L-cut 与双人同时说话，判断实际段落作用，不要求技巧齐备。

对白、内心独白、自语的重要表达要能看出对谁、想什么/持何态度、何事触发变化及可听表演，不只贴“温和询问／带期待／认真”。稳定音色/口音与临场重音、呼吸、节奏、音量、音高区分；常态配速不是永久限制，青年戏不带老年声备选。声音卡问题指出交相应负责人，不在剧本审核里擅改卡。

按既定片段时长核对对白、倾听、反应和动作的实际承载；场景总预算或字数工具通过不能替代此判断。表演方式按交流意图选择，保留指定台词和时长限制。此处审核剧本已经提供的成片证据；分镜审核核实源 shot 视听 prose。Creator 在参考与装组映射确定后编写最终 manifest.prompt，由独立 shot-input Reviewer 对实际最终 prompt 及所绑定媒体核实独立可消费性、源忠实度、完整性与集成。

对白或情绪意见给出具体交流证据：定位场景和相关前后原句/行动，说明说者此刻所知、所需与听者回应，指出哪里没有接住、哪里与既有人物不符，或哪次转变缺少依据，并描述对理解、关系或表演的实际影响。不能只写“AI 腔”“太直白”“不够高级”或用孤立一句判整段同质；缺情绪过渡不能让演员或音乐兜底。按实际措辞和节奏试读/估读，说明依据，不虚称录音实测。

直接表态、必要讲解、普通闲谈、完整句、短答、风格化警句、外露情绪或有效内心声本身不是缺陷。可以认可坦白后的回应、日常谈话的亲近感或有依据的克制，不强加冲突、潜台词、长句，也不反向要求短句与填充词。技巧次数、句长与个人审美不作门禁；有具体失效才提阻塞，替代风格另列可选建议。

### 意见取舍
- 原创按已授权方向评估新发展的支撑是否成立；采用/修复核对来源事实与保留范围。意见若需要新增关键往事、改关系/规则或结局，应明确所需范围供 Director 协调，不把它包装成必须照做的措辞修正。
- 阻塞聚焦真实叙事、共情或制作缺口；有用的专业建议可另列收益，不把措辞偏好强制交给作者
- 意见供 scriptwriter-fix-script 消费，生产 Director 决定修正与重审；reviewer 不承担修复调度
- 意见说清问题方向，不替 scriptwriter 写最终台词

### 审核记录

start 返回 `reviews/{ep}/script.md` 与轮号。Reviewer 在指定临时 PAYLOAD.json 写 commentary 和 result，再运行 `review-round.mjs finish STATE PAYLOAD.json`；helper 复核输入、注入 target/inputs 并验证记录。同一 ep/kind/target 重审串行是输出所有权规则，读写/输入依赖仍须排序，无冲突就绪目标可并行；无需二次汇总或正常完成后的全文 Read 自检。

**意见格式**（写入 payload.commentary）：

result 显式写 status 与 blockers，具体依据和可选建议放 commentary；实际输入变更/读取失败/无法判定为 unknown。轮次标题、evidence 和 footer 由 helper 管理。

不通过时：
```markdown

### 需修改意见

1. **{位置 (场景 N / 字段名 / "整体")}：** {问题描述} → {修改建议}
```

## 规则
- 重审聚焦仍影响下游分镜的关键问题，轮次不改变验收标准，不自行豁免
- 具体权利风险按共享规则升级，不因现实名称自动要求改名

## 输出
- 文件: helper 完成 `reviews/{ep}/script.md`，手写仅指定临时 payload
- 返回: finish 的 path/round/status/input_count/evidence_issues 和必要意见，M 仅计阻塞项；exit 0 表示写入成功，不表示 pass
- 详细意见已写入文件，下游 scriptwriter-fix-script 自行读取最后一轮段
