---
name: director-review-storyboard
description: 在分镜需要独立评估叙事、节奏、七字段契约和可生成性时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

- 委托中的集数 ep、审核范围与保留要求；`story/episodes/{ep}/{script,storyboard}.md` 和实际配置（SVD_CONFIG 或 config.md）；outline 仅在存在且与任务相关时读取
- 本集资产清单对应的基础资产卡
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/{output-language,review-meta-rules,visual-prompt-craft-common,visual-prompt-craft-video}.md`

## 审核职责

Director 负责 storyboard 的语义 gate；Creator 后续负责 storyboard sheet panel 规划。逐项审核：

先按共享 review-meta-rules 确认独立新 Director context。kind=`storyboard`，scope 仅含 `story/episodes/{ep}/storyboard.md`；开工先声明 scope，阅读前和结束后 fingerprint 目标、script、config 和实际参考卡/规划材料。局部意见仍须说明完整 storyboard 的验收范围，不能用局部 pass 冒充全文件通过。

1. Storyboard 完整覆盖剧本，节奏和转场合理，对白原文与人物性格一致。
2. Shot 编号有序、唯一、连续；按 storyboarder-storyboard/rules.md 核对单镜、场景和整集预算，并批量运行 `speech-rate.sh`。实算完整 storyboard 所有 shot 的时长之和，记录 sum 与用户边界；不能只看各场景 ±10% 通过就认定整集通过，也不能把前集实际时长作为本集预算。超界交生产 Director 协调修改或询问用户，不自行放宽。
3. 每个 shot 严格使用七字段；人物与 location/item/building 引用完整且路径有效。
4. Prose 可被单镜独立消费，写足影响理解的动作过程与终态、朝向、屏幕方向、持有状态和空间关系，不要求每段机械重复所有字段。
5. 视觉描述遵循共享 video prompt 规则，没有把 panel 规划写入 storyboard。

语义判断由 Director 完成，不用机械关键词代替叙事、连续性或画面质量判断。

单镜可消费性以最终请求文本和实际提供的 refs 为边界，剧本仅用于核对意图，审核者不能在心中补全模型缺失的上下文。检查当前起始状态和终态明确、裸名字有实际绑定、未绑定持有物有本地可见特征；将“承接上一 shot”落实为当前姿态与空间关系。场次总预算和制作说明由作者放在 shot 结构边界外；转换保留完整 heading、七字段（含时长/声音）、对白、内心声、摄影与本地文本，仅源资产 Markdown 链接替换为实际上传图片绑定。

sheet 尚未生成时按完整 shot 传输契约审核本地指令/prose 与已声明资产，不假定未来 sheet 会补齐缺失事实；生成前核对实际 converter 文本和 images。上传集合来自 header 的人物/资产声明，prose 显式资产链接须映射到该集合；未声明链接会报错，裸名词不作机械匹配。`storyboard-to-prompt.sh` 只做结构定界与链接替换，不筛字段或删除内部文字，成功不等于独立语义验收。

摄影选择应服务观众此刻要看懂或感受到的内容。检查景别、机位、运动、焦点与光线是否引导注意，空间调度、视线和动作轴线是否可读；有意越轴可重新建立方位。推轨改变摄影机位置，变焦改变焦距，不能混用效果。声音、内心声、停顿和画面反应共同支撑人物体验；保留剧本声音内容并说明声源与时机，不禁旁白、不加独白配额。

逐 shot 先依据当前选定 provider/model 已核实的真实最小/最大时长和合法整数秒、用户单镜限制、场景/整集预算与固定镜头数验收，不套统一 15s 默认；模型/能力未明确时报告 unknown 并请求确认，不能编造上限。以该模型实际最大时长为 M，核对无叙事、节奏或预算理由时是否默认按至少 `0.7 * M` 设计，整数秒从 `ceil(0.7 * M)` 起选合法值。M=15s 对应 11s、M=30s 对应 21s 仅为算例，不是静态模型清单或硬门禁。硬边界优先，场景容差不扩大用户整集严格边界，系列各集沿用初始共同预算。

`speech-rate.sh` 实际接收 `"起秒-止秒:slow|normal|fast:台词"` 的逐段参数，输出 OK/OVER 与速率，不解析 storyboard 文件，OVER 也不以非零退出表示。保留真实台词与时间段并读取输出，结合表演、呼吸与反应空间判断。`scene-duration.sh` 只累加“目标时长”，不能用它代替 shot“时长”的整集合计。

短镜头合并属于效率参考，不是验收必经步骤。插入、反应、蒙太奇、转场、结尾落点和预算分配都是合理短镜理由，结合上下文判断，不要求逐镜理由表或关键词证明，不因低于建议值而判 needs_revision。若发现无独立价值的碎切，说明具体收益及可能损失，由生产负责人和 Storyboarder 决定；不自动延时、换模型、改变固定镜头数或强合不相容时空/运镜/动作。实际方案仍须满足模型真实时长范围和用户预算。

### 当前指令与表演的证据

按通用原则 6 检查当前机位的画面方向、纵深及角色自己的左右，世界方位不替代可见位置。反打、转身和运镜可改变屏幕投影，不能把下文“保持原屏幕位置”理解为跨角度锁死左右；仅措辞修订不应改动实际调度。报告有制作影响的歧义，不对对白、地名或背景中的方向字机械判错。

以最终 prompt 和实际 refs 判断观众能看到、听到什么，不借已读剧本在心中补完。定位仍只是事实、预算或结论的文字：年份/罗盘方位通常留源；确需观众识别的锚点由负责人选择，不能要求为每条背景造字幕。`已装芯` 只有本场需要证据且既有设计支持才具体展示；`全身无伤／原册无未来年份` 应以真实当前状态表达，不扩写排除清单。`开始看册而非继续凝望` 要有可见的视线/动作变化，同时保持原屏幕位置、持有手与调度。

声音审核区分稳定音色/口音和可变化的临场表达。青年镜头夹带老年声音备选、把常态3-4字/秒或“音高幅度小”锁定整场，都会让实际表演指令失配。对白、自语、内心声的重要节拍应有说话对象、想法/态度与触发，以及可听的表达依据；仅“温和询问／带期待／认真”不足以说明变化，但不以缺哭腔、耳语或停顿判错。

18s内核对原文说话、倾听、呼吸与动作是否真能完成，允许有依据的重叠；配速通过和场景55s预算都不能证明本镜可拍。报告具体超载或冲突，不以延长本镜、改台词或机械加速作为默认修复。以上是语义判断视角，不是词语黑名单；反馈说明实际失败风险，不冒称未听过的音频表现。

## 输出

Append 到 `story/episodes/{ep}/.review-storyboard.md`：

按最大标题续轮，先开工后补全证据。以下意见模板在 footer 前必须加入共享规则的完整 evidence，每轮以唯一 `<!-- /round-{N} -->` 结束并 Read 自检；heading-only 不是验收。

```markdown
## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过
```

或：

```markdown
## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **shot {N}：** {问题} → {方向}
```

返回 `pass`、`needs_revision {M}` 或 `unknown`（读取/指纹/独立性失败）。保留逐 shot 意见给 storyboarder-fix-storyboard；仅写本 review，不调度修复或另一 reviewer，结果回原生产 Director。
