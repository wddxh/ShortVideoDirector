# Codex 安装说明

Codex 通过 `.codex-plugin/plugin.json` 加载 `.codex/skills/`；Claude Code 直接读取 `skills/`。源 skills 是唯一人工维护层。Wrappers 只含元数据、[运行时映射](tool-mapping.md) 和源文件指引，不复制正文，不手工编辑。

源集合、元数据或映射改变后生成并检查：

```bash
python3 .codex/build-codex-skills.py
python3 .codex/build-codex-skills.py --check
```

生成器按当前源集合重建 wrappers。七个入口为 series-video、short-video、edit-story、repair-story、generate-video、check-video、auto-video。宿主原样传 `$ARGUMENTS`；整体理解自然语言，不拆位置参数。缺目标不默认最新/全部，配置查看只读。

## 角色与工具

制作主 AI 本地加载内部 `director-orchestrate`，作为 Director 直接负责用户交互、创作协调、范围与授权，不创建 Director 子任务。Task/Agent 按运行时映射建立四个真实专家上下文，读取 `agents/<role>.md`，传成果、路径、范围、约束和决策余地。Scriptwriter 拥有原创/改编剧本与清单，Storyboarder 拥有镜头，Creator 拥有资产、本地参考及 manifest，Reviewer 独立验收。九个 reviewer-review-* 技能归独立 Reviewer。工程主 AI 委托工程代理研究、实现、宿主配置和测试；Skill 不建立角色隔离。

专家/审核协调者在嵌套支持时直接委托；工具不可用或明确深度拒绝后复用结论，由主 AI 忠实转交 role/outcome/references/scope/constraints，恢复原专家、审核协调者或 checker task 并送回实际结果。普通失败不算深度拒绝，不反复探测或调高深度。独立审核使用全新 Reviewer task，不继承生产历史；每次视觉操作均新任务、helper 缩略图和最小比较集，不恢复 image-heavy task。无法隔离则 unknown/阻塞，不自审。模型与 allowed-tools 元数据是提示，实际能力由宿主决定；使用当前活动模型。每次手工写入含 apply_patch 不超过 2000 字符，不限制总长度。
## 当前制作契约

摄影 shot 保留七字段及正整数秒，不受 provider 最短/70% 目标约束。Creator 设计后将连续 shots 装组，按核实模型最大 M 以 `ceil(0.7*M)..M` 为语义目标而非机械下限；保留时长、对白和切点，不延长场景/整集。`story/episodes/{ep}/task-inputs/taskNN.json` 使用 [输入契约](../skills/_meta/rules/shot-inputs.md)：草稿恰为 `{shots,references}`，最终恰为 `{shots,references,prompt}`，prompt 为 Creator 编写的非空白字符串。文件名给稳定 task_id，每任务至少一个全组 MP4。资产图首次使用求并集在前，BOX 控制相机/布局/整体轨迹，静态段可用静态 clip；sources 不上传。

所选 provider 自有材料工具支持草稿准备，具体命令、pack、token 计数/绑定与重基规则见该 provider 文档，Dreamina 见 [video.md](../skills/creator-provider-dreamina/video.md#dreamina-authoring-materials)。共享 assembler 仅提供无 provider token 的内部数据，不是公开通用 adapter；未来 provider 自行实现工具，无需 registry/framework/manifest schema 变更。各镜链接须自身 header 声明。Creator 在视频参考/装组映射确定后、审核前据 canonical 源、provider 工具输出及实际 refs 写完整语义任务时间 prompt，保留叙事/动作、对白原词、切点、时长/声音及实际引用/身体肢体代理映射，去掉内部 IDs/路径/元数据；缺源事实交 owner。

最终 `--json` 返回 task_id/shots/timeline/prompt/duration/references/assetCards/sources/inputPath，prompt 原样来自 manifest。Creator 自查实际输出后交 fresh shot-input Reviewer 审忠实度、完整性、集成及边界；target 指纹绑定 prompt，草稿不通过最终审核/就绪。tasks.json 原样存 prompt，gate/reserve 比较最终 manifest 而非源拼接文字，提交不重写。时间派生，无可编辑 offset/duration、装组副索引或最终提示文件。

结构诊断使用 `scripts/check-shot-inputs.mjs EP [SHOT...]`，完整就绪使用 review-evidence check；五类 evidence 为 script/storyboard/asset-prompt/asset-visual/shot-input。最终就绪要求 script/storyboard/asset-visual/shot-input，新生图另须 asset-prompt。无读写/输入依赖冲突的就绪目标并行审核，写 `reviews/epNN/` 下各自的 canonical 文件；同一 ep/kind/target 写入串行是输出所有权规则，其他读写/输入依赖仍须排序。范围协调统计各文件结果，不另写共享账本或汇总验收。

独立 shot-input target 为 task manifest，审核最终集成/delta、任务时钟、内部切点/声音桥及必要相邻/非相邻/跨集边界。最小配对比较 prompt/MP4 的位置、轨迹、状态、轴线与身份，实际依赖入 inputs，不附全计划哈希；无具体冲突复用 storyboard 判断。缺必要输入 unknown，保留五种 kind，不自动递归重渲染。

整集源编号 1..N 且每镜分配一次，任务按首成员排序；局部允许源缺号、目标存在且选完整组。全局检查组重叠/缺失源成员，局部不要求未选媒体或完整全片计划。未分配/部分组报告完整成员及额外镜头，不静默扩授权。

short/series 包含必要资产图与本地参考，并停在付费视频提交前。后续手动 generate-video 实际请求登记 initial grant。新提交/重试使用实际输入及真实 grants；已提交任务按记录的 ID/provider 查询下载。pending/receipt、次数、locks、inflight 与 submitted/done 保护贯穿执行。

tasks.json 保持数组，task_id 唯一并保存 shots/prompt/duration/references，输出 videos/taskNN.mp4；grant 为 `{decision,episode,task_id,shots,constraints}` 加真实可选次数。Reserve 前 manifest/record/grant 成员一致，错误身份、漂移或部分选组零调用、不改次数。视频 wrapper 为 `--references-json PROMPT OUTPUT REFERENCES_JSON DURATION RATIO MODEL RESOLUTION`，flag 后七参数；capture 保留 `{provider,model,ratio,resolution,references:[{media,path,sha256}]}`。模型能力用当前 help 核实。

通用 converter 两入口使用 `storyboard-to-prompt.sh/.mjs --json STORYBOARD TASK_ID EP`，要求非空白字符串 manifest.prompt，原样返回而不生成或改写文本。显式 EP 与 storyboard 路径一致，生成 task_id 独立于首镜和宿主代理任务 ID。

## 审核轮次

五种 runtime review 默认使用 [review-round](../skills/_meta/rules/review-meta-rules.md)。先建立指定 `/tmp/opencode/<task>` 目录，STATE/PAYLOAD.json 为其中不同绝对路径；在故事项目根执行：

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" start KIND EP TARGET STATE [EXTRA_INPUT...]
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" add-input STATE PATH...
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" finish STATE PAYLOAD.json
```

start 在阅读制作材料前绑定显式配置及首次哈希；新语义参考先 add-input 再读。Reviewer 独立撰写 `{commentary,result:{status,blockers,...}}` payload，helper 注入 target/inputs，复核依赖并验证 canonical 记录，不手填哈希 JSON。采集/发现错误保留，漂移保留首次哈希且 finish 记 unknown；缺显式 status 的 payload 无效。只写受托 canonical 记录及指定临时 state/payload/必要预览，不建工作区副账本。可选规划 Markdown 不用此 helper。

finish exit 0 仅表示记录写入；实际 path/round/status/input_count/evidence_issues 和必要意见足以回传。正常完成不要求立即重复 fingerprint、check-target 或全文 Read，错误/诊断按需查，下游 gates 不变。局部视觉 delegate 由独立 owner 在委托读取前采集必要参考，返回实际观察/路径/限制；新参考先采集再交 fresh task，不以后采快照追认，不需 import registry。独立语义判断、逐 target 并行及全新视觉任务/缩略图仍必需。

## 路径与监控

故事文件遵循 [项目布局](../skills/_meta/rules/project-layout.md)：canonical 单集材料、共享资产、references 与工具记账保持稳定；当前候选在 `story/planning/plot-options.md`，临时交接在 scoped `story/work/`。委托前指定精确输出路径；简单任务可只回文本，按需建文件，不要求迁移或重复状态账本。

Codex 插件进程提供 CLAUDE_PLUGIN_ROOT。Shell 展开该变量；文件工具需先取得实际绝对路径，不能读取字面变量。源 skill 的相对指南按源目录解析，故事文件相对工作区。配置用 `review-evidence.mjs config-path` 规范化实际 SVD_CONFIG，相关命令/委托/指纹共用该路径；纯 recorded-ID 取回绕过配置门禁。

auto-video 按运行时映射优先使用 Codex automation，只有用户要求或已同意默认才启动。不可用时说明限制，可手动或按真实授权外部周期委托 checker，不自行编造宿主能力。首次/周期调用都保留 Creator relay 和当前输入契约。仅有效、target 匹配的末行 JSON 决定停止；all_complete 可含 human_needed，不表示全成功。

Querying/1 是等待；error/2 保留 submitted/id 并重试同一 ID 取回，不付费重生下载失败。Done 仅表示下载；成片由用户判断，不自动审片/合成。具体安全与恢复接口见 [主 README](../README.md)。

用户问题按运行时映射完整展示当前题，再用当前模式可用 request_user_input；不能容纳全部选项时说明限制并保留标签和选项文本，不改模式/权限。Director 自编完整计划和答复本地保留，无自我 relay；专家包保留全部标签、背景、选项/解释及条件，相关原始答复批量回原作者任务。

查询/监控按生成任务计数；human_needed 为 `{ep,task_id,shots,reason}`，每 ep/task_id 一条完整成员。Monitor scope 仍 epNN/all，首次/周期 payload 和 Creator relay 显式传 canonical config_path 或 UNRESOLVED；未解析只取回并报 human_needed，空值为传输错误，配置操作显式验证绑定路径并共用 SVD_CONFIG。

## 验证边界

生成器 --check 只验证 wrapper 集合/内容与源同步，不启动 Codex，也不证明任务隔离、relay、automation 或创作质量。当前 live-host 行为须在实际宿主验证。退出重启后核对实际安装路径和源集合；不把本地机械检查称为完整 E2E。
