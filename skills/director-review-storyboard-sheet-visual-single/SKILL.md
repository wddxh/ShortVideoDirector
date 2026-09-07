---
name: director-review-storyboard-sheet-visual-single
description: Use when one storyboard-sheet card and image need an isolated semantic visual comparison.
user-invocable: false
agent: director
allowed-tools: Read, Glob, Bash
model: opus
---

# Review One Storyboard Sheet Image

## 输入

- 委托明确当前 card_path、image_path、审核 outcome 与只读范围。
- Read 当前 card 与 PNG。
- 在项目根运行 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-sheet-to-prompt.sh" --json "{card_path}"`，取得与生成相同的完整 prompt、images、settings、sourcePath。读取 sourcePath 的实际 shot 与 config，按 images 定位直接基础资产 card/PNG，核对身份和外观，不另猜集合或加载无关历史资产。
- 若 `## 连续性参考` 显式声明 previous，仅为继承核对 Read previous card 和 PNG，使用当前/previous 最小配对；内容为 `无` 时不得猜测或读取 previous。
- 必读 config 和共享 review-meta-rules/output-language；在独立新 Director context 执行，按共享规则在阅读前及结束后 fingerprint 全部实际项目输入。
- 业务文件只读，不修改任何业务产物。Bash 只可调用现有只读脚本、执行检查或做临时验证，不得借 Bash 写、改、删业务文件。

实际配置为 SVD_CONFIG（未设时 config.md）。核对四项已解析设置及授权，整板比例与 panel 内视频比例分别判断，不固定 16:9 画布。对应 `.generation.json` 存在时读取并纳入 inputs 指纹，核对 source_path/output_path、provider/model/ratio/resolution、status 与 done 时 output_sha256；矛盾/无法核实为 unknown。用户提供或历史图片没有 receipt 不单独阻塞，也不补造生成历史。

## 语义审核

各 Panel 的尺度、角度与姿态按共享 `review-meta-rules.md` 的“数值与姿态的可用性判断”核对；关键持物、可达性与动作衔接优先于无影响的手指或机位差异。

以当前解析请求为比较基准：完整源 shot 是叙事权威，完整 Panel 规划选择静态 beats/姿态/构图，整板提示管格式、阅读顺序、比例、风格与 labels。由 Director 看图判断，不用关键词或字符串规则替代视觉语义。对白/旁白/声音是表演上下文，不要求每句话一格或自动绘成字幕；不能靠加格掩盖密度问题，也不能让卡内旧摘要覆盖源事实。

当前 sourcePath/refs 证明本轮比较依据，不证明导入/旧图生成时的输入。缺必要参考或解析失败为 unknown，不用摘要替依赖，不为缺 receipt 强制重生；已登记任务的纯取回仍按原记录进行。

- 整板 Panel 数量、顺序、网格和时间推进是否保留 card 的必要信息；额外、合并或缺失画格是否导致内容漏失、时序歧义或模型读板错误，而非逐像素比对布局。
- 各 Panel 的主体、景别、机位、动作、构图、光线和进入/离开状态是否实现规划；信息焦点、视线与持有物可辨，关键反应与动作结果未丢失。
- 人物、地点、服装、道具与实际项目风格是否匹配引用资产，彩色或授权黑白均可；留边保留 panel 视频比例，整板采用卡中独立画布比例。
- 只核对 card 声明继承的 previous 元素，不要求复制前板布局或构图。
- 严重标签混乱或布局歧义会误导视频模型时打回；轻微英文标注拼写/渲染失真不打回。

独立 reviewer 实际看图且必要参考齐全、证据为当前版本，无明显错误/不合理特征，也无剧情或必要连续性影响的不匹配，即返回 `pass`。细节、色彩、布局、景别或机位的合理变化若不影响叙事、必要连续性及读板，可接受，不要求精确复刻卡片。用户明确的关键设计仍须核对；明显错身份、缺关键道具、不可能的解剖/空间动作、妨碍视频生成的格序歧义仍须阻塞。未看图、缺必要参考或证据漂移为 unknown，不能因降低审美门槛改成 pass。

只报告上述真实阻塞，纯偏好不进入 blockers/issues，不因小建议返回 needs_revision；可用 pass 后停止质量循环，不要求反复生成到完美，除非用户要求精修或出现新需求。location 严格为 `PANEL NN` 或 `整板`。

## 输出

始终返回单个 JSON，不包 markdown；target=card_path，inputs 填 helper 的真实结果（示例 [] 仅占位，不能通过验收）。同一卡的问题放进 issues 数组：

```json
{
  "target": "assets/storyboard-sheets/ep01/shot02.md",
  "status": "needs_revision",
  "inputs": [],
  "blockers": ["PANEL 02 可见结果与 card 冲突"],
  "card_path": "assets/storyboard-sheets/ep01/shot02.md",
  "image_path": "assets/images/storyboard-sheets/ep01/shot02.png",
  "issues": [
    {
      "location": "PANEL 02",
      "issue": "可见结果与 card 的具体冲突",
      "fix_direction": "针对 Panel 规划或图像生成提示的最小方向"
    }
  ]
}
```

原样回传输入路径；status 为 `pass|needs_revision|unknown`。pass 的 blockers/issues 均为空；needs_revision 的 issues 含定位和方向。读取失败、输入变更或不可判定时 unknown 并说明原因；空响应不是 pass。若根因在 continuity/assets/metadata/storyboard，报告定位与跨 owner 提案给生产 Director，不自行修改或调度修复。
