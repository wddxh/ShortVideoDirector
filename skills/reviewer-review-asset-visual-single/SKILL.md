---
name: reviewer-review-asset-visual-single
description: 在一个基础资产卡与对应图片需要独立视觉比对时使用。
user-invocable: false
agent: reviewer
allowed-tools: Read, Write, Edit, Glob, Bash, Task, Skill
model: opus
---

## 输入与范围

目标卡有 `## 本地制作参考` 时按共享 local-reference.md parse/ready，实际看声明的全部 PNG、读取/检查实际工程/脚本和所需输入，均在读取前由 start/add-input 采集。比较图中受控细节是否落实、占位是否误变成最终身份，不要求复制明确的占位外观；用户必要设计仍绑定。它们是现成直接参考而非新增审核 target，缺文件或无法必要读取为 unknown，不新增 sidecar/registry。

尺寸、比例与姿态按共享 `review-meta-rules.md` 的“数值与姿态的可用性判断”核对：关注人体/道具相对尺度及使用可信度，不把 prompt 数值当图像精确测量标准。

具体权利风险仍按共享 review-meta-rules 升级，不因可比较参考图而取得重设计或改名权限。

- 委托明确 basic-only asset_path，仅 character/location/item/building
- 唯一审核目标对应的 image_path，以及 ep、审核 outcome、实际 config_path、必要直接参考路径和指定临时目录

指定 `/tmp/opencode/<task>` 目录先存在，读取目标卡/PNG、script/config 前以显式 SVD_CONFIG 执行 `review-round.mjs start asset-visual EP TARGET STATE [EXTRA_INPUT...]`，script 等已知语义参考放 extras。新参考首次读取前 `add-input STATE PATH...`；target 始终为资产卡。

读取目标卡/PNG、当前 script、实际配置和共享 review/output-language 规则。核对「资产参考」及基础资产的必要直接卡、相关图像提示与 PNG，可跨类别，不递归遍历历史。始终一个 TARGET，参考只作 inputs，不代替参考图验收。按声明关系/用途比较正确来源、观察面及实际外观/结构；被包含/持有/穿戴资产保持自身身份，目标整体不因此等同于来源，仅借鉴共同特征不强制同身份，不要求照搬参考构图。仅真实同实体比较共同标志物、几何、材质与状态，合理投影差异不算冲突，视角差异不是状态衍生。检查身份、轮廓、服装、关键部位与风格是否清晰可辨；无实质影响的像素细节不作门禁，偏好另列建议。

实际看图且本阶段必要参考、当前证据完整后，按资产图主要承担的身份/外观、风格、画质与材质判断；本图职责内无实质问题即返回 `pass`。无影响的细节差异应通过，透视、遮挡、机位、布局及整体运动可由参考视频承担，不要求静帧精确复刻后续 shot。基础图验收不以未来视频存在为前提，也不声称未提供/未查看的视频已验证或修复问题；实际集成冲突留最终 shot-input 审核。

错身份、关键可辨特征/道具缺失、实质风格/材质/画质失败、影响剧情关键动作或用户明确要求的偏差仍阻塞。解剖/拓扑/空间异常须说明实际观察及对本图用途、主体可信度或剧情的具体影响，不按“不可能”标签自动打回无关细节。非必要部位被遮挡或看不清不单独记 unknown；必要要求缺证据才说明缺口。纯偏好不进入 blockers/issue/prompt_direction，不以建议冒充 needs_revision；可用 pass 后不再要求精修，除非用户提出或出现新需求。

目标 `.generation.json` 存在时读取前 add-input，核对 source_path/output_path、设置、status 与 done 的 output_sha256；矛盾或无法核实记具体 unknown。receipt 不含参考图列表，不能证明原始输入；本轮比较当前目标与当前参考，不冒充生成历史证明。用户提供/历史图片缺 receipt 不单独阻塞，不补造。必要直接参考卡与 PNG 均在读取前采集；缺必需参考或无法看图时 unknown，不能只凭自洽目标卡 pass。

在独立新 Reviewer context 按共享规则管理阅读前证据，finish 复核全部输入。每次图片操作新 task、缩略图优先；后续查看不恢复 image-heavy task。本任务已是受托的新视觉上下文时直接执行，不再派任务证明隔离。

start 返回 `reviews/{ep}/assets/{category}/{name}.asset-visual.md` 和轮号。无读写/输入依赖冲突的独立就绪目标默认并行；同一 ep/kind/target 重审串行是输出所有权规则，其他读写/输入依赖仍须排序，无需汇总者。局部 delegate 的参考由 owner 在委托读取前 start/add-input 采集，返回实际观察、所读路径和限制；不以委托后的快照追认。Reviewer 在指定临时 PAYLOAD.json 撰写如下形状，运行 `review-round.mjs finish STATE PAYLOAD.json`；helper 注入 target/inputs 并验证 evidence/footer，不手填哈希。

```json
{"commentary":"实际观察、影响与查看限制","result":{"status":"needs_revision","blockers":["具体偏差"],"asset_path":"assets/characters/张三.md","image_path":"assets/images/characters/张三.png","issue":"具体偏差","prompt_direction":"修复方向"}}
```

status 必须显式为 `pass|needs_revision|unknown`；pass 的 blockers=[] 且 issue/prompt_direction 为空。无法读图、输入变更或不可判定返回 unknown 和原因；空响应不是通过。返回 finish 的 path/round/status/input_count/evidence_issues 和必要意见；exit 0 仅表示记录写入，正常完成不要求立即重读全文或重复指纹检查。不调度修复。
