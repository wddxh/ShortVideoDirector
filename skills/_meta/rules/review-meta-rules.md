# Review 意见输出规约（共享）

本文件被所有 `*-review-*` skill 必读引用。约束 review skill 自身输出的"修改意见"质量。

**范围**：约束 review 的意见表达和当前验收证据；审核维度由各自 skill 负责。

## 当前范围证据

独立审核与重审是内部自动质量门禁，不自动产生用户批准步骤。生产 Director 在原授权内协调修复并重新送独立审核，不能以用户同意替代 pass，也不逐轮请用户批准。新问题先依据当前配置、材料、grants 和专业判断处理；仅用户指定检查点、缺必要权限或无法内部解决的关键冲突才按 user-decision-relay 交回完整决策包，只暂停受影响工作。

先确认本次是独立、新建的 Director review context，而非生产 Director、Creator 或修复者的历史会话。支持嵌套时由委托方直接创建独立 task；不支持时向主 AI 请求忠实 relay，由主 AI 创建新 Director reviewer，并把原始结果送回原生产 Director。加载 skill 不产生隔离。隔离不可用时返回 unknown，不能自审、自行豁免或接受生产者的通过总结。

委托说明审核 outcome、当前材料与参考路径、scope、约束、结果形状和升级条件；不指定加载某个命名 skill 或固定方法链。Reviewer 按职责发现并选用知识，委托方提供完整相关材料而非只给有利总结。并发与批量大小是资源选择，例如最多五项一批便于控制上下文；串行或其他批量同样可以，独立性与覆盖要求不变。

Reviewer 只写自己受托的 review record；single/impact 只返回结果。不改生产材料、不调度创建或修复、不替另一 reviewer 写记录。生产 Director 决定修正、重审或向用户升级分歧，不能把失败改成通过。轮数、时间或预算耗尽仍保留失败/unknown，不固定两轮后验收。

必需制作材料的 review 保留 Markdown 意见、`## 第 N 轮 ...` 标题和
`<!-- /round-N -->` footer。标题文字不是验收依据。每轮开工前先写明 scope，
在该轮内放一个 `<!-- svd-review-evidence -->` 标记，紧跟 fenced JSON：

```json
{"version":1,"kind":"script","scope":["story/episodes/ep01/script.md"],"results":[]}
```

开工记录暂不写 footer。审核结束时更新同一个块，每个 scope target 恰好一个
`{"target":"项目相对路径","status":"pass","inputs":[],"blockers":[]}` result，
然后写本轮 footer。status 仅为 `pass|needs_revision|unknown`；pass 的 blockers
必须为空。inputs 必须包含 target，视觉审核还必须包含对应 PNG，并包含实际查阅的
脚本、配置、卡片、连续性或其他参考输入，不能只记录输出文件。

开始阅读前运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...`，保存返回的
`[{"path":"...","sha256":"..."}]` 作为 inputs 的阅读前快照；完成后再次 fingerprint 并逐项比对。
后采样与比较仅作内部核验，inputs 保留原快照的 `path`、`sha256`，不改名为 `sha256_before` / `sha256_after`。
原字节身份未变才可记录验收；发生变化先评估再审。SHA-256 由脚本计算，LLM 不编造。

命令在项目根目录运行，PATH 参数逐个引用。新参考在首次查阅前补采指纹，结束时验证全部输入。缺失文件/读取或哈希失败记录 unknown 和具体阻塞，不能伪造摘要；存在的输入仍记录。外部插件规则不冒充项目相对路径，报告其实际规则来源；inputs 记录所有实际查阅的项目材料。
单项子审核明确返回 result JSON；空响应、缺项、不可判定均为 unknown。schema 无效时，委托方请原 reviewer 修正返回协议；修正前保持 unknown，不自行补造结论。
聚合者仅汇总真实结论，不代写其他审核者的 pass，完整聚合要求覆盖全部请求目标。生产者不能兼任 review-record 聚合者，即使仅复制独立 pass；委托全新独立 Director 汇总上下文接收原始单项结果即可，无需新增嵌套链。

聚合者用于选范围/核对材料的项目输入（如 script inventory、config）也须阅读前采指纹，合入依赖它们的 result.inputs 并在结束时验证。子任务 inputs 原样保留；同一路径摘要不一致即本轮输入漂移，转 unknown 或重新评估，不能选最新摘要覆盖。持久化前核对 target 与请求路径一致，unknown 仍有显式 result 和阻塞原因。

| kind | 本集目录下 review 文件 | target |
| --- | --- | --- |
| script | .review-script.md | 本集 script.md 完整项目相对路径 |
| storyboard | .review-storyboard.md | 本集 storyboard.md 完整项目相对路径 |
| asset-prompt | .review-asset-prompts.md | 基础资产卡路径 |
| asset-visual | .review-basic-assets-visual.md | 基础资产卡路径 |
| sheet-prompt | .review-storyboard-sheet-prompts.md | canonical sheet 卡路径 |
| sheet-visual | .review-storyboard-sheets-visual.md | canonical sheet 卡路径 |

Helper 机械强制的最小输入集（全部使用真实整文件 SHA-256）：
- 六类均含 target 与当前配置路径，默认 `config.md`；CLI 使用 `SVD_CONFIG`，API `checkCoverage(targets, rounds, config)` 可显式指定，不能用旧默认配置代替。
- `storyboard` 另含同集 `script.md`。
- `asset-visual` 另含 target 对应 PNG。
- `sheet-prompt` / `sheet-visual` 使用生成同一 `parseSheetCard` 结果：`sourcePath` 为同集 `storyboard.md`，目标编号须匹配其中唯一实际 shot。参考卡直接从解析结果 `images` 映回 `.md`；该集合已含源 header 四类 links 与 sheet 补充的并集及显式 previous，不在审核端另猜或重建引用集合。
- `sheet-visual` 再含自身 PNG 和上述直接参考卡的 PNG（包括声明的 previous PNG）。`sheet-prompt` 不要求这些图片已经生成。

两类 sheet reviewer 都核对解析后的完整 prompt：源 shot 叙事上下文 + 完整 Panel 规划 + 整板绘制要求。Card 不存源副本，末尾 `图像生成提示` 不是完整请求；不要求摘要复写已传入的对白/声音，也不逐句配格或自动绘为字幕。读取/解析前采 target、配置与 sourcePath 指纹，解析定位参考后在查阅前补采，结束核验全部输入。Parser 不依赖 PNG；缺实际参考图只在需要它的视觉审核/生成阶段阻塞，不能用全量 readiness 倒置前提。

基础卡同实体参考是 reviewer/Creator 的语义与映射责任，不是新 parser：`asset-prompt` 必须读取并记录必要直接参考卡，不要求未来 PNG；`asset-visual` 还读取并记录这些直接参考 PNG。单项始终只有一个 TARGET，参考仅作 inputs，允许跨类别，不递归参考链或历史，不扩 scope。共享标志物、几何、材质、状态与视角关系由 reviewer 判断。当前 helper 不推断同实体或强制该声明的输入完整性；它会检测已记录参考哈希变化，但漏记参考仍可能机械通过，不能用 helper 的 pass 代替此核对。

遗漏最小输入、依赖读取/解析失败或指纹过时均为 unknown。仅检查直接声明，不递归遍历资产/前板，也不要求 outline/novel/arc；额外语义参考仍由 reviewer 选择并记录。整份 storyboard 的身份绑定会使任意字节变化需要兼容性评估，不代表自动重生全量。

视觉审核若有对应 `.generation.json`，将其作为实际参考采指纹并核对输出身份/设置；receipt 的 output_sha256 是 PNG 摘要，review.inputs 还须保留 receipt 文件自身的 sha256。当前 helper 不把 receipt 列为必需输入；用户提供/历史图片缺 receipt 不自动失败，不补造生成历史。Receipt 不含参考图列表，不证明原始参考输入、视觉质量或独立审核已完成；当前 refhash 仅绑定本轮比较依据，不追认生成时输入。

同一 kind 中，最新声明某 target 的轮次优先，即使该轮未完成也不能回退到旧 pass。

续轮按最大标题轮号递增；历史未完成轮保留，不要求删除旧记录。先声明本轮 scope，再阅读目标。完成时必须核对每个 target、结果数、证据块及唯一 footer；通过模板同样必须填证据，heading-only 不是通过。空响应不是空 scope；真正空 scope 只在目标清单成功解析为空时成立。
可读 scope 只阻塞该范围；不可读 scope 阻塞该 kind，直到修复记录。
范围外既有证据保留；局部 pass 不覆盖其他 target 的失败。哈希过时代表需要兼容性评估，
不是自动重生指令。确认未受影响的目标可用当前 inputs 和明确 reason 续签新轮证据。
reason 是可选 result 字段，解释本次兼容性判断，不能仅刷新哈希冒充重新评估。

可选顶层 `reviewer_context` 只填写实际独立 task 引用；不存在时省略。
哈希证明版本身份，不证明上下文独立。独立性须由真实平台委派证据验证，不能伪造引用。
生产负责人和独立 Director reviewer 使用不同上下文；独立性不可用则保持未验收。
Director 在交付总结中判断整体连贯性，不额外要求全作品 review 文件，不审核生成视频质量。

仅在生产材料已具备、需要整集交付或提交验收时使用全量 readiness；早期 script/card review 不运行它作为前置条件。局部证据检查按 helper 的最新 scope/输入规则核对，不把缺少后续产物误报为当前 review 失败。

`node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" check EP [SHOT...]` 输出 `item:status`，exit 0 表示就绪，
exit 1 表示阻塞。SHOT 使用十进制编号，如 `1 3`；省略时覆盖剧本全部资产和全部镜头，
指定时覆盖这些镜头及视频转换器的基础引用，仍要求 script/storyboard 验收。
状态将 pass 显示为 ok，缺文件为 missing，身份变更/解析错误/未完成为 unknown，
真实当前修改意见为 needs_revision。`SVD_CONFIG` 可指定配置路径，默认 config.md。
`check-episode.sh EP [config_path]` 继续保留 legacy KF exit 2。

基础资产全集来自 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" all`，含新增和本集复用资产；不是整个历史 assets 目录。显式 scope 只审核指定目标，不自动合并历史 dirty/unknown；范围外未解决记录原样保留，另报生产 Director，不因本轮 pass 消失。没有显式 scope 时验证当前所需目标的最新证据，仅审缺失、过时或未通过项；历史纯 pass 不能短路身份检查。

Arc/outline/novel 是可选规划审核，不属于上述六种 kind，也不替代用户制作前确认。仅审被委托且已存在的材料，缺少未请求的规划文件不阻塞生产审核。结尾按用户意图判断，可闭合、开放或续集悬念；评价因果、情绪落点和承诺兑现，不机械强制闭环或钩子。所有 review 保留各自专业语义判断与可执行定位，不审核生成视频质量。

## 4 条核心规则

### 规则 1：意见语言遵循实际配置

遵循 `output-language.md` 与实际 SVD_CONFIG（未设时 config.md）的语言设置；路径、schema key 和状态枚举保持原值。

### 规则 2：诊断准确，修改方向具体

审核诊断可以准确指出“缺失”“不一致”及实际错误对象；诊断不是生成 prompt，不能原样复制进模型输入。面向生成的修正方向应始终给出正面、具体的目标状态，让 Creator 表达画面真正呈现的主体、形状、材质、动作和空间。这是已有失败案例积累的重要经验，不是固定工序或技能调用限制。

例如，影响关键设计的“道具表面图案与卡片不一致”是有效诊断；生成方向写“实心金属表面布满细密随机短刻痕”。不要建议把“严禁宝剑、汉字、符文”前置或重复来强化控制；排除对象被反复提及可能继续误导生成。评估具体表达及画面效果，不用通用禁词表代替专业判断；该例不把所有细小纹理差异升级为阻塞。

文学稿可以直接展开心理；剧本/分镜检查观众能否通过动作、声音、对白或其他已约定载体感知。不能把静态图像提示技巧扩成小说旁白或内心独白禁令。

### 规则 3：专业建议不等于执行命令

给位置、观察、影响、期望和可行方向；简短示例可以解释建议，不替作者定稿。保留人物声音、共情、视觉表达、铺垫回收、因果、节奏、摄影与连续性的积极建议。生产 Director 决定取舍和授权，作者选择实现方法。owner、dirty list、handoff 等消费者字段是数据契约，不要求调用某 skill 或按字段次序执行。

### 规则 4：区分阻塞与建议

实质损害确认意图、人物可信度、观众理解或制作可行性的问题可以阻塞，不限于解析器错误。改进建议说明收益与代价，不作为个人审美门禁。字数密度、节奏比例和示例数量是诊断参考，不自动转为艺术失败；真实 schema、授权和用户严格时长仍是边界。

图像验收以制作可用为准：独立 reviewer 已实际看图、必要参考齐全且证据为当前版本，无明显错误/不合理特征，也无剧情或必要连续性影响的不匹配，即应返回 `pass`。细节、色彩、布局或机位的合理变化若无实质影响，不要求精确复刻卡片或反复生成到完美。明显错身份、缺关键道具、不可能的解剖/空间动作，以及妨碍视频生成的 sheet 格序歧义仍是阻塞；用户明确要求的关键设计仍须核对，不能以“可用”豁免。未看图、缺必要参考或证据漂移是 `unknown`，不是宽松 pass。

视觉 `needs_revision`、blockers、修复意见与 dirty/M 计数只反映真实阻塞，不计小建议。汇总者不把建议升格为失败，也不自行把 reviewer 的失败改成通过；发现仅偏好被误列为 blocker 时交原独立 reviewer 澄清。当前证据下已可用且 pass 即停止该目标质量循环，只有用户要求可选精修或出现新需求/实质问题才重开；证据过时仍需评估，不等于自动重生。此停止条件不改变图片失败重试默认无次数上限，也不允许用次数耗尽代替验收。

现实人名、地名或商标本身不证明侵权。有具体权利风险或授权冲突时引用依据、说明影响并升级生产 Director/用户确认，不自动改名或把改名当合规保证。审核者不修改角色级规则；冲突明确报告。

#### 数值与姿态的可用性判断

图像 prompt 中的长度（如 cm）、角度及姿态细节默认是表达意图的指导，不是逐项精确验收指标；只有用户明确把该数值定为必要指标，或剧情机制依赖它时，才作为关键要求核对。此处不放宽配置、schema 或严格时长等真实契约。正面生成描述仍应保留有用的精确线索和数值，不为降低审核门槛删掉数字。

- 卡片写“20 cm 道具”，无可靠尺度基准时不能把像素换算成厘米，更不能从透视图声称测得精确长度或角度。人体与物体的相对尺度大体合理、拿取和使用可信，且无关键要求冲突，就此项应通过；缺少非必要测量基准不单独构成 unknown。若数值确为必要指标但现有证据无法核实，说明限制并保持 unknown，不猜测达标。
- 手臂角度、手指摆放或机位的轻微差异不损害动作含义、使用功能或必要连续性时应通过；不是每个姿态细节都要复刻。反之，关键道具必须由指定手持有以衔接下一动作、必须够到机关，或姿态变化破坏动作衔接时，具体冲突仍须修正，不能以“大致合理”放过。

上述通过仍须满足实际看图、必要参考齐全、当前证据和独立审核前提；impact 对声明继承作同样判断，无实质冲突为 unaffected，而非材料 pass。

## 意见示例

### 生成画面的方位判断

资产／shot／sheet 的方位表达与修正方向按 [通用视觉原则 6](visual-prompt-craft-common.md) 核对。定位实际歧义及影响：无机位依据的“东边／西侧上方”让关键站位、光源或动作落点不明时才指出问题，不扫描“东”等字判失败。背景、对白、地名和仪器文字不机械改写；画面定位仍须明确。

看图时比较当前视角，sheet 比较各 PANEL 内部画面而非整板格位。反打、转身或运镜造成的合理投影变化不是换位／换手证据；核对角色自己的手、同实体拓扑和必要连续性。无实质影响的姿态、cm 数值或构图差异沿用上方可用性标准，通过不要求精确复刻。缺机位依据不编造左右，交对应 owner；impact 仍只看已授权配对及声明继承，不扩读取范围。此规则不把小说／剧本背景改成摄影指令。

### 保留的失败教训：玄铁灵核

反例：图中出现大宝剑图案、汉字和红色符文带后，建议把“严禁正面宝剑浮雕、严禁任何可辨汉字与符文字形”放到 prompt 最前面。该方向继续点名错误元素，没有建立需要的材质和发光结构。

正例：先在诊断中说明图案与卡片不符，再把生成方向改为：“晶壳为实心古玄铁，表面布满发丝级随机短刻痕；内部金红色流光从几道不规则细缝透出，亮度集中于缝口，周围金属暗哑。”不是只删去否定句，而是补足可渲染的目标状态。

| 反例修正方向 | 正面表达方向 |
| --- | --- |
| 不要在画面出现宝剑图案 | 晶壳呈实心古玄铁质感，表面分布细密随机短刻痕 |
| 避免文学比喻“像火翼” | 金红色火焰从剪影背后向上喷出，两侧对称展开 |
| 禁止心理描写“怕被记住” | 手腕翻转，掌心覆盖悬浮光屏，呼吸短暂停住 |

这些例子传递提示表达经验，不要求所有心理都改成动作；剧本已经选择的内心独白或画外音仍可承载体验。保留正反例及失败原因，不能因去除函数式编排而删掉它们。

“PANEL 02 中道具换到右手，与已声明的左手持有终态不一致，后接镜头会出现跳变；建议明确左手持有与右手触门的空间关系。”观察与影响可验证，方向有用，但不替 Creator 重写整卡。若只是构图偏好，可另列建议及收益，不放进 blockers。

## 与其他共享规则的关系

- `output-language.md`：被规则 1 引用（语言一致性）
- `visual-prompt-craft-common.md` / `visual-prompt-craft-video.md`：
  - **visual prompt review skill** 出意见时引用这两份给具体改进方向
  - **narrative review skill** 出意见时不涉及（只引用本文件）

## 适用范围

| Review skill | 引用本文件 | 引用 visual-prompt-craft-* |
|---|---|---|
| director-review-novel / -script / -outline / -arc | ✅ | ❌ |
| director-review-storyboard | ✅ | ✅（视听表达与可生成性）|
| director-review-asset-visual-single / director-review-assets-visual | ✅ | ❌ |
| director-review-asset-prompt-single / director-review-asset-prompts | ✅ | ✅ |
| director-review-storyboard-sheet-prompts / director-review-storyboard-sheets-visual | ✅ | ✅ |
| director-review-storyboard-sheet-visual-single / director-review-storyboard-sheet-impact | ✅ | 按可见状态与声明继承核对；汇总者不读图 |
