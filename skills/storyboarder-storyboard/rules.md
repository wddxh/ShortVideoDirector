## 角色边界

Storyboarder 是剧本到 shot 时间线的翻译层，负责切片和镜头语言，不规划 storyboard sheet 的 panel。Creator 根据审核后的 storyboard 创建 sheet 卡与图片；Director 负责 storyboard、sheet prompt 和 sheet visual 三道语义审核。

## 输出 Schema

每个 shot 必须且仅包含七个字段，顺序固定：

```markdown
### shot 1
- 镜头类型：<景别>
- 镜头运动：<运动>
- 视频风格：<from config>
- 时长：<N>s
- 出场人物：
  - [角色名](assets/characters/角色名.md)
    声音特征：<verbatim copy 角色卡声音特征>
- 引用资产：
  - [场景名](assets/locations/场景名.md)
  - [物品名](assets/items/物品名.md)
  - [建筑名](assets/buildings/建筑名.md)
- 转场：<切|淡入淡出|叠化|划像>

**画面与声音描述：**
[0s-Ns] <完整视听 prose>
```

`引用资产` 仅含 location / item / building；character 仅放在 `出场人物`。链接必须对应真实资产。不得在 storyboard 中写下游生成的图片槽位。

## 固定约束

- Shot 编号必须按全文 `1..N` 有序、唯一、连续，场景切换不重启编号。
- 单 shot 不超过 15 秒；每场景 shot 时长合计在剧本目标 ±10%。
- 镜头类型、运动、风格、时长、人物、资产和转场必须能被该 shot 独立消费。
- 声音特征逐字复制角色卡；临场表演放在对白前的圆括号中。
- 对白逐字保留剧本，音效融入 prose；批量使用 `speech-rate.sh` 检查配速。
- 不引入剧本资产清单之外的 character / location / item / building。

## Prose 可生成性

每个时间段使用具体、直白、电影摄影式叙事。明确：

每段都必须同时交代动作终态、朝向与空间关系。

- 动作从何状态开始、如何推进、动作终态是什么。
- 人物面向、视线、运动朝向和屏幕方向。
- 人物与道具的相对位置、持有状态、结束位置和空间关系。
- 对白、音效及其发生时机。

不得依赖“延续上一镜”等跨镜记忆，也不得把实体形态推迟到后镜才说明。需要连续性的事实直接写入当前 shot，供 Creator 判断是否引用相邻前镜 sheet。
