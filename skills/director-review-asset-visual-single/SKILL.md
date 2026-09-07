---
name: director-review-asset-visual-single
description: 在一个基础资产卡与对应图片需要独立视觉比对时使用。
user-invocable: false
agent: director
allowed-tools: Read, Glob, Bash
model: opus
---

## 输入与范围

尺寸、比例与姿态按共享 `review-meta-rules.md` 的“数值与姿态的可用性判断”核对：关注人体/道具相对尺度及使用可信度，不把 prompt 数值当图像精确测量标准。

具体权利风险仍按共享 review-meta-rules 升级，不因可比较参考图而取得重设计或改名权限。

- 委托明确 basic-only asset_path，仅 character/location/item/building
- 唯一审核目标对应的 image_path，以及 ep、审核 outcome 和必要直接参考路径

读取目标卡及 PNG、当前 script、实际配置（SVD_CONFIG 或 config.md）和共享 review-meta-rules/output-language。为核对声明的同实体/基础引用，可读取必要直接参考卡及其 PNG（可跨类别），不递归参考的参考或遍历历史。始终只审一个 TARGET；参考是 inputs，不新增 scope/result 或替参考图验收。比较共享标志物、几何布局、材质、状态及合理视角差异；整体/局部/不同视图不是状态衍生。核对目标身份、轮廓、服装/材质、关键部位和风格，光线构图应使重要特征可辨。实质偏离才打回，轻微偏好可另作建议；不审 sheets。

实际看图且必要参考、当前证据完整后，无明显错误/不合理特征，也无剧情或必要连续性影响的不匹配，即返回 `pass`。无影响的细节、色彩、布局和视角变化可接受，不要求精确复刻卡片或反复生成到完美。明显错身份、缺关键道具、不可能的解剖结构或空间动作仍须阻塞；用户明确的关键设计仍须核对。纯偏好不进入 blockers/issue/prompt_direction，不以建议冒充 needs_revision；可用 pass 后不再要求精修，除非用户提出或出现新需求。

目标 `.generation.json` 存在时纳入 inputs 指纹，核对 source_path/output_path、设置、status 与 done 的 output_sha256；矛盾或无法核实记具体 unknown。receipt 不含参考图列表，不能证明原始输入；本轮比较当前目标与当前参考，不冒充生成历史证明。用户提供/历史图片缺 receipt 不单独阻塞，不补造。必要直接参考卡与 PNG 均纳入前后 fingerprint；缺必需参考或无法看图时 unknown，不能只凭自洽目标卡 pass。

在独立新 Director context 按共享规则先后 fingerprint 所有实际项目输入（包括卡和 PNG）。只返回单个 JSON，不写文件；inputs 保留 helper 阅读前快照 `[{"path":"...","sha256":"..."}]` 的实值，示例 [] 不是有效验收证据。阅读后的指纹与比较仅作内部核验，不把 inputs 字段改为 `sha256_before` / `sha256_after`；收到协议修正请求时由原 reviewer 更正返回格式，不补造结论。

```json
{"target":"assets/characters/张三.md","status":"needs_revision","inputs":[],"blockers":["具体偏差"],"asset_path":"assets/characters/张三.md","image_path":"assets/images/characters/张三.png","issue":"具体偏差","prompt_direction":"修复方向"}
```

status 为 `pass|needs_revision|unknown`；pass 的 blockers=[] 且 issue/prompt_direction 为空。无法读图、输入变更或不可判定返回 unknown 和原因；空响应不是通过。target=asset_path，不调度修复。
