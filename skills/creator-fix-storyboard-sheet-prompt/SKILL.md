---
name: creator-fix-storyboard-sheet-prompt
description: Use when a sheet card needs targeted panel, continuity-reference, or prompt wording correction or diagnosis.
user-invocable: false
agent: creator
allowed-tools: Read, Edit, Glob, Grep
model: sonnet
---

# Fix Storyboard Sheet Prompt

## 输入

- 从委托取得 ep、目标 canonical card 或 shotNN、修正/诊断目的、保留要求和授权范围；不要求内部命令语法。
- 审核修正读取 `story/episodes/{ep}/.review-storyboard-sheet-prompts.md` 最新声明目标范围的意见及 dirty list，并核对当前材料。owner 标签只提示归属，不证明其他工作已完成。
- 直接请求仅处理指定 card，不要求或拼接旧 review。目标不清先澄清，不默认整集。
- 读取目标 cards、当前 storyboard、script 相关场景与资产清单、实际配置（`SVD_CONFIG` 或 `config.md`）和 `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`。必要时查看相关图片以诊断。

## 严格边界

定位当前意见或授权指令涉及的 shot。局部修正只可 Edit card 中以下三个 section 的现有内容：

- `## Panel 规划`
- `## 连续性参考`
- `## 图像生成提示`

不得修改基本信息、引用资产、heading、文件名、Panel 数量或 storyboard；不得创建/删除 card。不生成、删除或重生成图片。图像检查只用于定位实际问题，不意味着取得独立视觉验收。

Card 无源 shot 副本可修。完整源 shot 由转换器现读，叙事冲突交 `upstream-storyboard`，不在 Panel 或整板提示中覆盖上游。`图像生成提示` 只修格式、阅读顺序、比例、风格、labels；静态姿态与构图修在 Panel 规划，保留其完整细节。对白/声音是表演上下文，不因字多加格、逐句配格或自动绘成字幕。

按根因选择能在当前范围完成的修正，不假定 `upstream-storyboard` 或 `generator` 已经运行。若需改时长、增减 Panel、引用资产或剧本事实，返回具体 findings 和跨负责人建议；由 Director 协调范围，不自动调用下一 skill。加载此方法只补充本地知识。

直接委托不要求 owner 或 dirty list，但仍只可修改上方三个白名单 section；请求涉及其他 section 时返回 unhandled，不扩大边界。特别是四项已解析设置属于基本信息，不能靠只改 prompt 比例掩盖设置冲突，应请求授权的卡片同步。

## 修正方法

优先定位造成误读的视觉关系：例如持有物错手需核对动作和继承声明，网格过密需区分提示表达与格数/设置问题。按根因选择检查顺序，保留正确设计，不为执行完整流程制造 diff。

- 目标证据：定位本集唯一 canonical card，核实问题仍存在；拒绝其他集或不存在路径，纯诊断不编辑。
- 意见归属：审核意见匹配 dirty list 中唯一 card，直接请求以实际委托为准；越过 section 白名单的要求报告未处理。
- 最小修正：保留未涉及的 PANEL、时间码、景别、机位、摄影机及其他 section。整板请求也只调整三个允许 section。
- 单次输入：读取委托提供的当前 converter JSON（完整 prompt、images、settings、sourcePath），以完整源 shot + 完整 Panel + 整板要求判断，不只看末尾提示。本 skill 无 Bash；缺解析结果或修后需重解析时，交 Director 协调具备只读执行权限的上下文按 rules 的命令核对，不自行猜测引用集合或声称已通过转换。源根相对 links 与 card 相对 links 共用映射，裸名无需 regex 替换；previous 只继承声明属性。缺声明、卡或图片不靠摘要替代，按源/卡归属报告。
- 修改核对：比较实际编辑前后，确认 schema、Panel 数量、资产 links 和非白名单 section byte-for-byte 不变，记录 changed shots。
- 验收边界：不修改 review 文件；报告可能受影响的图片和证据。独立 reviewer 由 Director 另行委派，不自动重生或刷新 pass。

旧卡冗余剧情不会被转换器自动清理；仅在当前授权目标内处理实际冲突/冗余，不迁移其他卡。缺 `Panel 规划`、需改数量或补源的旧卡超出本地白名单时返回 unhandled，不新建副本或半成品。

## 返回

```text
changed shots: shotNN ... | none
no_image_generated: true
input mode: review | direct
unhandled prompt-fix: location: reason ... | none
```

只报告实际磁盘变化；同一 shot 多项意见只列一次。

`input mode` 仅标记意见来源：审核委托为 review，直接委托为 direct，不是要求调用方构造 CLI。
