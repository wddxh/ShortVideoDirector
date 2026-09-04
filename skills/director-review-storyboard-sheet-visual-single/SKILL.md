---
name: director-review-storyboard-sheet-visual-single
description: Use when one storyboard-sheet card and image need an isolated semantic visual comparison.
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Glob
model: opus
---

# Review One Storyboard Sheet Image

## 输入

- `$ARGUMENTS[0]`：当前 card path。
- `$ARGUMENTS[1]`：当前 PNG path。
- Read 当前 card 与 PNG。
- 从 `## 引用资产` links 定位并 Read 每个资产 card 和对应资产 image。
- 若 `## 连续性参考` 显式声明 previous，Read previous card 和 previous PNG；内容为 `无` 时不得猜测或读取 previous。
- 只读，不修改任何文件。

## 语义审核

以 card 为事实基准，由 Director 看图判断，不用关键词或字符串规则替代视觉语义：

- 整板 Panel 数量、顺序、网格和时间推进是否与 card 一致，有无额外、合并或缺失画格。
- 各 Panel 的主体、景别、机位、动作、构图和进入/离开状态是否实现规划。
- 人物、地点、服装、道具、项目彩色风格是否匹配引用资产。
- 只核对 card 声明继承的 previous 元素，不要求复制前板布局或构图。
- 严重标签混乱或布局歧义会误导视频模型时打回；轻微英文标注拼写/渲染失真不打回。

只报告会造成内容漏失、资产错位、时序/连续性冲突或模型读板错误的具体问题，不做审美挑刺。location 严格为 `PANEL NN` 或 `整板`。

## 输出

通过返回空字符串。需修改时返回单个 JSON 对象，不包 markdown；同一卡的问题放进 issues 数组：

```json
{
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

原样回传输入路径；issues 不得为空。不要输出通过说明，也不要提出修改 continuity、assets、metadata 或 storyboard。
