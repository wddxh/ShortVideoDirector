---
name: storyboarder-storyboard
description: 在剧本需要镜头设计、空间调度或可生成性诊断时使用；保留七字段 shot 与完整视听描述。
user-invocable: false
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill
model: sonnet
---

## 输入

- 委托本集的 `story/episodes/{ep}/script.md`
- 已有 outline 或邻集剧本仅在理解意图、承接关系时选择性读取，不是必备输入
- 实际配置（`SVD_CONFIG` 指定路径，否则 `config.md`）
- Creator 提供的作品美术基线及必要参考；在各源 shot 的 `视频风格` 中表达一次，不依赖转换器补写
- 本集资产清单对应的 `assets/**/*.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-video.md`

## 委托上下文

- 从委托确定本集 ep、预期成果、可写范围和需保留的镜头；路径中的 `{ep}` 只是示意。信息冲突时先澄清，不默认最新集或全篇重写。

## 职责

跨切点声音按 [视听指南](../_meta/rules/audiovisual-craft.md) 处理：每镜只计实际发声占用，整句按同组连续窗口估时，续声通过同组起声段解析。完整对白只保留一次。

加载本 skill 是补充当前负责人的本地专业知识，不转移角色或启动下一项委派。按委托选择诊断、复用或创作；独立验收由 Director 另行委派，作者自检不能代替。

把剧本忠实翻译为 `story/episodes/{ep}/storyboard.md`。以下是设计检查视角，不是必须依次执行的工序；可从最有风险的动作、对白或空间关系入手：

- 节拍与预算：按视觉节拍和对白边界设计覆盖；主动使用用户原始集目标已确认的 ±10% 创作预算，必要时协调 Scriptwriter 更新场景分配，再同步分镜及受影响下游。范围内不逐次求许可，场景容差不额外扩大集边界，精确用户目标优先。
- 交付格式：每个 shot 有固定七字段和完整的 `画面与声音描述`。
- 视点与镜头：按 [视点、镜头与连续性](camera-language.md) 选择 POV、过肩、外部观察或细节，以景别、角度、视线和有动机运动让关键动作可读。无论参考有无肢翼或是否演细节，prose 与 Creator 最终 prompt 始终依源完整写主体/部位归属、必要准备/执行/收尾、接触变化与初中末，不编动作或设每帧配额。SVD 粗模只制作整体站位/移动、摄影/运镜、空间、光照、转场和时钟，不制作手臂、手掌、翅膀或精细机构动作。已有粗动画优先省去信号后复用，不省文字；官方建议 7 对带肢翼另强调模仿风险，不是完整性条件。细模/静态形状及独立 action reference 按 purpose 保留，也不免最终源语义完整，不倒逼补代理或细 rig。
- 视听表达：明确关键动作过程与终态，以及影响理解或衔接的朝向、屏幕方向、持有物和空间事实。每个 shot 可独立理解，不要求每段重复全部空间字段。
- 当前证据：把必要故事信息落实为当前可见/可听指令；非成片年份方位、前情与预算留在元数据。按 [转场与片中文字](../_meta/rules/transition-craft.md) 选择动作、声音、场内 UI、观众 SUPER、时间/地点/章节卡或转场图像，保留源原词、时间事实与揭示顺序；不为逐条背景事实增造装置或叙事。分镜负责阅读窗口和切点，独立卡计镜头数与时长，叠字不重复计时。
- 表演：区分当前年龄的稳定声音身份与临场重音、呼吸、节奏、音量和音高；按说话对象、想法/态度与触发写可听变化，不只标情绪。原文、倾听与动作共同占用本镜预算，放不下就报告，不静默延时或改台词。
- 剧本保真：保留节拍的起始状态、必要证据、先后/重叠与注意变化，不以动作数量替代意义。对白、资产或场景分配需改变时交 owner 协调更新剧本，不在分镜中暗改。
- 写入边界：仅受托分镜。资产、本地参考和 manifest 由 Creator 负责。发现剧本对白、节奏或清单矛盾时，报告定位、影响和跨负责人建议，不静默改写。
- 已有资产选用：按 [补引闭环](../_meta/rules/visual-prompt-craft-common.md#已有资产选用闭环) 和 rules.md 核实际使用对象与本镜 header。Creator 发现需复用的已有 identity/形材图漏引，由 Director 转交确切对象、shots、card/image、源依据与影响，并确定 storyboard 写入范围及 stable/等待依赖；你在范围内补真实卡链接，不写槽位或下游文件。剧情/清单/新设计缺口先交对应 owner。稳定交回实际变更后，Creator 重跑 provider materials 并全篇同步 prompt/use，按受影响 scope 取得当前独立证据，不用旧 pass 豁免绑定变化。

写入前按 rules.md 自检字段、编号、时长、对白配速和资产引用。

## 输出

按授权写入 `story/episodes/{ep}/storyboard.md`，复用适用镜头。返回修改范围、诊断依据、必要连续性依赖和未决问题；纯诊断不写文件，创作完成不等于独立验收。
