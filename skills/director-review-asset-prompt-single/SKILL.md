---
name: director-review-asset-prompt-single
description: 在单个基础资产卡的图像提示需要独立质量评估时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Bash, Task, Skill
model: opus
---

## 输入

方位按共享通用原则 6 检查本图选定视角：画面方向、纵深与角色自己的左右须可区分，同实体锚点约束拓扑而非固定屏幕左右。仅报告影响目标理解的歧义，不因背景或名称含方向字判错。

- 委托明确 ep、asset_path、审核 outcome、相关参考和分配的 review 轮次；仅审核授权新增/重生目标，复用库存只作必要 inputs。basic-only，仅 `assets/characters|locations|items|buildings/*.md`
- 实际配置 SVD_CONFIG（未设时 config.md）
- 共享 output-language、review-meta-rules、visual-prompt-craft-common 规则

读取卡片，审核 `## 图像生成提示` 的模型可消费性、语言和引用；衍生资产还核对基础资产/类型路径。读取必要同实体直接卡（可跨类别），检查 canonical 有序直链、无环锚点与共享特征。参考仅作 inputs，不扩 target 或递归历史。未来输出 PNG 无需存在；已制成本地参考仍须实际查看。

有 `## 本地制作参考` 时按共享 local-reference.md parse/ready，实际看全部本地 PNG，读取文本源码并按需检查工程和必要输入，全部列入前后 fingerprint。核对受控细节、占位边界及基础完整 prompt 的真实有序参考绑定和 narrative 意图；不能假定 wrapper 会补文字。普通目标/资产未来 PNG 不要求存在。缺本地文件、无法看图/检查必要源码为 unknown；明确控制冲突为 needs_revision。不得执行未经检查的脚本或修改被审材料。

将最终 prompt 与执行应提供的 refs 作为可消费性边界：标准卡文本独立成立不意味着禁止 refs；核对声明到有序 job.images 的实际映射，而非只写链接。衍生图保留基础引用及当前状态。源剧本/别卡不能由审核者在心中替模型补齐。“手持那把剑”缺可见特征或实际绑定即指出身份缺口，给正向修复方向。未来目标图的匹配留 visual review；本轮检查文本、引用契约及已有本地参考，不以未来图缺失阻塞。直接参考卡纳入前后 fingerprint；helper 不机械验证同实体映射完整性。

形象表达应有可辨身份、轮廓、材质、色彩与关键特征，构图和光线帮助识别而非掩盖叙事重要部位。衍生状态保留必要基础身份，同时明确本次变化；用具体可见状态给修正方向。否定句存在本身不是失败，按当前模型、歧义与实际目标判断。独立图片风格或构图偏好可另作建议，不强制重设计合法材料。

遵守共享 review-meta-rules 的独立 context、每次图片操作新 task/缩略图及前后 fingerprint 协议。直接在受托 `.review-asset-prompts.md` 轮次声明 scope，完成证据/意见/footer 并返回路径与 result；协调者串行安排该文件写入。若仅受托向实际独立汇总者提供子结果，则返回 JSON。target 等于 asset_path，inputs 填真实 helper 输出（示例空数组不是验收证据）。

```json
{"target":"assets/items/道具.md","status":"needs_revision","inputs":[],"blockers":["具体问题"],"asset_path":"assets/items/道具.md","issue":"具体问题","prompt_direction":"修复方向"}
```

status 为 `pass|needs_revision|unknown`。通过时 blockers=[]，issue/prompt_direction 为空字符串；需修改时给具体位置和正向修改方向；读取失败、输入变更或不可判定时 unknown，说明原因。空响应永不代表通过。不创建或调度修复。
