# ShortVideoDirector

以 Claude Code 为主要目标，提供 OpenCode/Codex 适配的短视频创作插件。`skills/` 是唯一人工维护的知识源；OpenCode 转换到 cache，Codex 使用生成 wrappers。源码契约不等于 live-host 验证。

## 角色与所有权

| 角色 | 所有权 |
| --- | --- |
| Director（顶层制作主 AI） | 本地加载 director-orchestrate，诊断委托、直接协调创作与用户决策，对材料整体连贯性负责 |
| Reviewer（独立子代理） | 在全新上下文验收材料，只写受托记录及指定临时 state/payload/预览 |
| Scriptwriter | 原创/改编可拍剧本、人物动机与语言、本集资产清单 |
| Storyboarder | 七字段 shot、摄影、动作意图与时长 |
| Creator | 作品美术、资产身份图、本地参考与 manifest、provider 能力和授权执行 |

制作时主 AI 就是 Director，负责用户沟通、授权和创作协调，可直接编写自己的完整剧情候选与规划。工程时主 AI 作为工程负责人委托工程代理研究、实现、配置与测试。Skill 只加载知识；专家和 Reviewer 的实际委托使用 Task，提供成果、路径、范围、约束与决策余地，不指定固定技能链。

专家/审核协调者在嵌套支持时直接委托；工具不可用或明确深度拒绝后复用已知限制，由主 AI 忠实转交 role/outcome/references/scope/constraints，将实际结果回原专家、审核协调者或 checker 任务。普通失败不代表深度拒绝，不提高宿主深度。后续视觉操作仍全新任务；缺必要角色或独立上下文时阻塞，不冒充或自审。

## 安装

```bash
claude --plugin-dir /path/to/ShortVideoDirector
```

OpenCode 配置 `~/.config/opencode/opencode.json`：

```json
{"$schema":"https://opencode.ai/config.json","plugin":["short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"]}
```

详见 [OpenCode](.opencode/README.md) 与 [Codex](.codex/INSTALL.md)。源码更新后退出重启宿主，核对实际插件与 cache 路径。需要 Bash、Node.js、Python 3；图像 helper 需要 Pillow，本地 MP4 按方法需要 Blender/FFmpeg；付费生成需要可用 Dreamina CLI。安装/升级仍须实际授权。Claude 模型提示按源 frontmatter；OpenCode inherit，Codex 使用当前活动模型。
## 使用与授权

```text
/short-video 一个外卖员送错餐发现客户是自己的前女友
/series-video story-idea.txt
/short-video config
/edit-story ep01 镜头3的动作不清楚，请局部修正
/repair-story ep03
/generate-video ep01 镜头3 镜头5
/check-video ep01
/auto-video ep01
```

七个入口整体理解自然语言、文件和范围，不是位置参数协议。目标歧义不默认最新/全部。short 固定 ep01；series 每次一集，新系列确认总集数，明确续作才选择下一集。配置查看不初始化、不生成。

short/series 请求包含所需新增资产图和本地参考，intake/当前审核满足后连续执行，始终停在付费视频提交前。后续手动 generate-video 的实际请求和条件登记为 initial_authorization，无额外批准握手。仅准备任务不提交；重试需真实 retry_authorization，仅用户指定次数时设上限。不从监控、review pass 或生成意图推断无限重试。

用户关键选择尽量前置；Director 自编计划直接呈现并保留完整答复，不做自我 relay。专家给齐完整问题计划、标签、背景与条件分支，主 AI 沿题界完整展示当前题后原生单选，相关原始答复和全部条件批量回原专家任务。已定/继承/明确委托项不重问。范围内修复和独立重审无需逐轮批准；仅缺权限、关键冲突或用户检查点升级。细则见 [决策转交](skills/_meta/rules/user-decision-relay.md)。

outline/arc 按用途采用。用户要求预审时，在 canonical config 的 `制作前确认 epNN` 保存材料范围、真实 approval 与指纹；未知类型、缺失、未批准或变化则先停正式制作，不静默过滤或自动批准。独立质量验收不替代用户批准。用户小说、章节和节选按实际路径与采用范围交 Scriptwriter 改编，源文保持原样。缺 script 资产清单请 Scriptwriter 接纳已有剧本补齐，不重做故事。

## 项目文件

按 [项目布局](skills/_meta/rules/project-layout.md) 区分当前材料、决策依据与临时工作：候选在 `story/planning/plot-options.md`，临时交接在 `story/work/epNN/<work-unit>/`，共同美术基线推荐 `references/design/art-direction.md`。委托前指定精确输出路径；简单任务可只回文本。既有单集材料、共享资产、可编辑参考与工具记账路径保持稳定，按需建文件，不批量迁移。可选 `story/README.md` 只导航到真实当前来源，不复制验收、授权或状态账本。

## 生成任务输入

摄影 shot 保留七字段和正整数秒，按叙事/剪辑设计，不受 provider 最短时长或 70% 目标约束。Creator 在设计后将连续 shots 装组，核实模型最大时长 M，以 `ceil(0.7*M)..M` 为任务语义目标而非机械下限，并校验实际 provider 边界。装组保留当前 canonical 时长、对白和切点；需重设计时由 Director 协调 owner 主动使用用户原始集目标已确认的 ±10% 创作预算、同步 script/storyboard 与受影响下游，无需范围内逐次许可。原始基准不随修订合计滚动，精确要求/严格范围优先。

每个生成任务有 `story/episodes/{ep}/task-inputs/taskNN.json`，文件名给稳定 task_id，独立于首成员。以下是仅供材料准备的草稿：

```json
{"shots":[1,2],"references":[{"kind":"local","media":"video","path":"references/task01/motion.mp4","use":"Control camera, framing, layout and overall trajectories on the task timeline, including the internal cut; proxy sliding, stiff pose, gait and anatomy are placeholders, not final performance","sources":["references/task01/scene.blend"]}]}
```

草稿顶层恰为 `{shots,references}`，最终恰为 `{shots,references,prompt}`，prompt 为 Creator 写入的非空白字符串；草稿不通过最终审核/就绪。成员为按源顺序连续的正安全整数；条目仅 local PNG/MP4，每任务至少一个全组时间线 MP4，可辅以 PNG。静态段可用静态 clip。资产图提供身份，BOX 控制相机/取景/尺度/位置/整体轨迹；动作、姿态、表情与声音保留 prompt。Creator 对齐任务参考时钟、内部切点及声音桥，use 说明控制权限和占位边界。

Sources 是真实可编辑工程/脚本及所需输入，只作编辑/审核，不上传；路径限定项目 references/。Creator 按需使用 Blender/2D/FFmpeg 与可选假音频预演。普通移动只用无手腿 BODYBOX；仅既定持有/支撑/接触或具体必要动作/构图证据使用最小代理，保留身体出画时防止手持物悬浮的手/前臂。普通行进中必要肢体相对身体稳定，整套平移/转向，不推导步态、腿部循环或摆臂；受托特殊动作确需时序证据且 Creator 明确选择才关节化。缺解剖不自动补动画，缺必要支撑的实际冲突仍须修正；悬浮/透明屏幕按意图判断。默认无完整 rig、精细手指、脸部动画或 TTS/表演验收。内部标注/假音频默认不上传，不建 DSL。基础/衍生卡可选 PNG，见 [卡片契约](skills/_meta/rules/local-reference.md) 与 [工具知识](skills/creator-local-reference/tools.md)。

粗参考仍需详细 shot prose：谁做什么、必要朝向/姿态、左右、归属、握持/接触及初中末变化，不设细节配额。ref.use 与 Creator 最终 manifest.prompt 都说明相机/取景/布局/整体轨迹控制，不照搬代理滑移、僵硬姿势、步态或解剖；最终 prose 按源动作写自然行走的姿态、重心与迈步，说明必要代理归属/握向，不自动加手势。强模型也可能模仿粗运动，文字不保证忽略它，应先减少媒体中的非必要表演信号。

独立生成 TASK 边界优先已有、有动机的明显机位/视点/景别切换，减少近似独立生成不一致的显眼程度，不保证连续性；相似连续镜头适合时同组。不要求每切一任务或角度阈值，保留有意重复构图、连续成员、时长、provider 最大值和 grants。源重设计交 Director/owner 在原始预算内同步，不静默重组受保护任务或改切点。

创作材料由所选 provider 的自有工具提供，具体命令、pack、引用 token 计数/绑定与时间重基见该 provider 文档；Dreamina 见 [视频材料工具](skills/creator-provider-dreamina/video.md#dreamina-authoring-materials)。草稿可供材料准备，不表示就绪。Creator 在审核前对照 canonical 源、provider 工具输出及实际 refs 创作语义 prompt。共享 assembler 仅提供无 provider token 的内部数据，不是公开通用 adapter；未来 provider 自行实现材料工具，无需 registry/framework/manifest schema 变更。Header 身份图首次使用求并集后接本地媒体，每镜链接须自身 header 声明。

Creator 在视频参考/装组映射确定后读材料及 provider 语法，写完整任务时间 prompt，保留叙事/动作、对白原词、切点、时长和声音，绑定实际 tokens 并说明 BOX/身体/肢体代理的最终身份、解剖与动作。去掉内部 task/shot IDs、路径及审核元数据，正常 wide shot 等摄影词可用；缺源事实交 owner，不编造 use。最终 `--json` 要求非空白字符串，返回 `{task_id,shots,timeline:[{shot,start,end}],prompt,duration,references,assetCards,sources,inputPath}`，prompt 原样来自 manifest。Creator 自查该输出后交 fresh shot-input Reviewer 验收忠实度、完整性及集成，提交不重写。无可编辑 offset/duration、装组副索引或单独最终提示文件。见 [精确契约](skills/_meta/rules/shot-inputs.md)。

## 审核与连续性

证据 kind 仅 script、storyboard、asset-prompt、asset-visual、shot-input。最终就绪要求 script/storyboard/asset-visual/shot-input；新生图另须当前 asset-prompt。整集覆盖 script 清单全部资产与实际镜头，局部 scope 包含所选 header 资产。使用同一 canonical SVD_CONFIG：

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" ep01
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" check ep01
```

整集源编号 1..N，每镜恰分配一次，任务按首成员排序；局部允许源缺号但递增唯一、目标存在且选完整组。全局检查声明组重叠/缺失源成员，局部不要求未选媒体或完整全片计划。未分配请求/部分选组报告完整成员及额外镜头，不静默扩授权。submitted 按 recorded ID/provider 取回，缺 ID 保留状态待核实。接口不相容交主 AI/general。

独立 shot-input target 为 task manifest，审核最终 prompt/media 集成、变化细节、任务时钟、内部切点/声音桥及故事必要相邻/非相邻/跨集边界；无具体冲突复用 storyboard 判断。比较位置、轨迹、状态、轴线与身份，实际依赖入 inputs，不给每项媒体附全计划哈希。源码/记账变而媒体未变可独立 scoped 兼容性评估，有依据续签，不盲刷哈希或自动全量重审。缺必要证据 unknown。

每次视觉操作（渲染、查看、修订、审核、采样/crop）使用全新 task、helper 缩略图和最小必要图集/配对。只 Read review-image.py 返回 preview，原媒体用于上传与指纹。必要 crop 另开任务，披露 MP4 查看方法、采样时刻与覆盖限制。原图不直接 Read；首尾静帧不证明完整轨迹。见 [visual-context](skills/_meta/rules/visual-context.md)。审核者只写受托 canonical 记录及指定临时 state/payload/预览；生产 Director 不聚合写 pass，无独立上下文则阻塞。

审核集中在 `reviews/epNN/`，每个 target/kind 有独立文件。无读写/输入依赖冲突的就绪视觉目标并行审核并直接写各自文件；相干纯文本批次也逐 target 分别落盘。同一 ep/kind/target 写入串行是输出所有权规则，其他读写/输入依赖仍须排序；范围协调只统计覆盖与结果，不另建合并账本或汇总任务。asset-prompt 只覆盖授权新增/重生集合；图片操作仍逐次新任务、缩略图优先。

五种 runtime review 默认用 [review-round](skills/_meta/rules/review-meta-rules.md)。指定 `/tmp/opencode/<task>` 目录先存在，STATE 与 PAYLOAD.json 为其中不同绝对路径；在故事项目根执行：

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" start KIND EP TARGET STATE [EXTRA_INPUT...]
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" add-input STATE PATH...
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" finish STATE PAYLOAD.json
```

start 在读取制作材料前绑定显式配置与原始哈希；新语义参考先 add-input 再读。Reviewer 独立撰写 `{commentary,result:{status,blockers,...}}` payload，helper 注入 target/inputs，复核依赖并验证 canonical 记录，不手填哈希 JSON。采集/发现错误保留，漂移保留首次哈希且 finish 记 unknown；缺显式 status 的 payload 无效。STATE/payload 仅在指定临时目录，不建工作区副账本；可选规划 Markdown 不用此 helper。

finish 的 exit 0 仅表示记录写入。实际 path/round/status/input_count/evidence_issues 与必要意见足以回传，正常完成不要求立即重复 fingerprint、check-target 或全文 Read；错误/诊断按需查，下游门禁不变。局部视觉 delegate 由独立目标 owner 在委托读取前采集所需参考，回传实际观察/路径/限制；新参考先采集再交 fresh task，不以后采快照追认，不需 import registry。独立语义判断、逐目标并行及全新视觉任务/缩略图仍必需。

## 配置与执行

配置相关操作先用 `review-evidence.mjs config-path` 规范化 SVD_CONFIG，未设才用 config.md；只支持项目内配置。命令、Task/relay、approval 与指纹使用同一路径。纯 recorded-ID 取回不经过配置/readiness gate。

Creator 只读当前 CLI version/help，核实操作组合和已接入能力，不维护模型表、不付费探测或自动升级。技术选择仅 images/video 的 provider/model/ratio/resolution；固定值绑定，空值/auto 不授予选择权，任务选择不升为默认。用户选定模型后不额外检查账号权益/余额，不为省钱降级；实际失败和用户明确限制仍处理。

Series 从全部 canonical episode tasks 的一致 submission 继承视频四元组；short 共用整集 ratio/resolution。缺项/冲突阻止准备与付费，不阻止取回；不补造快照。系列准备串行，本集锁不保证跨集事务。系列沿用用户初始集时长目标，不按前集实际漂移；单值初次确认 ±10%，严格值/范围优先。

```text
image-gen-dreamina.sh [--force] PROMPT OUTPUT RATIO RESOLUTION MODEL REFS SOURCE
generate-images-dreamina.mjs [--force] [--concurrency N] JOBS.json
storyboard-to-prompt.sh --json STORYBOARD TASK_ID EP
video-gen-dreamina.sh --references-json PROMPT OUTPUT REFERENCES_JSON DURATION RATIO MODEL RESOLUTION
video-check-dreamina.sh ID OUTPUT
```

接口只供已授权角色调用，不是绕过证据的指令。image2image 实际 API 的 `--images` 仍接收逗号分隔路径。视频 flag 后七参数，使用 typed refs 上传原始有序 PNG/MP4；capture 保存四元组及媒体 SHA-256。重试保留原输入，不静默 resolve/capture。Wrapper reserve 原子持久化 inflight，settle 保存实际结果；未知 intent/锁人工核实，不按年龄删除，submitted/done 不刷新或自动重提。

上述通用 converter 的 `.mjs` 与 `.sh` 均使用 `--json STORYBOARD TASK_ID EP`，不生成或改写 prompt；EP 与 canonical storyboard 路径一致。tasks.json 保持数组，task_id 唯一并保存 shots/prompt/duration/references，prompt 是最终 manifest 原文，输出 `videos/taskNN.mp4`；submission 保存四元组和有序媒体指纹。既有 shot-input target 指纹绑定最终 prompt。Initial/retry grants 为 `{decision,episode,task_id,shots,constraints}` 加真实可选重试次数。Gate/reserve 比较最终 manifest 的 prompt/duration/references，不比较源拼接文字；付费前 manifest 成员等于 record/grant，错误身份、成员/输入漂移或部分组选镜零调用、不改次数。已提交/完成及 inflight 继续保护。

## 恢复与监控

资产图片批次使用 runner，jobs 含 source/output/prompt/images/settings。默认本地并发 5，由 Creator 按实际接入限制调整；只等待真实引用依赖，不 shell 并行 raw 调用绕过保护。首次失败/pending 停止新启动并排空 active，保留全部成功、IDs 和未启动旧图。Force 只作用于明确授权 target，调用方不预删图。

Pending/receipt 按已登记 provider/ID/settings 恢复，先 settle 再移除匹配 pending；未知结果或取回失败不重提。普通图片同范围质量修复无默认轮数上限，明确用户限制优先。基础资产提交丢 ID 的有限恢复规则须经过 owner 核实，见 [图像执行](skills/creator-provider-dreamina/image.md)。

| 视频查询结果 | 行为 |
| --- | --- |
| success / 0 | 同一 ID 下载成功，记 done |
| querying / 1 | 正常等待，保留 submitted/id |
| fail:reason / 0 | 记录实际生成失败 |
| error:reason / 2 | 保留 ID 重试取回，不付费重生 |

Done 仅表示下载，不表示质量通过；已有 MP4 不能证明当前任务完成。监控只在用户要求或已同意默认时启动；首次/周期均保留真实 Creator relay、grants 和 inflight 保护。仅有效、目标匹配的末行 JSON 决定停止；all_complete 可含 human_needed，不代表全部成功。监控不创作修复、自动授权或审片。视频仅提交/查询/下载，由用户判断成片，不自动剪辑合成。

首次和周期 checker payload 均显式携带 canonical config_path 或 UNRESOLVED，并沿 Creator relay 保留。UNRESOLVED 只允许取回并报告 human_needed，空值是传输错误，不选择默认配置；配置操作显式验证绑定路径并共用 SVD_CONFIG。查询/监控按生成任务计数，human_needed 为 `{ep,task_id,shots,reason}`，每 ep/task_id 一条完整成员；monitor scope 仍 epNN/all。

## 维护与验证

源角色在 agents/，知识在 skills/，工程接口在 scripts/。修改后运行 Codex 生成器及 --check，核对 git diff --check；生成层不手改。Mechanical checks 不证明艺术质量、任务隔离或 live-host E2E。当前安装的接口、provider、relay 与监控行为须单独验证；退出重启宿主后确认实际源与 cache。未满足契约的代码问题留给主 AI/general 工程处理，不让创作角色绕过门禁。
