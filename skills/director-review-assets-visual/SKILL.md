---
name: director-review-assets-visual
description: 在本集或指定基础资产图片需要独立视觉审核汇总时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task
model: opus
---

## 范围

仅审基础/衍生资产。委托说明 ep、所需类型或明确 card paths、审核 outcome 与边界。单项目标交独立 singleton 直接写受托轮次；仅实际分开的 reviewer 结果需合并时使用只读结论的独立汇总者。

## Scope 合同

目标声明本地制作参考时，单项须按共享 local-reference.md 看全部本地 PNG、读取/检查实际源码/工程和必要输入，与最终目标比较受控细节及占位边界，全部列入 evidence inputs。只作为直接参考，不新增审核 target；汇总仍不读图、不代判，不建 sidecar/registry。缺本地文件或无法必要读取为 unknown。

默认运行 `node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs" "story/episodes/{ep}/script.md" all`，按委托类型过滤，含新增/复用；只审最新证据缺失、过时或未通过项。显式路径替代默认范围，允许已有资产，不自动加入历史 dirty/unknown；范围外未解决记录原样保留，另报生产 Director。路径须 canonical、属于四类基础目录且符合委托；缺卡记 unknown，不丢目标。按 path 去重，不 Glob 扩大范围。

必读共享 `review-meta-rules.md` 和 `output-language.md`。按 Scope 得 asset paths，图片映射为 `assets/images/{type}/{name}.png`。受托记录写入者在 `.review-basic-assets-visual.md` 按最大标题轮号开始新轮，先写 kind=`asset-visual`、scope、results=[]，结束补 results/footer。Singleton 自己写该轮；实际分项结果需合并时由独立汇总者写，协调者只串行分配写入，不先建重复轮次。

每个目标委托全新 Director context，提供 ep、asset_path/image_path、实际配置、相关参考与受托轮次或子结果边界。每次图片操作都新 task、缩略图优先，必要追加查看用文本/路径交新任务。singleton 可直接落盘；协调者串行安排同文件写入并重读轮号。只有实际并行/分项结果需要合并时，独立 aggregate 收文本写轮次，不读 PNG 或代判。无嵌套请主 AI relay。

单项只审核一个 TARGET，但可读取其声明的同实体/基础引用所需直接参考卡与 PNG，包括跨类别，不递归或遍历历史。转交这些参考路径及共享标志物、几何、材质、状态的比较要求；参考仅为 inputs，不自动加入 scope/dirty list/生成目标。单项前后 fingerprint 包含必要参考卡及图，聚合保留其哈希并终检；参考变更只令依赖该输入的证据过时，不自动全量重生或清除其他结论。receipt 无参考列表，不能声称证明原始输入。

缺图/缺卡、任务失败、空响应或无效 JSON 记 unknown；不得自动接受或发起修复。单项显式返回 pass/needs_revision/unknown、真实 inputs 和 blockers，按共享规则终检指纹，聚合不能重新造 pass。实际配置为 SVD_CONFIG（未设时 config.md）；用于范围选择的 script/config 也纳入阅读前快照和终检。单项读取的 generation receipt 存在时纳入 inputs，但用户提供/历史图片不因缺 receipt 自动失败。

完成轮保留 `## 第 N 轮 ...`，每个 scope target 恰好一个 result；写后核对唯一 `<!-- /round-N -->`。`### 意见列表` 保留 asset_path、image_path、issue、prompt_direction，供 creator-fix-asset-image 消费；`### dirty list` 仅列需修改项，`### 无法判定` 列未知路径及原因。纯历史 pass 仍须核对当前输入，局部 pass 不消除其他目标的失败。

M 仅计独立单项确认有真实视觉阻塞的去重目标，K 计 unknown；无影响的小细节、色彩、布局或视角建议不进修复意见/dirty，也不增加 M。若单项把纯偏好列作 blocker，交原 reviewer 澄清，不由汇总者改判。当前证据下可用 pass 的目标停止质量循环，不为追求卡片精确复刻而建议重生；可选精修仅在用户要求或新需求出现时考虑。

仅当前请求 M=0 且 K=0 返回 `pass`；否则返回 `needs_revision {M}`、`unknown {K}` 或 `needs_revision {M} {K}_unknown`。Dirty entry 固定为 `{asset_path}|{image_path}`。Reviewer 仅写本记录，生产 Director 决定修复和重审，不以次数豁免验收。
