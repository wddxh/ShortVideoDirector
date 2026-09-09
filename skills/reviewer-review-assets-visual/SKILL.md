---
name: reviewer-review-assets-visual
description: 在本集或指定基础资产图片需要协调独立逐目标视觉审核、文件覆盖与当前计数时使用。
user-invocable: false
agent: reviewer
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
---

## 范围

仅审基础/衍生资产。委托说明 ep、所需类型或明确 card paths、审核 outcome 与边界。每个目标由独立 Reviewer 直接写其 canonical 文件；多个独立视觉目标就绪时默认并发全新任务。本 skill 协调范围、覆盖与计数，不另设 LLM 汇总或共享审核账本。

## Scope 合同

目标声明本地制作参考时，单项须按共享 local-reference.md 看全部本地 PNG、读取/检查实际源码/工程和必要输入，与最终目标比较受控细节及占位边界，全部列入 evidence inputs。参考不新增审核 target；范围协调不代判，不建 sidecar/registry。缺本地文件或无法必要读取为该目标 unknown。

默认运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" all`，按委托类型过滤，含新增/复用；只审最新证据缺失、过时或未通过项。显式路径替代默认范围，允许已有资产，不自动加入历史 dirty/unknown；范围外未解决记录原样保留，另报生产 Director。路径须 canonical、属于四类基础目录且符合委托；缺卡记 unknown，不丢目标。按 path 去重，不 Glob 扩大范围。

必读共享 `review-meta-rules.md` 和 `output-language.md`。按 Scope 得 asset paths，图片映射为 `assets/images/{category}/{name}.png`。每目标 owner 确保指定临时目录存在，读取目标/config 前以显式 SVD_CONFIG 运行 `review-round.mjs start asset-visual EP TARGET STATE [EXTRA_INPUT...]`，取得 canonical path/round。新语义参考首次读取前 `add-input STATE PATH...`；生产者不写 pass。

每目标委托全新 Reviewer，提供 ep、asset_path/image_path、canonical review 路径、实际配置和最小必要参考。并行单项直接写各自文件并返回路径/result。每次图片操作都新 task、缩略图优先，追加查看另派新任务。只串行同一 ep/kind/target 的重审；实际依赖、缺参考、宿主资源或用户约束可支持有界分批/串行，在 handoff 简述原因，不设固定任务数或模型配额。缺参考目标仍保留在请求范围，不阻塞其他就绪目标。

嵌套不可用时请主 AI/Director relay 派全新 sibling Reviewer，通过 helper 写指定目标文件并回传实际摘要。局部检查由独立 owner 在 delegate 读取前 start/add-input 采集所需参考，delegate 返回实际观察、所读路径及限制；新参考先回 owner 采集再交 fresh task 读取，不以后采快照追认。复用已确认深度限制，不反复尝试，不恢复 image-heavy task，不增加一次全量审核。

单项只审核一个 TARGET，但可读取其声明的同实体/基础引用所需直接参考卡与 PNG，包括跨类别，不递归或遍历历史。转交参考路径及共享标志物、几何、材质、状态的比较要求；参考仅为 inputs，不自动加入 scope/dirty list/生成目标。目标 owner 用 helper 保留阅读前依据并在 finish 复核；参考变更只令依赖该输入的证据过时，不自动全量重生或清除其他结论。receipt 无参考列表，不能声称证明原始输入。

缺图/缺卡、任务失败或空响应为该目标 unknown，不自动接受或发起修复。单项 Reviewer 在指定临时 PAYLOAD.json 写 commentary/result，显式 status/blockers 和专业字段，再 `review-round.mjs finish STATE PAYLOAD.json`；helper 复核依赖、保留首次哈希并注入 target/inputs，错误保留且证据问题记 unknown。缺显式 status 的 payload 无效，交 owner 修正。用于范围选择的 script/config 由 owner 采集后重新读取核对，不追认协调者早先读取；receipt 在读取前 add-input，历史图片缺 receipt 不单独失败。

协调者用实际 finish 的 path/round/status/input_count/evidence_issues 和必要意见核对覆盖，既有记录按需检查当前性；正常完成不要求立即全文重读、重复 fingerprint 或 check-target。exit 0 仅表示写入，缺失/失败只影响所属目标，成功子集不代表全范围 pass。helper 管理轮次、scope=[target]、唯一 result/footer。commentary 中 `### 意见列表` 保留 asset_path、image_path、issue、prompt_direction；dirty list 只列本目标真实需修改项，unknown 列原因。范围外文件原样保留，局部 pass 不清除其他目标失败。

M 仅计独立单项按媒体职责确认、能说明具体影响的真实视觉阻塞，K 仅计本阶段必要证据缺口。资产图以身份/外观、风格、画质与材质为主；不影响剧情、身份、实际画质或用户明确要求的细节差异不进修复意见/dirty/M，非必要细节不可见不增加 K。不把参考视频承担的透视、遮挡、机位、布局或整体运动转成静帧复刻要求，也不把未来视频缺失列为基础图 unknown。若单项按偏好或无具体影响的解剖/拓扑标签阻塞，交负责 reviewer 澄清，协调者不改判。当前证据下可用 pass 即停止质量循环；可选精修仅在用户要求或新需求出现时考虑。

仅当前请求完整覆盖且 M=0、K=0 返回 `pass`；否则返回 `needs_revision {M}`、`unknown {K}` 或 `needs_revision {M} {K}_unknown`，附逐目标文件路径。Dirty entry 固定为 `{asset_path}|{image_path}`。不另写合并记录；生产 Director 决定修复和重审，不以次数豁免验收。
