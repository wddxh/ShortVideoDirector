# Review 意见输出规约（共享）

本文件被所有 `*-review-*` skill 必读引用。约束 review skill 自身输出的"修改意见"质量。

**范围**：约束 review 的意见表达和当前验收证据；审核维度由各自 skill 负责。

涉及任何图片读取或操作时必读 [图像上下文与预览规则](visual-context.md)：每次全新 task，最小必要图集，先缩略图、必要时局部 crop，原图不直接 Read。文本/文件交接，不恢复 image-heavy task；可选 result.visual_inspection 记录派生查看依据，不替换 inputs 的原材料指纹。

## 当前范围证据

独立审核与重审是内部自动质量门禁，不自动产生用户批准步骤。生产 Director 在原授权内协调修复并重新送独立审核，不能以用户同意替代 pass，也不逐轮请用户批准。新问题先依据当前配置、材料、grants 和专业判断处理；仅用户指定检查点、缺必要权限或无法内部解决的关键冲突才按 user-decision-relay 交回完整决策包，只暂停受影响工作。

先确认本次是独立、新建的 Director review context，而非生产 Director、Creator 或修复者的历史会话。支持嵌套时由委托方直接创建独立 task；不支持时向主 AI 请求忠实 relay，由主 AI 创建新 Director reviewer，并把原始结果送回原生产 Director。加载 skill 不产生隔离。隔离不可用时返回 unknown，不能自审、自行豁免或接受生产者的通过总结。

委托说明审核 outcome、当前材料与参考路径、scope、约束、结果形状和升级条件；不指定加载某个命名 skill 或固定方法链。Reviewer 按职责发现并选用知识，委托方提供完整相关材料而非只给有利总结。并发与批量大小是资源选择，例如最多五项一批便于控制上下文；串行或其他批量同样可以，独立性与覆盖要求不变。

独立 singleton reviewer 直接写自己受托的 review 文件/轮次，无需第二个 LLM 汇总。小批量、语义相干的纯文本提示可由一个独立任务逐 target 判断并落盘。协调者串行安排同一 review 文件的写入，分配轮次前重读最大轮号；不并发改同文件。每次图片操作仍用全新 task、缩略图优先和最小图集。Reviewer 只写受托记录及指定临时预览，不改生产材料或调度修复。生产者不能编造 pass；轮数、时间或预算耗尽保留失败/unknown。

必需制作材料的 review 保留 Markdown 意见、`## 第 N 轮 ...` 标题和
`<!-- /round-N -->` footer。标题文字不是验收依据。每轮开工前先写明 scope，
在该轮内放一个 `<!-- svd-review-evidence -->` 标记，紧跟 fenced JSON：

```json
{"kind":"script","scope":["story/episodes/ep01/script.md"],"results":[]}
```

开工记录暂不写 footer。审核结束时更新同一个块，每个 scope target 恰好一个
`{"target":"项目相对路径","status":"pass","inputs":[],"blockers":[]}` result，
然后写本轮 footer。status 仅为 `pass|needs_revision|unknown`；pass 的 blockers
必须为空。inputs 必须包含 target，视觉审核还包含对应原始 PNG/MP4，并包含实际查阅的
脚本、配置、卡片、连续性或其他参考输入，不能只记录输出文件。

开始阅读前运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...`，保存返回的
`[{"path":"...","sha256":"..."}]` 作为 inputs 的阅读前快照；完成后再次 fingerprint 并逐项比对。
后采样与比较仅作内部核验，inputs 保留原快照的 `path`、`sha256`，不改名为 `sha256_before` / `sha256_after`。
原字节身份未变才可记录验收；发生变化先评估再审。SHA-256 由脚本计算，LLM 不编造。

命令在项目根目录运行，PATH 参数逐个引用。新参考在首次查阅前补采指纹，结束时验证全部输入。缺失文件/读取或哈希失败记录 unknown 和具体阻塞，不能伪造摘要；存在的输入仍记录。外部插件规则不冒充项目相对路径，报告其实际规则来源；inputs 记录所有实际查阅的项目材料。
单项子审核明确返回 result JSON；空响应、缺项、不可判定均为 unknown。schema 无效时，委托方请原 reviewer 修正返回协议；修正前保持 unknown，不自行补造结论。
仅实际拆成多个 reviewer 结果且需要合并记录时使用独立汇总者；只处理原始结论，完整聚合覆盖全部请求目标。已由 singleton 或文本批次 reviewer 直接完成的记录不再加汇总任务。生产者协调范围与写入顺序，不签发或改写审核结论。

聚合者用于选范围/核对材料的项目输入（如 script inventory、config）也须阅读前采指纹，合入依赖它们的 result.inputs 并在结束时验证。子任务 inputs 原样保留；同一路径摘要不一致即本轮输入漂移，转 unknown 或重新评估，不能选最新摘要覆盖。持久化前核对 target 与请求路径一致，unknown 仍有显式 result 和阻塞原因。

| kind | 本集目录下 review 文件 | target |
| --- | --- | --- |
| script | .review-script.md | 本集 script.md 完整项目相对路径 |
| storyboard | .review-storyboard.md | 本集 storyboard.md 完整项目相对路径 |
| asset-prompt | .review-asset-prompts.md | 基础资产卡路径 |
| asset-visual | .review-basic-assets-visual.md | 基础资产卡路径 |
| shot-input | .review-shot-inputs.md | story/episodes/{ep}/shot-inputs/shotNN.json |

Helper 机械强制的最小输入集（全部使用真实整文件 SHA-256）：
- 五类均含 target 与当前配置路径，默认 `config.md`；CLI 使用 `SVD_CONFIG`，API `checkCoverage(targets, rounds, config)` 可显式指定，不能用旧默认配置代替。
- `storyboard` 另含同集 `script.md`。
- `asset-visual` 另含 target 对应 PNG。
- 两类 asset prompt/visual 均须包含本卡 `localReference.images` 和 `localReference.sources` 全部实际文件，按 [本地参考契约](local-reference.md) 检查。Prompt 审核也须看已制成的本地 PNG、检查实际源码/工程/输入；不要求未来生成 PNG 存在。缺文件或无法完成必要读取为 unknown。

卡片本地参考沿用 asset evidence。逐镜使用 `shot-input` kind，见 [shot-inputs.md](shot-inputs.md)。输入含 manifest/config/script/storyboard、上传 PNG/MP4、sources 及资产视觉依赖。聚焦实际 prompt/media 集成、必要边界与变化细节，无具体冲突时复用当前 storyboard 判断。作品基线每请求一次，动作表情与声音在 prose，use 声明控制权限，源码不上传。按故事选必要相邻/非相邻/跨集配对，比较位置、轨迹、状态、轴线与身份，实际依赖入 inputs 指纹并说明覆盖限制。必要运动不可核实为 unknown，首尾静帧不证明连续轨迹；变更先评估实际影响，不自动重渲染。

基础卡同实体参考是 reviewer/Creator 的语义与映射责任，不是新 parser：`asset-prompt` 必须读取并记录必要直接参考卡，不要求未来 PNG；`asset-visual` 还读取并记录这些直接参考 PNG。单项始终只有一个 TARGET，参考仅作 inputs，允许跨类别，不递归参考链或历史，不扩 scope。共享标志物、几何、材质、状态与视角关系由 reviewer 判断。当前 helper 不推断同实体或强制该声明的输入完整性；它会检测已记录参考哈希变化，但漏记参考仍可能机械通过，不能用 helper 的 pass 代替此核对。

遗漏最小输入、依赖读取/解析失败或指纹过时均为 unknown。按实际依赖检查，不递归遍历所有资产，也不要求 outline/novel/arc；必要连续性参考由 reviewer 选择并记录。整份 storyboard 的身份变化需要兼容性评估，不代表自动重生全量。

视觉审核若有对应 `.generation.json`，将其作为实际参考采指纹并核对输出身份/设置；receipt 的 output_sha256 是 PNG 摘要，review.inputs 还须保留 receipt 文件自身的 sha256。当前 helper 不把 receipt 列为必需输入；用户提供/历史图片缺 receipt 不自动失败，不补造生成历史。Receipt 不含参考图列表，不证明原始参考输入、视觉质量或独立审核已完成；当前 refhash 仅绑定本轮比较依据，不追认生成时输入。

同一 kind 中，最新声明某 target 的轮次优先，即使该轮未完成也不能回退到旧 pass。

续轮按最大标题轮号递增；历史未完成轮保留，不要求删除旧记录。先声明本轮 scope，再阅读目标。完成时必须核对每个 target、结果数、证据块及唯一 footer；通过模板同样必须填证据，heading-only 不是通过。空响应不是空 scope；真正空 scope 只在目标清单成功解析为空时成立。
可读 scope 只阻塞该范围；不可读 scope 阻塞该 kind，直到修复记录。
范围外既有证据保留；局部 pass 不覆盖其他 target 的失败。哈希过时先做实际影响评估。
仅记账/源码变化且渲染媒体未变时，独立 reviewer 可比较变更、已审依据、当前 prompt/refs 和媒体指纹，做 scoped 兼容性评估，不自动全量重审或重渲染。需重新看图时仍每次新 task、缩略图优先。确认未受影响才用当前 inputs 和明确 reason 续签新轮证据。
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
`SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" EP [SHOT...]` 检查输入结构：整集编号 1..N，选镜允许缺号且源编号递增唯一、请求目标存在。运行错误报告为阻塞。

每镜 manifest 顶层仅 references，至少含一个本地 MP4。最终就绪要求 script/storyboard/asset-visual/shot-input，授权新增/重生图片另须当前 asset-prompt。整集覆盖 script 全资产 visual，选镜取 header 资产并核对清单归属。submitted 按已登记 ID/provider 取回，保护真实状态与 grants。机械检查不替代独立语义判断。

asset-visual 的整集范围来自 `episode-assets.mjs "story/episodes/{ep}/script.md" all`，含新增和本集复用资产。asset-prompt 只覆盖实际授权新增/重生集合，不从 all inventory 推定目标，复用资产仅作必要 inputs。显式 scope 只审核指定目标，范围外未决记录保留；集合内核对当前证据，处理缺失、过时或未通过项。

Arc/outline/novel 是可选规划审核，不属于上述五种 kind，也不替代用户制作前确认。仅审被委托且已存在的材料，缺少未请求的规划文件不阻塞生产审核。结尾按用户意图判断，可闭合、开放或续集悬念；评价因果、情绪落点和承诺兑现，不机械强制闭环或钩子。所有 review 保留各自专业语义判断与可执行定位，不审核生成视频质量。

## 4 条核心规则

### 规则 1：意见语言遵循实际配置

遵循 `output-language.md` 与实际 SVD_CONFIG（未设时 config.md）的语言设置；路径、schema key 和状态枚举保持原值。

### 规则 2：诊断准确，修改方向具体

审核诊断可以准确指出“缺失”“不一致”及实际错误对象；诊断不是生成 prompt，不能原样复制进模型输入。面向生成的修正方向给出正面、具体的目标状态，让作者表达画面真正呈现的主体、形状、材质、动作和空间，不以排除对象清单代替目标设计。

例如，影响关键设计的“道具表面纹理与卡片不一致”是有效诊断；生成方向可写“深灰金属表面分布细密随机短刻痕，边缘呈柔和反射”。评估具体表达及画面效果，不用通用禁词表代替专业判断；细小纹理差异只有造成实质影响才阻塞。

文学稿可以直接展开心理；剧本/分镜检查观众能否通过动作、声音、对白或其他已约定载体感知。不能把静态图像提示技巧扩成小说旁白或内心独白禁令。

### 规则 3：专业建议不等于执行命令

给位置、观察、影响、期望和可行方向；简短示例可以解释建议，不替作者定稿。保留人物声音、共情、视觉表达、铺垫回收、因果、节奏、摄影与连续性的积极建议。生产 Director 决定取舍和授权，作者选择实现方法。owner、dirty list、handoff 等消费者字段是数据契约，不要求调用某 skill 或按字段次序执行。

### 规则 4：区分阻塞与建议

实质损害确认意图、人物可信度、观众理解或制作可行性的问题可以阻塞，不限于解析器错误。改进建议说明收益与代价，不作为个人审美门禁。字数密度、节奏比例和示例数量是诊断参考，不自动转为艺术失败；真实 schema、授权和用户严格时长仍是边界。

图像验收以制作可用为准：独立 reviewer 实际看图、必要参考齐全、证据当前且无明显错误或影响剧情/必要连续性的不匹配，即应 pass。合理细节、色彩、布局或机位变化不要求精确复刻。错身份、缺关键道具、不可能的空间动作及用户关键设计冲突仍阻塞；BOX 仅按其控制范围审核。未看图、缺必要参考或证据漂移为 unknown。

视觉 `needs_revision`、blockers、修复意见与 dirty/M 计数只反映真实阻塞，不计小建议。汇总者不把建议升格为失败，也不自行把 reviewer 的失败改成通过；发现仅偏好被误列为 blocker 时交原独立 reviewer 澄清。当前证据下已可用且 pass 即停止该目标质量循环，只有用户要求可选精修或出现新需求/实质问题才重开；证据过时仍需评估，不等于自动重生。此停止条件不改变图片失败重试默认无次数上限，也不允许用次数耗尽代替验收。

现实人名、地名或商标本身不证明侵权。有具体权利风险或授权冲突时引用依据、说明影响并升级生产 Director/用户确认，不自动改名或把改名当合规保证。审核者不修改角色级规则；冲突明确报告。

#### 数值与姿态的可用性判断

以下人体姿态/接触标准用于实际资产、生成画面及其文字目标，不套到本地视频盒体。按 [通用视觉表达](visual-prompt-craft-common.md)，本地 VIDEO 默认仅用刚性、固定形状 BOX 表示人物及类似行动主体；可整体平移/旋转，不变形、不表演，只有明确不同委托才改变范围。盒体只审取景、尺度、位置/布局、整体轨迹与相机控制，无手、无姿态或无解剖遮挡/接触/换握证明不是失败，也不能据此要求补肢体动画。

具体动作、姿势和表情由 shot prose 与模型负责；另审文字是否清楚、景别/角度是否支持最终动作可读，操作特写仍与盒体相容。环境/道具可保留镜头/布局所需几何；静态资产形状参考按其声明形状审核。详细外观遵循统一作品基线和实际资产。缺已声明媒体、必要输入不可读、指纹漂移或声明的必要轨迹无法评估仍为 unknown，独立审核与既有门禁不变。

图像 prompt 中的长度（如 cm）、角度及姿态细节默认是表达意图的指导，不是逐项精确验收指标；只有用户明确把该数值定为必要指标，或剧情机制依赖它时，才作为关键要求核对。此处不放宽配置、schema 或严格时长等真实契约。正面生成描述仍应保留有用的精确线索和数值，不为降低审核门槛删掉数字。

- 卡片写“20 cm 道具”，无可靠尺度基准时不能把像素换算成厘米，更不能从透视图声称测得精确长度或角度。人体与物体的相对尺度大体合理、拿取和使用可信，且无关键要求冲突，就此项应通过；缺少非必要测量基准不单独构成 unknown。若数值确为必要指标但现有证据无法核实，说明限制并保持 unknown，不猜测达标。
- 手臂角度、手指摆放或机位的轻微差异不损害动作含义、使用功能或必要连续性时应通过；不是每个姿态细节都要复刻。反之，关键道具必须由指定手持有以衔接下一动作、必须够到机关，或姿态变化破坏动作衔接时，具体冲突仍须修正，不能以“大致合理”放过。

上述通过仍须满足实际看图、必要参考齐全、当前证据和独立审核前提；边界判断沿用 shot-input 的 pass/needs_revision/unknown，不另造状态。

## 意见示例

### 生成画面的方位判断

资产/shot 方位按 [通用视觉原则 6](visual-prompt-craft-common.md) 核对。定位实际歧义及影响：无机位依据使关键站位、光源或动作落点不明时指出，不扫关键词判失败。背景、对白、地名和仪器文字不机械改写，画面定位仍须明确。

比较实际视角；反打、转身或运镜的合理投影变化不是换位/换手证据。核对同实体拓扑与必要连续性；无实质影响的姿态、数值或构图差异按可用性判断。缺机位依据不编造左右，交 owner。必要边界范围由独立 shot-input reviewer 根据故事选择，读取缺口为 unknown；不把文学背景改成摄影指令。

### 具体目标与连续性

修正意见连接实际观察、制作影响与目标状态。材质意见可说明反射或纹理尺度如何影响已确认设计，再给出适用的表面表达；表演意见可说明观众需要感知的转折，再建议动作、声音或剧本已选择的内心独白。示例用于解释方向，最终表达由对应作者完成。

例如：“两端 shot prompt 的道具持有手不一致，会造成动作跳变；建议核实已确定终态并明确当前起始关系。”观察、影响与方向可验证，不替作者定稿。BOX MP4 不负责表现手部；另核对其位置、轨迹和轴线。纯构图偏好另列建议，不放入 blockers。

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
| director-review-shot-inputs | ✅ | ✅（最终输入包语义与必要时序，不审成片） |
| director-review-asset-visual-single / director-review-assets-visual | ✅ | ❌ |
| director-review-asset-prompt-single / director-review-asset-prompts | ✅ | ✅ |
