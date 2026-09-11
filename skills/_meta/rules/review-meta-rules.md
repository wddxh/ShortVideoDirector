# Review 意见输出规约（共享）

本文件被所有 `*-review-*` skill 必读引用。约束 review skill 自身输出的"修改意见"质量。

**范围**：约束 review 的意见表达和当前验收证据；审核维度由各自 skill 负责。

涉及任何图片读取或操作时必读 [图像上下文与预览规则](visual-context.md)：每次全新 task，最小必要图集，先缩略图、必要时局部 crop，原图不直接 Read。文本/文件交接，不恢复 image-heavy task；可选 result.visual_inspection 记录派生查看依据，不替换 inputs 的原材料指纹。

## 当前范围证据

独立审核与重审是内部自动质量门禁，不自动产生用户批准步骤。生产 Director 在原授权内协调修复并重新送独立审核，不能以用户同意替代 pass，也不逐轮请用户批准。新问题先依据当前配置、材料、grants 和专业判断处理；仅用户指定检查点、缺必要权限或无法内部解决的关键冲突才按 user-decision-relay 交回完整决策包，只暂停受影响工作。

先确认本次是独立、新建的 Reviewer context，而非顶层生产 Director、Creator 或修复者的历史会话。派发遵循 [有界交接与子树占用](user-decision-relay.md#ownership-and-delegation)：Director 显式给出可读依赖及 stable/等待条件、精确写入路径/targets、child 许可与升级条件；委托方只管理本地顺序，完整转交相关 scope/依赖/状态，不假定 child 继承全局上下文或账本。范围内依赖稳定、无冲突且支持嵌套时直接创建独立 reviewer task，不额外逐 child 握手。边界不明只读定位/报告；未知/新增依赖、共享写冲突、新写入或扩 scope、升级条件先回 Director 再执行。真实后代完成前父委托未完成，异步 running/有限返回不释放 Director 子树占用；依赖变化由 Director 重排，不自动取消或重问用户许可。

工具不可用或明确深度拒绝后复用已知限制，向主 AI 请求 role/outcome/references/scope/constraints relay，保留上述边界/状态。主 AI 创建全新 Reviewer，将实际结果送回原请求专家、审核协调者或 checker 任务，而非替换原 owner，不新建 Director task；普通失败不视为深度拒绝。后续视觉操作仍新 task，不恢复 image-heavy context。加载 skill 不产生隔离，隔离不可用返回 unknown，不自审或采信生产者的通过总结。不新增调度账本或轮询。

委托说明审核 outcome、当前材料与参考路径、scope、约束、结果形状和升级条件；不指定加载某个命名 skill 或固定方法链。Reviewer 按职责发现并选用知识，委托方提供完整相关材料而非只给有利总结。多目标范围内至少两个独立视觉目标就绪时，默认并发全新 Reviewer 任务，每项一个 target 与最小必要参考。实际依赖、缺必要参考、宿主资源或用户约束可支持有界分批/串行，在现有 handoff 简述原因；不设固定任务数或模型配额，独立性与完整覆盖不变。

每个 ep/kind/target 拥有唯一 canonical review 文件，受托独立 Reviewer 通过 helper 完成轮次。小批量、语义相干的纯文本提示可由一个独立任务逐 target 判断并分别写各自文件；无读写/输入依赖冲突的就绪视觉目标默认并发全新 Reviewer，各写各自文件。同一 ep/kind/target 的重审与写入串行是输出所有权规则，start 计算最大轮号并续轮；其他读写及输入依赖仍须排序。同文件编辑（含不同章节）串行；写入影响 active reader 的实际依赖或证据时等其实际完成，无冲突读写可并行，整文件指纹证据仍需文件稳定。相关输入有 active writer 时，等 owner 交回稳定材料再派审核，不能靠 finish 检出漂移代替派发前检查，不同输出不证明输入安全。不同目标无共享账本或必需 LLM 汇总者。每次图片操作仍用全新 task、缩略图和最小图集。Reviewer 只写受托 canonical 记录及指定临时目录内 helper STATE、payload 和必要预览，不改生产材料或调度修复。生产者不能编造 pass；轮数、时间或预算耗尽保留失败/unknown。

任务视频集成的 shot-input 由纯文本独立 owner 总审：start 在读取最终 prompt/timeline/manifest/源文本之前，读全必要文字后、任何看图之前规划相干视觉窗口、关键切点、接触/阅读阶段及必要外部配对。owner 从不加载图片、帧、contact sheet 或接收图像附件；实际查看交 fresh Reviewer 小型最小必要 helper 缩略图集。单资产视觉叶子仍可查看其有限比较集并写自己的记录，不强制转为此结构。

该 owner 独占同一 ep/kind/target 的 start/finish 与 canonical 记录。视觉 helper 不写该记录、不开竞争轮次、不改 owner STATE，只在指定临时范围制作预览并返回文本事实、时间/帧、原路径/指纹、预览映射及限制，区分所见与源码推断，不给 target pass。owner 先采集 helper 实际 inputs；新依赖先回未读路径，经 Director 协调和 owner 采集再交 fresh task。owner 独立评估全文集成、跨窗口连续性与覆盖，必要缺口另派有界新任务，不机械合并局部通过。必要证据缺失 unknown，明确冲突 needs_revision，采样不证明完整运动。详见 [总审与视觉交接](../../reviewer-review-shot-inputs/SKILL.md#text-owner-and-bounded-visual-handoffs)。

五种 runtime review 默认用 `review-round.mjs` 管理轮次和证据；目标 owner 负责独立语义判断及 Markdown 意见，局部视觉 helper 沿用 owner 已采集的证据，不自行 start。先核实 `/tmp/opencode`，创建指定 `/tmp/opencode/<task>` 目录，再选择其中尚不存在的绝对 STATE 路径和独立 PAYLOAD.json 路径。命令在故事项目根运行，材料路径使用 canonical 项目相对路径，逐个引用。

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" start KIND EP TARGET STATE [EXTRA_INPUT...]
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" add-input STATE PATH...
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" finish STATE PAYLOAD.json
```

在读取目标、配置或参考内容前执行 start，显式传入已解析的实际 SVD_CONFIG；即使路径为 config.md 也显式设置。start 返回 canonical path/round，打开 scope=[target]、results=[] 的未完成轮，采集 target/config/已知 extras 和发现的必需依赖。STATE 绑定项目、目标、配置和首次哈希；add-input/finish 使用该绑定，不切换配置或手改 STATE，不在工作区复制账本。

每个新语义参考在首次读取前用 add-input 登记，包括直接参考卡/PNG、receipt、连续性材料和实际源码。helper 发现的是机械最小集，不代替 Reviewer 选择必要参考。inputs 保存原材料整文件 `{path,sha256}`，预览不替换原图/MP4。

多目标共用语义参考时，在首次读取前为每个消费目标分别 start/add-input；一个 STATE 的采集不覆盖其他 STATE。用现有委托/作者计划说明目标及其所需参考，已知路径作为各自 start extras 前置传入，不新增范围账本。后发现的消费目标须先采集，再重新读取核对，不能追认先前阅读。

extras/add-input 只接收 helper 支持的有效项目相对原材料路径。`/tmp` 诊断报告与委托反馈可提示检查问题，但不是可登记的项目证据，也不替代媒体观察。必要观察由独立 delegate 返回实际源路径、预览依据与限制，源文件须在其读取前由消费目标采集；不能把报告复制进项目冒充证明或媒体。需要重新判断时，采集有效原材料并安排 fresh 独立检查。

不要仅为证明“已就绪”把易变 pending/status 文件或审核文件加入语义 inputs；就绪由现有门禁核对。实际依赖某份审核的语义判断、范围依据或其他必要内容时仍须阅读前采集，安排依赖完成并稳定后审核；不能为避免漂移删除必要依赖。真实源漂移保留首次哈希并记 unknown，后续按 scoped 独立兼容性规则评估。

Reviewer 在指定临时 PAYLOAD.json 撰写 `{"commentary":"Markdown 意见","result":{"status":"pass","blockers":[]}}`，可在 result 加 issue、reason、prompt_direction、visual_inspection 等专业字段。status 必须显式为 `pass|needs_revision|unknown`，blockers 必须为字符串数组，pass 时为空；缺 status 是无效 payload，不推断通过。target、inputs、kind、scope、轮次和哈希由 helper 注入，不手写 evidence JSON 或哈希；commentary 不含保留轮次标题/标记/footer。

finish 重新发现依赖、核对全部原始快照并验证完成记录，写入 Markdown 意见、唯一 result 和 footer。采集/依赖发现错误保留，后续恢复不清除；输入漂移保留首次哈希，证据问题使最终 status 为 unknown 并加入 blockers。操作错误保留未完成轮，诊断后处理，不补造 pass。外部插件规则报告实际来源，不冒充项目输入。
finish 的 exit 0 仅表示记录已写入，不表示 pass。返回实际 path、round、status、input_count、evidence_issues 和必要意见/限制即可；正常完成无需立即再 fingerprint、check-target/checkTarget 或全文 Read 自检。错误或诊断时按需检查；下游生成/交付门禁仍检查当时的当前证据。
最终机器 result 与 finish 摘要是状态依据；证据降级时保留的原 commentary 可能仍表达原先判断，应结合最终状态提示阅读，不据此报 pass。STATE 是采集过程状态，不能用其中旧值覆盖 finish 的实际 status/evidence_issues。

helper 的目标级短锁只覆盖单次读写，锁中记录 owner PID。进程异常退出可能留下锁；遇到锁冲突先核实 owner 是否仍在执行，再由协调方处理已中断的锁和对应轮次。文件年龄不代表 owner 已停止，保留现有证据与 STATE，避免重复写入或覆盖其他审核。
目标 owner 返回实际完成摘要。局部检查 delegate 只返回实际观察、所读路径、预览依据和限制，owner 据此独立完成语义结论；空响应、缺项、不可判定为该目标 unknown。无效 payload 交负责 Reviewer 修正，不补造结论，后续视觉操作仍新 task。
Plural skills 负责范围、覆盖核对与 M/K 计数，可使用各目标 finish 摘要；既有记录按需核对当前证据，不要求每次 finish 后全文重读，不另写合并 evidence 或要求第二次 LLM 验收。缺失、失败或无效记录只使所属目标未验收；请求范围内有未决目标就不能报告全范围 pass。生产者只协调并报告真实状态，不签发或改写结论。

嵌套不可用时主 AI/Director 派全新 sibling Reviewer，目标 owner 直接写其 canonical 文件并回传路径/result；局部检查结果回指定独立目标 owner。复用已确认限制，不重复探测深度，不恢复 image-heavy task。

局部视觉委托由独立目标 owner 在 delegate 读取前 start/add-input 采集所需原材料和参考；发现新参考先回传路径，owner add-input 后才交全新视觉任务读取。不用委托结束后的新快照冒充阅读前证据，不需另建 import registry。范围发现可先读 inventory；依赖它的目标 owner 须在 start extras/add-input 采集后重新读取核对范围，不能追认协调者早先读取。首次遗漏或无法证明必要阅读依据时说明限制并记 unknown。

| kind | 项目根下 canonical review 文件 | target |
| --- | --- | --- |
| script | reviews/{ep}/script.md | story/episodes/{ep}/script.md |
| storyboard | reviews/{ep}/storyboard.md | story/episodes/{ep}/storyboard.md |
| asset-prompt | reviews/{ep}/assets/{category}/{name}.asset-prompt.md | assets/{category}/{name}.md |
| asset-visual | reviews/{ep}/assets/{category}/{name}.asset-visual.md | assets/{category}/{name}.md |
| shot-input | reviews/{ep}/task-inputs/taskNN.md | story/episodes/{ep}/task-inputs/taskNN.json |

ep 使用 epNN。start 返回 canonical 项目相对路径；委托选路径或读取既有记录时可用 `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" path KIND EP TARGET`。TARGET 始终是被审材料，不是 review 文件。重审续写同一文件，每轮 scope=[target]、完成时 results 恰好一项。

Helper 机械强制的最小输入集（全部使用真实整文件 SHA-256）：
- 五类均含 target 与当前配置路径；start 必须显式使用实际 `SVD_CONFIG`，后续由 STATE 绑定，不能用另一配置代替。
- `storyboard` 另含同集 `script.md`。
- `asset-visual` 另含 target 对应 PNG。
- 两类 asset prompt/visual 均须包含本卡 `localReference.images` 和 `localReference.sources` 全部实际文件，按 [本地参考契约](local-reference.md) 检查。Prompt 审核也须看已制成的本地 PNG、检查实际源码/工程/输入；不要求未来生成 PNG 存在。缺文件或无法完成必要读取为 unknown。

卡片本地参考沿用 asset evidence；最终生成任务 manifest 用 `shot-input` kind，见 [shot-inputs.md](shot-inputs.md)，保留五种 kind。输入含目标 manifest/config/script/storyboard、上传 PNG/MP4、sources 及实际资产视觉依赖，不给每项媒体审核附整个装组计划哈希。聚焦最终 prompt/media 集成、变化细节、任务时钟、内部切点/声音桥及必要外部边界，无具体冲突复用 storyboard 判断。共同风格字段在任务级一次，动作表情与声音保留 prose，use 声明控制权限。按故事选相邻/非相邻/跨集配对，比较位置、轨迹、状态、轴线与身份，实际依赖入 inputs 指纹并说明覆盖限制。必要运动不可核实为 unknown；变更先评估影响，不自动重渲染。

基础卡同实体参考是 reviewer/Creator 的语义与映射责任，不是新 parser：`asset-prompt` 必须读取并记录必要直接参考卡，不要求未来 PNG；`asset-visual` 还读取并记录这些直接参考 PNG。单项始终只有一个 TARGET，参考仅作 inputs，允许跨类别，不递归参考链或历史，不扩 scope。共享标志物、几何、材质、状态与视角关系由 reviewer 判断。当前 helper 不推断同实体或强制该声明的输入完整性；它会检测已记录参考哈希变化，但漏记参考仍可能机械通过，不能用 helper 的 pass 代替此核对。

遗漏最小输入、依赖读取/解析失败或指纹过时均为 unknown。按实际依赖检查，不递归遍历所有资产，也不要求 outline/arc；必要连续性参考由 reviewer 选择并记录。整份 storyboard 的身份变化需要兼容性评估，不代表自动重生全量。

视觉审核若有对应 `.generation.json`，在读取前 add-input，再核对输出身份/设置；receipt 的 output_sha256 是 PNG 摘要，review.inputs 还须保留 receipt 文件自身的 sha256。当前 helper 不把 receipt 列为必需输入；用户提供/历史图片缺 receipt 不自动失败，不补造生成历史。Receipt 不含参考图列表，不证明原始参考输入、视觉质量或独立审核已完成；当前 refhash 仅绑定本轮比较依据，不追认生成时输入。

同一 ep/kind/target 的 canonical 文件中，最新轮次优先，即使该轮未完成也不能回退到旧 pass。

start 按该文件最大标题轮号递增并保留未完成轮，在阅读目标前打开 scope=[target]；finish 验证唯一 target/result、证据块及 footer。标题或开工成功不是通过。真正空请求只有清单成功解析为空才成立，不为它创建 target review。
缺失、不可解析、scope 错误或未完成记录只影响其 canonical 文件所属目标，不阻塞整个 kind；其他目标按各自当前文件独立核对。
范围外既有证据保留；局部 pass 不覆盖其他 target 的失败。哈希过时先做实际影响评估。
仅记账/源码变化且渲染媒体未变时，独立 reviewer 可比较变更、已审依据、当前 prompt/refs 和媒体指纹，做 scoped 兼容性评估，不自动全量重审或重渲染。需重新看图时仍每次新 task、缩略图优先。确认未受影响才用当前 inputs 和明确 reason 续签新轮证据。
reason 是可选 result 字段，解释本次兼容性判断，不能仅刷新哈希冒充重新评估。

可选 `result.reviewer_context` 只填写实际独立 task 引用；不存在时省略。payload 顶层仅为 commentary/result。
哈希证明版本身份，不证明上下文独立。独立性须由真实平台委派证据验证，不能伪造引用。
顶层生产 Director 和独立 Reviewer 使用不同上下文；独立性不可用则保持未验收。
Director 在交付总结中判断整体连贯性，不额外要求全作品 review 文件，不审核生成视频质量。

仅在生产材料已具备、需要整集交付或提交验收时使用全量 readiness；早期 script/card review 不运行它作为前置条件。局部证据检查按 helper 的最新 scope/输入规则核对，不把缺少后续产物误报为当前 review 失败。

`node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" check EP [SHOT...]` 输出 `item:status`，exit 0 表示就绪，
exit 1 表示阻塞。SHOT 使用十进制编号，如 `1 3`；省略时覆盖剧本全部资产和全部镜头，
指定时须选择完整组，覆盖任务 manifest 和成员基础引用，仍要求 script/storyboard 验收；部分组报告完整成员及额外镜头，不静默扩授权。
状态将 pass 显示为 ok，缺文件为 missing，身份变更/解析错误/未完成为 unknown，
真实当前修改意见为 needs_revision。`SVD_CONFIG` 可指定配置路径，默认 config.md。
`SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" EP [SHOT...]` 检查结构：整集编号 1..N 且每镜恰分配一次，任务按首成员排序；局部源允许缺号、递增唯一、目标存在且选完整组。全局校验声明组重叠/缺失源成员；局部不要求未选媒体或完整全片计划。未分配目标/部分组报告具体缺口；接口错误交主 AI/general 工程。

每任务最终 manifest 顶层恰为 shots/references/prompt，prompt 为 Creator 编写的非空白字符串，既有 target 指纹绑定其全文；shots/references 草稿只供 materials，不能通过最终审核/就绪。每任务至少一个全组时间线本地 MP4；task_id 取文件名，offset/duration 从原镜派生。fresh shot-input Reviewer 对最终 `--json` 原文核对源忠实度、完整性和集成，不假设提交时重写。最终就绪要求 script/storyboard/asset-visual/shot-input，授权新增/重生图片另须 asset-prompt。整集覆盖 script 全资产 visual，选镜取各成员 header 资产并核对清单归属。submitted 按已登记 ID/provider 取回，保护真实状态与 grants。机械检查不替代独立语义判断。

asset-visual 的整集范围来自 `episode-assets.mjs "story/episodes/{ep}/script.md" all`，含新增和本集复用资产。asset-prompt 只覆盖实际授权新增/重生集合，不从 all inventory 推定目标，复用资产仅作必要 inputs。显式 scope 只审核指定目标，范围外未决记录保留；集合内核对当前证据，处理缺失、过时或未通过项。

Arc/outline 是可选规划审核，不属于上述五种 kind，也不替代用户制作前确认。仅审被委托且已存在的材料，缺少未请求的规划文件不阻塞生产审核。结尾按用户意图判断，可闭合、开放或续集悬念；评价因果、情绪落点和承诺兑现，不机械强制闭环或钩子。所有 review 保留各自专业语义判断与可执行定位，不审核生成视频质量。

可选规划记录只写 Markdown 意见与轮次：`reviews/{ep}/outline.md`、`reviews/story/arc.md`。不使用 review-round helper，不写五种 runtime evidence 的 JSON，也不扩充 kind。改编剧本按需引用用户提供的小说、章节或节选的实际路径与采用范围。制作前确认按 [Director 规则](../../director-orchestrate/SKILL.md#来源与制作前确认) 执行，质量审核不代替用户批准。

## 4 条核心规则

### 规则 1：意见语言遵循实际配置

遵循 `output-language.md` 与实际 SVD_CONFIG（未设时 config.md）的语言设置；路径、schema key 和状态枚举保持原值。

### 规则 2：诊断准确，修改方向具体

审核诊断可以准确指出“缺失”“不一致”及实际错误对象；诊断不是生成 prompt，不能原样复制进模型输入。面向生成的修正方向给出正面、具体的目标状态，让作者表达画面真正呈现的主体、形状、材质、动作和空间，不以排除对象清单代替目标设计。

例如，影响关键设计的“道具表面纹理与卡片不一致”是有效诊断；生成方向可写“深灰金属表面分布细密随机短刻痕，边缘呈柔和反射”。评估具体表达及画面效果，不用通用禁词表代替专业判断；细小纹理差异只有造成实质影响才阻塞。

改编来源可以直接展开心理；剧本/分镜检查观众能否通过动作、声音、对白或其他已约定载体感知。不能把静态图像提示技巧扩成旁白或内心独白禁令。

### 规则 3：专业建议不等于执行命令

给位置、观察、影响、期望和可行方向；简短示例可以解释建议，不替作者定稿。保留人物声音、共情、视觉表达、铺垫回收、因果、节奏、摄影与连续性的积极建议。生产 Director 决定取舍和授权，作者选择实现方法。owner、dirty list、handoff 等消费者字段是数据契约，不要求调用某 skill 或按字段次序执行。

### 规则 4：区分阻塞与建议

实质损害确认意图、人物可信度、观众理解或制作可行性的问题可以阻塞，不限于解析器错误。改进建议说明收益与代价，不作为个人审美门禁。字数密度、节奏比例和示例数量是诊断参考，不自动转为艺术失败；真实 schema、授权和用户严格时长仍是边界。

区分用户实际要求、已确认创作决定、作者自行选择的实现细节与 Reviewer 建议。材料或约束相互矛盾时，先采集并查阅相关用户决定、配置或源材料，定位约束来源和实际冲突；不能把自选姿态、构图或审美偏好升级为用户硬要求，也不盲目采用更严一项。必要权威依据缺失时说明缺口；已确定的真实要求与源冲突仍须报告。

图像验收按声明的媒体职责判断制作可用性：基础资产图主要传达身份/外观、风格、画质与材质；参考视频可承担透视、遮挡、相机、布局及整体运动，具体动作/表情由 shot prompt 表达。独立 reviewer 实际看图、必要参考齐全、证据当前且本图职责内无实质问题时应 pass，不要求资产静帧精确复刻后续镜头。细节差异不影响剧情、身份识别、实际画质或用户明确要求时应通过；静态形状参考与 BOX 各按声明控制范围核对。

阻塞须连接实际观察、违反的要求与具体制作影响：错身份、关键特征/道具缺失、实质风格/材质/画质失败、破坏剧情关键动作或必要连续性、违背用户明确要求仍须修正。解剖、拓扑或空间异常不按类别自动阻塞，须说明它如何损害本图用途、主体可信度或关键剧情；无关微小结构不作为精修门禁。基础图门禁不要求未来参考视频先存在，也不声称未提供/未查看的视频已证明或修复任何问题；最终 shot-input 审核实际 prompt/media 的职责分配及真实冲突。未看目标图、缺本阶段必要证据或证据漂移为 unknown；非必要细节被遮挡/看不清不单独构成 unknown，必要要求无法核实才说明缺口。

视觉 `needs_revision`、blockers、修复意见与 dirty/M 计数只反映真实阻塞，不计小建议。协调者保留 reviewer 的判断；发现仅偏好被误列为 blocker 时交负责的独立 reviewer 澄清。当前证据下已可用且 pass 即停止该目标质量循环，只有用户要求可选精修或出现新需求/实质问题才重开；证据过时仍需评估，不等于自动重生。此停止条件不改变图片失败重试默认无次数上限，也不允许用次数耗尽代替验收。

现实人名、地名或商标本身不证明侵权。有具体权利风险或授权冲突时引用依据、说明影响并升级生产 Director/用户确认，不自动改名或把改名当合规保证。审核者不修改角色级规则；冲突明确报告。

#### 数值与姿态的可用性判断

以下标准按当前媒体职责使用，不把后续 shot 的证明提前压给基础资产图。按 [通用视觉表达的 BODYBOX、姿态作用域与省略规则](visual-prompt-craft-common.md#粗模控制与外观依据分离)，普通移动无手腿；必要支撑例外保留相容姿态随整体移动，不推导步态或摆臂。操作姿态只服务对应阶段及必要准备/收尾；核对复用场景/运动的进入、退出状态及有意连续性，不自动重置或让可见肢体跳隐。特殊动作的必要中间运动须有视觉证据，技术碰撞检查仅辅助。

省略解剖细节、最小代理块状风格本身不失败；已经显示的姿态按实际示范判断。无意的显著外展架肘休息态、反向肢体、明显穿身或无支撑握持若误导动作，属于可用性阻塞，不是审美偏好，也不能用粗参考免责。正常肩部连接和合理遮挡/投影重叠不要求零相交，不增完整解剖精度门禁。修法优先省略非必要肢体或调整合理姿态/机位/支撑，保住必要接触和剧情动作；明确未解冲突为 needs_revision，必要证据不足为 unknown，不以 pass 加“prompt 写自然”结案。悬浮、透明屏幕和遮挡仍按意图判断。

具体动作、姿势和表情由 shot prose 与模型负责；另审文字是否清楚、景别/角度是否支持最终动作可读，操作特写仍与盒体相容。环境/道具可保留镜头/布局所需几何；静态资产形状参考按其声明形状审核。详细外观遵循统一作品基线和实际资产。缺已声明媒体、必要输入不可读、指纹漂移或声明的必要轨迹无法评估仍为 unknown，独立审核与既有门禁不变。

图像 prompt 中的长度（如 cm）、角度及姿态细节默认是表达意图的指导，不是逐项精确验收指标；只有用户明确把该数值定为必要指标，或剧情机制依赖它时，才作为关键要求核对。此处不放宽配置、schema 或严格时长等真实契约。正面生成描述仍应保留有用的精确线索和数值，不为降低审核门槛删掉数字。

- 卡片写“20 cm 道具”，无可靠尺度基准时不能把像素换算成厘米，更不能从透视图声称测得精确长度或角度。人体与物体的相对尺度大体合理、拿取和使用可信，且无关键要求冲突，就此项应通过；缺少非必要测量基准不单独构成 unknown。若数值确为必要指标但现有证据无法核实，说明限制并保持 unknown，不猜测达标。
- 手臂角度、手指摆放或机位差异按本媒体用途判断，不损害身份、动作含义、使用功能或必要连续性时应通过。若当前材料明确承担指定手持有、够到机关或动作衔接，具体冲突仍须修正；仅用于身份/外观的资产图无需复刻逐镜姿态。关键动作在最终 prompt 与对应控制媒体的集成中核对，不能以“大致合理”或未来模型会修好放过实际冲突。

上述通过仍须满足实际看图、必要参考齐全、当前证据和独立审核前提；边界判断沿用 shot-input 的 pass/needs_revision/unknown，不另造状态。

## 意见示例

### 生成画面的方位判断

资产/shot 方位按 [通用视觉原则 6](visual-prompt-craft-common.md) 核对。定位实际歧义及影响：无机位依据使关键站位、光源或动作落点不明时指出，不扫关键词判失败。背景、对白、地名和仪器文字不机械改写，画面定位仍须明确。

比较实际视角；反打、转身或运镜的合理投影变化不是换位/换手证据。核对与身份、剧情或声明控制相关的同实体拓扑与必要连续性，不逐项强求无影响的结构细节一致。缺机位依据不编造左右；确为当前判断必要时交 owner。必要边界范围由独立 shot-input reviewer 根据故事选择，必要读取缺口为 unknown；不把文学背景改成摄影指令。

### 具体目标与连续性

粗参考不能替代完整 shot prose：按动作核对谁做什么、必要朝向/姿态、左右、归属、握持/接触及初中末变化，不做细节配额。ref.use 与最终 manifest.prompt 都须说明相机/取景/布局/整体轨迹控制，不照搬滑移、僵硬姿势、步态或代理解剖；最终 prose 按源动作表达自然行走的姿态、重心与迈步，不自动加手势。核对必要代理归属/握向，并评估媒体中的多余表演信号；强模型仍可能模仿粗运动，文字声明不是保证。

独立生成 TASK 边界优先选择已有、有动机且机位/视点/景别不同的切点，只减少近似生成不一致的显眼程度，不保证连续性；相似连续镜头可适当同组。不以每切一任务、角度阈值或有意重复构图判失败。保留连续成员、时长、provider 最大值和 grants，重设计交 Director/owner 在原始预算内同步源与下游，不借建议静默重组或改切点。

修正意见连接实际观察、制作影响与目标状态。材质意见可说明反射或纹理尺度如何影响已确认设计，再给出适用的表面表达；表演意见可说明观众需要感知的转折，再建议动作、声音或剧本已选择的内心独白。示例用于解释方向，最终表达由对应作者完成。

例如：“两端 shot prompt 的道具持有手不一致，会造成动作跳变；建议核实已确定终态并明确当前起始关系。”观察、影响与方向可验证，不替作者定稿。BOX MP4 核对位置、轨迹、轴线及必要支撑与动作的相容性，精细手部由 prompt/模型实现。纯构图偏好另列建议，不放入 blockers。

## 与其他共享规则的关系

- `output-language.md`：被规则 1 引用（语言一致性）
- `visual-prompt-craft-common.md` / `visual-prompt-craft-video.md`：
  - **visual prompt review skill** 出意见时引用这两份给具体改进方向
  - **narrative review skill** 出意见时不涉及（只引用本文件）

## 适用范围

| Review skill | 引用本文件 | 引用 visual-prompt-craft-* |
|---|---|---|
| reviewer-review-script / -outline / -arc | ✅ | ❌ |
| reviewer-review-storyboard | ✅ | ✅（视听表达与可生成性）|
| reviewer-review-shot-inputs | ✅ | ✅（最终输入包语义与必要时序，不审成片） |
| reviewer-review-asset-visual-single / reviewer-review-assets-visual | ✅ | ❌ |
| reviewer-review-asset-prompt-single / reviewer-review-asset-prompts | ✅ | ✅ |
