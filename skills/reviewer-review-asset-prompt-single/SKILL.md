---
name: reviewer-review-asset-prompt-single
description: 在单个基础资产卡的图像提示需要独立质量评估时使用。
user-invocable: false
agent: reviewer
allowed-tools: Read, Write, Edit, Glob, Bash, Task, Skill
model: opus
---

## 输入

方位按共享通用原则 6 检查本图选定视角：画面方向、纵深与角色自己的左右须可区分，同实体锚点约束拓扑而非固定屏幕左右。仅报告影响目标理解的歧义，不因背景或名称含方向字判错。

- 委托明确 ep、asset_path、审核 outcome、相关参考和指定临时目录；仅审核授权新增/重生目标，复用库存只作必要 inputs。basic-only，仅 `assets/characters|locations|items|buildings/*.md`
- 实际配置 SVD_CONFIG（未设时 config.md）
- 共享 output-language、review-meta-rules、visual-prompt-craft-common 规则

指定临时目录先存在；读取卡片/config 前以显式 SVD_CONFIG 执行 `review-round.mjs start asset-prompt EP TARGET STATE [EXTRA_INPUT...]`。新语义参考首次读取前 `add-input STATE PATH...`。审核 `## 图像生成提示` 的模型可消费性、语言和引用；衍生资产还核对基础资产/类型路径。读取必要同实体直接卡（可跨类别），检查 canonical 有序直链、无环锚点与共享特征。参考仅作 inputs，不扩 target 或递归历史。未来输出 PNG 无需存在；已制成本地参考仍须实际查看。

有 `## 本地制作参考` 时按共享 local-reference.md parse/ready，实际看全部本地 PNG，读取文本源码并按需检查工程和必要输入，均在读取前由 start/add-input 采集。核对受控细节、占位边界及基础完整 prompt 的真实有序参考绑定和 narrative 意图；不能假定 wrapper 会补文字。普通目标/资产未来 PNG 不要求存在。缺本地文件、无法看图/检查必要源码为 unknown；明确控制冲突为 needs_revision。不得执行未经检查的脚本或修改被审材料。

将最终 prompt 与执行应提供的 refs 作为可消费性边界：标准卡文本独立成立不意味着禁止 refs；核对声明到有序 job.images 的实际映射，而非只写链接。衍生图保留基础引用及当前状态。源剧本/别卡不能由审核者在心中替模型补齐。“手持那把剑”缺可见特征或实际绑定即指出身份缺口，给正向修复方向。未来目标图的匹配留 visual review；本轮检查文本、引用契约及已有本地参考，不以未来图缺失阻塞。直接参考卡在读取前 add-input；helper 不机械验证同实体映射完整性。

形象表达以可辨身份/外观、风格、画质与材质为主，构图和光线支持本图承担的关键特征；衍生状态保留必要基础身份并明确变化。具体细节帮助表达，不自动成为逐项复刻指标；无影响差异不要求改写。透视、遮挡、相机、布局和整体运动可由后续参考视频承担，不要求基础 prompt 预演全部 shot 或未来视频先存在。静态形状参考按声明职责核对；剧情关键特征/动作、用户明确要求与真实身份/质量冲突仍须定位具体影响。否定句存在本身不是失败，按当前模型、歧义与实际目标判断；风格或构图偏好另作建议，不强制重设计合法材料。

遵守共享 review-meta-rules 的独立 context、每次图片操作新 task/缩略图协议。start 返回本目标 canonical 路径与轮号；不同目标并行，只串行同一 ep/kind/target 重审。局部检查由 owner 在 delegate 读取前采集所需参考，实际观察/路径/限制回 owner。Reviewer 在指定临时 PAYLOAD.json 撰写如下形状，再 `review-round.mjs finish STATE PAYLOAD.json`；helper 复核并注入 target/inputs、管理 evidence/footer，不手填哈希。

```json
{"commentary":"具体位置、影响与判断依据","result":{"status":"needs_revision","blockers":["具体问题"],"asset_path":"assets/items/道具.md","issue":"具体问题","prompt_direction":"修复方向"}}
```

status 必须显式为 `pass|needs_revision|unknown`。通过时 blockers=[]，issue/prompt_direction 为空字符串；需修改时给具体位置和正向修改方向；读取失败、输入变更或不可判定时 unknown，说明原因。返回 finish 的 path/round/status/input_count/evidence_issues 和必要意见；exit 0 仅表示记录写入，正常完成不要求立即重读全文或重复指纹检查。空响应永不代表通过。不创建或调度修复。
