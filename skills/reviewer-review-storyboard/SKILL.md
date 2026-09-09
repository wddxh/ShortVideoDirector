---
name: reviewer-review-storyboard
description: 在分镜需要独立评估叙事、节奏、七字段契约和可生成性时使用。
user-invocable: false
agent: reviewer
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
---

## 输入

按 [shot-inputs](../_meta/rules/shot-inputs.md) 理解最终请求：Creator 在摄影设计后装组连续 shots，`task-inputs/taskNN.json` 恰为 `{shots,references}`，每生成任务至少一个全组 MP4，静态段可用 clip。摄影源保留七字段及完整动作/表情/声音。Storyboard 审核不依赖未来输入包；独立 shot-input 以 task manifest 审核最终集成/delta、内部切点/声音桥及必要外部边界，无冲突复用本轮叙事/摄影判断。

- 委托中的集数 ep、审核范围与保留要求；`story/episodes/{ep}/{script,storyboard}.md` 和实际配置（SVD_CONFIG 或 config.md）；outline 仅在存在且与任务相关时读取
- 本集资产清单对应的基础资产卡
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/{output-language,review-meta-rules,visual-prompt-craft-common,visual-prompt-craft-video}.md`

## 审核职责

评估单镜时长与可消费性时，跨切点对白遵循 [视听指南](../_meta/rules/audiovisual-craft.md)：本镜计实际发声占用，整句按连续窗口核算，续声通过同组起声段解析。核对两端明确的声音归属，完整原句由起声段承载一次。

Reviewer 独立负责 storyboard 语义验收；Creator 负责本地参考及 manifest，Storyboarder 保留镜头意图所有权，主 AI／Director 协调生产修订。逐项审核：

先按共享 review-meta-rules 确认独立新 Reviewer context。kind=`storyboard`，target=`story/episodes/{ep}/storyboard.md`。指定临时目录先存在，读取目标/script/config 前以显式 SVD_CONFIG 执行 `review-round.mjs start storyboard EP TARGET STATE [EXTRA_INPUT...]`；新参考卡/规划材料首次读取前 `add-input STATE PATH...`。局部意见仍须说明完整 storyboard 的验收范围，不能用局部 pass 冒充全文件通过。

1. Storyboard 按 [视听 craft](../_meta/rules/audiovisual-craft.md) 覆盖剧本节拍意义：初态、必要证据、先后/合理重叠与注意转移，不按动作条数或固定秒数验收。节奏和转场合理，对白原文与人物性格一致。
2. 整集 Shot 编号按 `1..N` 有序、唯一、连续；选镜检查允许缺号但源编号递增唯一、目标存在，不重编号。按 storyboarder-storyboard/rules.md 核对单镜、场景和整集预算，并批量运行 `speech-rate.sh`。整集验收实算所有 shot 时长合计与用户边界，局部通过不等于整集通过，不以前集实际时长改预算。超界交生产 Director 协调，不自行放宽。
3. 每个 shot 严格使用七字段；人物与 location/item/building 引用完整且路径有效。
4. Prose 可被单镜独立消费，写足影响理解的动作过程与终态、朝向、屏幕方向、持有状态和空间关系，不要求每段机械重复所有字段。
5. 视觉描述遵循共享 video prompt 规则，完整表达镜头动作、表情和摄影意图，并与 BOX 参考的控制范围区分。

核对 Creator 基线在各源 shot 的单行 `视频风格` 中表达并与配置相容。同组字段须精确相同，转换器在任务级输出原字段一次，仅从成员移除此字段；差异交 owner，局部变化留 prose，不模糊去重。详细动作、表情、对白与音效留正文，use 只说明控制用途；不要求未来分组先完成才能审核摄影稿。

语义判断由当前独立 Reviewer 完成，依据实际叙事、连续性和画面表达作出结论。

单镜可消费性以明确的局部事实及最终任务文本/实际 refs 为边界，剧本仅核对意图，审核者不补全模型缺失上下文。检查起始/终态、身份绑定和持有物可见特征，将“承接上一 shot”落实为姿态与空间关系。场次预算/制作说明留 shot 外。源保留七字段；转换保留 heading、其余字段、对白、空格、续行和 prose，仅提取共同风格、绑定声明引用及重基行首结构 bracket cues。源 cues 为镜内时间，最终 prompt 明示 bracket cues 为任务时间，inline elapsed times 仍属具名 shot 本地时间；媒体与声音桥遵循同一派生时钟。

按摄影 shot 契约审核 prose 与声明资产，不假定未来媒体补齐事实。最终包另核对 converter 文本及 references；每镜链接须自身 header 声明，不能借同组其他成员合法化，裸名词不机械匹配。转换器除共同风格提取、引用绑定和结构 cue 重基外保留内部文字，成功不等于语义验收。部分生成组选镜报告完整成员及额外镜头，不静默扩授权。

摄影选择按 [摄影知识](../storyboarder-storyboard/camera-language.md) 服务观众此刻要理解或感受到的内容，判断调度/覆盖与焦距、距离、焦点能否保住必要证据和注意顺序，不另套镜头清单。声音、内心声、停顿和画面反应共同支撑体验。用户原始集目标已确认的 ±10% 是 owner 可主动分配的预算，不以偏离旧计划本身判错；核对当前 canonical script/storyboard 同步、真实整集边界和精确要求，基准不滚动。

逐摄影 shot 按正整数秒、叙事与真实表演承载、用户单镜限制、场景/整集预算及固定镜头数验收。Provider 最短时长和 70% 效率目标不约束摄影 shot；模型未定本身不阻塞摄影时长审核。设计完成后 Creator 核实模型最大时长 M，以 `ceil(0.7*M)..M` 为生成任务语义装组目标，并对整个任务核对实际 provider 边界。场景容差不扩大用户整集严格边界，系列沿用初始共同预算。

`speech-rate.sh` 实际接收 `"起秒-止秒:slow|normal|fast:台词"` 的逐段参数，输出 OK/OVER 与速率，不解析 storyboard 文件，OVER 也不以非零退出表示。保留真实台词与时间段并读取输出，结合表演、呼吸与反应空间判断。`scene-duration.sh` 只累加“目标时长”，不能用它代替 shot“时长”的整集合计。

短镜按表达价值判断，不因短于生成任务目标或 provider 最短时长判失败。Creator 装组保留当前 canonical 时长、对白和切点，统一参考时钟与声音衔接；装组本身不延时。具体碎切问题先说明观众理解的损失，再给可选修法交 Storyboarder，无法合理装组交负责人在原始用户预算内协调重设计，不自动改固定镜头数、模型或用户基准。

### 当前指令与表演的证据

按通用原则 6 检查当前机位的画面方向、纵深及角色自己的左右，世界方位不替代可见位置。反打、转身和运镜可改变屏幕投影，保持实际调度与持有关系，不跨角度锁死画面左右。报告有制作影响的歧义，不对对白、地名或背景中的方向字机械判错。

以最终 prompt 和实际 refs 判断观众能看到、听到什么。年份、罗盘方位与制作预算保留在适用元数据中；观众确需识别的事实由负责人选择已有设计支持的可见或可听证据。皮肤、服装、册页等直接描述当前状态，注意力变化通过视线和动作表达，保持实际站位与持有关系。

声音审核区分稳定音色/口音和可变化的临场表达。青年镜头夹带老年声音备选、把常态3-4字/秒或“音高幅度小”锁定整场，都会让实际表演指令失配。对白、自语、内心声的重要节拍应有说话对象、想法/态度与触发，以及可听的表达依据；仅“温和询问／带期待／认真”不足以说明变化，但不以缺哭腔、耳语或停顿判错。

按本镜实际时长核对说话、倾听、呼吸与动作是否能完成，允许有依据的重叠；配速通过和场景总预算都不能证明本镜可拍。报告具体超载或冲突，由负责人协调内容与时长；不默认延时、改台词或机械加速。反馈说明文本中的实际风险，不冒称已听过生成音频。

## 输出

start 返回 `reviews/{ep}/storyboard.md` 与轮号。仅同一 ep/kind/target 重审串行，每轮 scope=[target]、恰好一个完成 result。

在指定临时 PAYLOAD.json 写 `{"commentary":"逐 shot 意见与依据","result":{"status":"pass","blockers":[]}}`，按实际判断填写状态/阻塞。运行 `review-round.mjs finish STATE PAYLOAD.json`；helper 复核输入、注入 target/inputs 并验证完整记录。正常完成不要求立即重读全文或再做指纹检查。

```markdown
### 通过依据
```

或：

```markdown
### 需修改意见

1. **shot {N}：** {问题} → {方向}
```

返回 finish 的 path/round/status/input_count/evidence_issues 和必要意见；exit 0 仅表示写入成功，M 仅计阻塞项。保留逐 shot 意见给修复者；仅写受托 canonical 记录和指定临时 payload/state/预览，不调度修复。局部子审核按共享规则在委托读取前采集参考，实际观察与限制回独立 owner；最终结果回委托方，由 Director 协调修复。
