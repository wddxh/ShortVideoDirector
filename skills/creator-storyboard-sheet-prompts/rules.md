# Storyboard Sheet Card Rules

## 字面 Schema

每张 card 严格采用以下 section、字段名和顺序。重复 `### PANELNN` 块，NN 从 01 连续递增；不得增加替代 section。

```markdown
# shotNN 分镜板

## 基本信息
- 所属集数：epNN
- 对应分镜：shotNN
- 时长：Ns
- 类型：分镜板
- Panel数量：N

## 引用资产
- [资产名](../../characters/资产名.md)

## 连续性参考
无

## Panel 规划

### PANEL01
- 时间码：0s-2s
- 景别：中景
- 机位：平视正侧三分之二机位
- 摄影机：固定
- 画面：可见主体、位置、朝向、姿态、动作与环境状态
- 连续性：本 panel 的进入状态与离开状态

## 图像生成提示
完整的分镜板图像生成提示。
```

无 previous 时，`## 连续性参考` 的唯一内容为 `无`。有 previous 时只允许：

```markdown
- [shotNN](./shotNN.md)
- 继承元素：服装、持有物、空间朝向
```

## 资产协议

- `## 引用资产` 列出当前 shot 的全资产，包含人物、地点、道具、建筑；按 storyboard 出现顺序去重。只写 Markdown links，不写 `{图片N}` slots。
- `## 图像生成提示` 只写资产 naked names，不写 Markdown links 和 slots。即 cards only use links/naked names, never converter slots。
- 每条 link 必须从 card 到真实 asset `.md`，禁止 URL、锚点、图片 link、嵌套或带 title 的复杂 link。

## Panel 拆分

Panel 数量动态决定且无上限。所有时间码须从 `0s` 开始、严格升序、首尾相接并完整覆盖 shot 时长，不得重叠或留白。每个 PANEL 至少对应一个可辨识视觉 beat。

在下列任一节点拆 Panel：storyboard 时间边界、显式 cut、机位变化、景别变化、摄影机运动变化、关键姿态变化、动作结果或人物反应、建立镜头、结束落点。不要按固定秒数机械均分，也不要把同一连续 beat 过拆成近重复格。

每格必须自包含地说明：主体裸名、环境、构图位置、朝向、姿态/动作、神情、必要道具、光线与进入/离开连续状态。只写屏幕上可见的瞬间，不把声音、对白内容或抽象意图当作画面。

## 整板协议

- 输出固定 `16:9` 画布的等宽网格，阅读顺序左→右、上→下；Panel 数量决定行列布局，留一致窄 gutter。
- 每个 panel 内部保持项目视频比例，以 letterbox/pillarbox 适配格子，不裁掉关键主体。
- 使用 config 的项目彩色视频风格；同板保持调色、线条、光线逻辑一致，但每格画面变化清楚。
- 每格仅带短英文 label，如 `PANEL 01`；不得添加剧情字幕、对白、说明长句或中文标签。
- previous 只可引用编号相邻的上一张 sheet，且当前 shot 确有服装、持有物、位置/朝向等连续元素。无连续元素即写 `无`。
- previous 仅提供声明元素的视觉连续性；不得复制前板网格、panel、构图、机位，也不得让前板决定当前 Panel 数量。

## Markdown 安全子集

仅允许 ATX headings、普通段落、`- ` 无序列表、行内反引号，以及资产/previous 的简单相对 Markdown link。禁止 raw HTML（包括 `script`、`pre`、`style`）、图片、表格、blockquote、fenced code、脚注、自动链接及复杂 link。prompt 不得包含 HTML-like 标签。

## 写前自检

- metadata 与源 shot 的 ep、编号、时长一致，Panel数量等于 PANEL 块数。
- 时间覆盖完整，关键 beats 无遗漏，邻格没有无意义重复。
- current links 完整真实；previous 合法且继承元素明确。
- prompt 明说 16:9、网格顺序、内部视频比例、彩色风格、短英文 label 和禁止复制 previous 构图。
