---
name: director-review-asset-prompt-single
description: 在单个基础资产卡的图像提示需要独立质量评估时使用。
user-invocable: false
agent: director
allowed-tools: Read, Glob, Bash
model: opus
---

## 输入

方位按共享通用原则 6 检查本图选定视角：画面方向、纵深与角色自己的左右须可区分，同实体锚点约束拓扑而非固定屏幕左右。仅报告影响目标理解的歧义，不因背景或名称含方向字判错。

- 委托明确 asset_path、审核 outcome 与相关参考；basic-only，仅 `assets/characters|locations|items|buildings/*.md`
- 实际配置 SVD_CONFIG（未设时 config.md）
- 共享 output-language、review-meta-rules、visual-prompt-craft-common 规则

读取卡片，审核 `## 图像生成提示` 的模型可消费性、语言和资产引用；衍生资产还检查基础资产/基础类型路径。标准卡有「同实体参考」时读取必要直接参考卡（可跨类别），核对 canonical 有序直链、锚点无环且无互引、共享标志物/几何/材质/状态及当前视角目标。引用卡是 inputs，不是新增 target；只读文本，不要求未来 PNG 存在，不读图或递归历史，不评 storyboard sheet。

将最终 prompt 与执行应提供的 refs 作为可消费性边界：标准卡文本独立成立不意味着禁止 refs；核对 Creator 应把声明逐项映射到有序 job.images，而非只写链接。衍生图核对基础引用及当前状态。源剧本/别卡不能由审核者在心中替模型补齐。“手持那把剑”缺本地可见特征或实际绑定即指出身份缺口，给补形状/材质/颜色或合法引用的正向方向。图片可见匹配留视觉审核；本轮只确认文本与引用契约，不以未来图片缺失阻塞 prompt review。直接参考卡纳入前后 fingerprint；helper 不机械验证标准卡映射完整性。

形象表达应有可辨身份、轮廓、材质、色彩与关键特征，构图和光线帮助识别而非掩盖叙事重要部位。衍生状态保留必要基础身份，同时明确本次变化；用具体可见状态给修正方向。否定句存在本身不是失败，按当前模型、歧义与实际目标判断。独立图片风格或构图偏好可另作建议，不强制重设计合法材料。

遵守共享 review-meta-rules 的独立 Director context 和前后 fingerprint 协议。只返回一个 JSON，不写文件；target 等于 asset_path。inputs 填实际 helper 输出（示例空数组只是占位，不能用于验收）。

```json
{"target":"assets/items/道具.md","status":"needs_revision","inputs":[],"blockers":["具体问题"],"asset_path":"assets/items/道具.md","issue":"具体问题","prompt_direction":"修复方向"}
```

status 为 `pass|needs_revision|unknown`。通过时 blockers=[]，issue/prompt_direction 为空字符串；需修改时给具体位置和正向修改方向；读取失败、输入变更或不可判定时 unknown，说明原因。空响应永不代表通过。不创建或调度修复。
