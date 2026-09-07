---
name: director-review-asset-visual-single
description: 在一个基础资产卡与对应图片需要独立视觉比对时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Bash, Task, Skill
model: opus
---

## 输入与范围

目标卡有 `## 本地制作参考` 时按共享 local-reference.md parse/ready，实际看声明的全部 PNG、读取/检查实际工程/脚本和所需输入，均纳入前后 fingerprint。比较图中受控细节是否落实、占位是否误变成最终身份，不要求复制明确的占位外观；用户必要设计仍绑定。它们是现成直接参考而非新增审核 target，缺文件或无法必要读取为 unknown，不新增 sidecar/registry。

尺寸、比例与姿态按共享 `review-meta-rules.md` 的“数值与姿态的可用性判断”核对：关注人体/道具相对尺度及使用可信度，不把 prompt 数值当图像精确测量标准。

具体权利风险仍按共享 review-meta-rules 升级，不因可比较参考图而取得重设计或改名权限。

- 委托明确 basic-only asset_path，仅 character/location/item/building
- 唯一审核目标对应的 image_path，以及 ep、审核 outcome 和必要直接参考路径

读取目标卡/PNG、当前 script、实际配置和共享 review/output-language 规则。核对必要同实体/基础直接卡与 PNG，可跨类别，不递归遍历历史。始终只审一个 TARGET；参考只作 inputs，不代替参考图验收。比较共享标志物、几何、材质、状态及合理视角差异；整体/局部/不同视图不是状态衍生。检查身份、轮廓、服装、关键部位与风格是否清晰可辨；实质偏离才打回，偏好另列建议。

实际看图且必要参考、当前证据完整后，无明显错误/不合理特征，也无剧情或必要连续性影响的不匹配，即返回 `pass`。无影响的细节、色彩、布局和视角变化可接受，不要求精确复刻卡片或反复生成到完美。明显错身份、缺关键道具、不可能的解剖结构或空间动作仍须阻塞；用户明确的关键设计仍须核对。纯偏好不进入 blockers/issue/prompt_direction，不以建议冒充 needs_revision；可用 pass 后不再要求精修，除非用户提出或出现新需求。

目标 `.generation.json` 存在时纳入 inputs 指纹，核对 source_path/output_path、设置、status 与 done 的 output_sha256；矛盾或无法核实记具体 unknown。receipt 不含参考图列表，不能证明原始输入；本轮比较当前目标与当前参考，不冒充生成历史证明。用户提供/历史图片缺 receipt 不单独阻塞，不补造。必要直接参考卡与 PNG 均纳入前后 fingerprint；缺必需参考或无法看图时 unknown，不能只凭自洽目标卡 pass。

在独立新 Director context 按共享规则先后 fingerprint 所有实际输入。每次图片操作新 task、缩略图优先；后续查看不恢复 image-heavy task。直接在受托 `.review-basic-assets-visual.md` 轮次声明 scope，完成证据/意见/footer 并返回路径与 result；协调者串行安排同文件写入。仅受托提供子结果给实际独立汇总者时返回 JSON。inputs 保留 helper 阅读前快照 `[{"path":"...","sha256":"..."}]` 的实值，示例 [] 不是有效证据；协议修正只处理文本，不补造结论。

```json
{"target":"assets/characters/张三.md","status":"needs_revision","inputs":[],"blockers":["具体偏差"],"asset_path":"assets/characters/张三.md","image_path":"assets/images/characters/张三.png","issue":"具体偏差","prompt_direction":"修复方向"}
```

status 为 `pass|needs_revision|unknown`；pass 的 blockers=[] 且 issue/prompt_direction 为空。无法读图、输入变更或不可判定返回 unknown 和原因；空响应不是通过。target=asset_path，不调度修复。
