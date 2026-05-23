## 适用范围

本文件为 director-outline 的**公共规则**，所有 mode (new-series / continue-series / short) 都必须遵守。mode 专属的输出格式、上下文读取、流程细节请参见对应 mode 文件 (`series.md` / `short.md`)。

## 公共骨架字段 (所有 mode 必须包含)

每集 outline 至少包含以下两段：

```markdown
## 本集信息传达
- **{信息内容（角色身份、世界观设定、背景知识、剧情伏笔等）}** — {建议传达方式（主角内心独白/角色对话/群演讨论/新闻播报等）}

（无需传达时标注"无"）

## 场景列表

### 场景 1: {场景标题}
- **目标时长:** Ns
- **地点 (location asset):** {asset id 或 "本集新增"}  <!-- asset id = 资产名, 见下方 "asset id 规则" -->
- **出场角色 (character assets):** {asset id 列表 或 "本集新增"}  <!-- 同上 -->
- **节奏角色:** {开场 / 铺垫 / 推进 / 高潮 / 收束 / 过渡 之一}
- **动作:** {1-3 个连续动作的描述}

### 场景 2: ...
```

mode 专属字段（如集尾钩子、开场策略、arc 节点对应、结局落点等）在公共骨架之上按 mode 文件追加。

## 通用规则

### 场景颗粒度
- 每个场景包含 **1-3 个连续动作**
- 多于 3 个动作 → 拆分为多个场景
- 仅 1 个动作但能独立成戏（如关键反应镜头）→ 保留单动作场景，否则合并到相邻场景
- 不在场景层写镜头建议（景别 / 运动 / 时长）——这是 scriptwriter / storyboarder 的职责

### Asset 引用约束
- 每个场景的 `地点` 和 `出场角色` 字段中引用的 asset，必须满足以下之一：
  - 已在 `assets/characters/` 或 `assets/locations/` 中注册
  - 在本集 outline 末尾的 `## 本集新增资产` 段中显式列出（director-outline 阶段产物，scriptwriter Phase 5 后切换为 `## 本集资产清单` superset 终态）
- 不允许 dangling reference（引用未注册且未声明新增的 asset）
- item asset（道具）/ building asset（建筑）此阶段**在场景字段中不出现**（场景仅写地点 + 出场角色），但 director-outline 阶段已知的新增 items / buildings 应列入「本集新增资产」段供 scriptwriter 复用（具体格式见下方「新增资产规则」段）

### 节奏角色
- 每个场景**有且仅有一个**节奏角色，取值范围：
  - `开场` — 第一场景专用，承担抓住观众注意力的职责
  - `铺垫` — 信息/情绪/伏笔铺设
  - `推进` — 剧情向前推进
  - `高潮` — 戏剧张力顶点
  - `收束` — 情感落点 / 信息收束 / 短场承接
  - `过渡` — 时空切换 / 视角切换 / 桥段
- 单集节奏角色分布必须有"高潮"至少 1 个；不允许全部为"过渡"或"铺垫"
- 节奏角色互斥：一个场景不能同时挂两个节奏角色

### 信息传达
- 任何新角色 / 世界观设定 / 关键伏笔，必须在「本集信息传达」中显式列出
- 列出每条信息时必须给出建议传达方式（独白 / 对话 / 群演 / 旁白 / 新闻 / 视觉符号等）
- 信息传达时机必须合理：主角不能"凭空"介绍尚未认识的角色，由其他角色或群演传达
- 短视频节奏快，观众无法从画面慢慢推断——未显式列出的信息默认会被错过

## 时长规划原则

时长不够时按以下取舍优先级逐级尝试，不要跳级：

1. **第一优先 — 分散吸收**：把"待删场景"中的关键剧情/铺垫**移植**到相邻场景，不让情节凭空消失。例：arc 节点有"街头偶遇旧师兄揶揄"(可选, ~60s) 但时长紧张 → 把"被旧师门嘲讽"这层情绪压力移植到主角进入百晓楼前的一句内心独白或一个路过镜头反应里。
2. **第二优先 — 砍场景数**：若关键剧情无法分散吸收（移植后破坏新载体场景节奏），整场删除。仅限对应 arc 标记"可选"的事件；必需事件必须保留至少一种载体形式。
3. **第三优先 — 压缩场景时长**：仅作为最后手段。允许把次要场景从 25s 压到 18s，但不能压到讲不清因果（关键对白压到 8s 必然砍台词 → 违反本设计初衷）。
4. **单场景不必自足**：场景可以只是跨场景行动的一部分（如"主角推门进屋"和"主角看见尸体"可拆两场），不强求每场含完整因果。
5. **前后场景必须通顺**：相邻场景因果链不能断；任何被分散吸收的情节必须能在新载体场景里被识别（哪怕一句台词、一个反应镜头）。
6. **arc 必需事件不可丢**：arc 节点标记"必需"的事件必须在 outline 中可识别。
7. **总时长服从 config**：sum(场景目标时长) 必须落在 config 每集时长目标区间内（scene-duration.sh 兜底校验）。

## 通用失败模式 (spec §6.3 通用)

- **场景颗粒度失衡** — 一场景含 3 个以上事件（应拆分），或全集每场景仅 1 动作（应合并）
- **asset dangling reference** — 场景出场角色 / 地点未在 assets/ 注册，且未在「本集新增资产」中声明
- **节奏角色分布集中** — 全集场景节奏角色全是「过渡」或「铺垫」，无「高潮」→ 本集无戏剧张力
- **节奏角色互斥违反** — 单场景同时挂两个节奏角色
- **写镜头建议越权** — 在场景动作中写「全景推开 / 特写脸部」等景别 / 运动指示
- **信息传达遗漏** — 引入新角色 / 新设定但未在「本集信息传达」中显式列出对应传达方式
- **场景缺目标时长字段** — 公共骨架硬字段，缺即 FAIL
- **总时长偏离 config** — scene-duration.sh FAIL（sum 低于 min 或超 max）
- **前后场景因果断裂** — 场景 N 的果不承接场景 N-1 的因（review 质性判）
- **过渡突兀** — 场景间时空跳跃但 outline 未交代过渡（review 质性判）
- **arc 必需事件丢失** — arc 节点标记"必需"事件在 outline 中既无对应场景也未被分散吸收（review 质性判）

## 范围边界

本文件**不规定**以下内容（由 mode 文件管理）：
- 集尾钩子 / 开场策略 (series 与 short 在 ep1 共有，但 series 每集都需要钩子，short 单集需结局落点)
- 与 arc.md 的对接方式（仅 series）
- new-series vs continue-series mode 的输出文件操作差异（由 generate-episode-pipeline 编排）
- 全局 story/outline.md 同步策略
- mode 专属失败模式（钩子无力、续集状态不一致、结局仓促等）

## 新增资产规则

### 定义

"新增资产" = 在本集 outline 中引用，但**未在 `assets/{characters,locations,items,buildings}/` 注册**的角色 / 地点 / 物品 / 建筑。

### asset id 规则

- **asset id = 资产名**，禁止英文化 / kebab-case 转写。
- **asset id 语言** — 见 `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md`（规约所有产出文本含 asset id 的语言；同一 outline 内不混语言）
- 与 `creator-create-assets/rules.md:76` 文件名一致（资产名为「张三」→ 文件名 `张三.md` → asset id `张三`）。
- **明确禁止 LLM 自发添加英文 prefix / 转写**：
  - ❌ `char-沈昭`、`loc-地下室`、`item-旧怀表`（前缀英文化）
  - ❌ `char-shen-zhao`、`loc-basement`、`shen-zhao`（kebab-case 转写）
  - ❌ `Shen-Zhao` / `shen_zhao`（en 时大小写或连接符不一致）
  - ✅ `沈昭`（zh） / `Shen_Zhao`（en）

### 「本集新增资产」段格式（director-outline 阶段中间产物）

```
## 本集新增资产
- characters: 王五 (assets/characters/王五.md), 赵六 (assets/characters/赵六.md)
- locations: 地下室 (assets/locations/地下室.md)
- items: 旧怀表 (assets/items/旧怀表.md)
- buildings: (无)
```

- 按 asset 类型分组（4 类固定顺序：characters / locations / items / buildings）
- 每条 `<asset id> (assets/<type>/<asset id>.md)`
- 类型无新增写 `(无)`，**不可省略类型行**

### 复用判断（防止重复创建）

- 写入「本集新增资产」前**必须 Glob** `assets/{characters,locations,items,buildings}/*.md` 扫描已注册全集
- 资产名**精确匹配**已注册文件 → 直接复用（不入「本集新增资产」）
- 名字**相近**（"巡查义体" vs "天工坊巡查义体"）→ 优先复用更具体的已存在资产
- 同一资产不同造型 → 按 `creator-create-assets/rules.md:75` 判断是否独立变体文件

### 阶段流转

| 阶段 | outline.md 末尾段 | 操作 |
|------|----|----|
| director-outline 产出 | `## 本集新增资产` | Write |
| director-review-outline 检查 | `## 本集新增资产` | Read（dangling check 依据） |
| director-fix-outline 修订 | `## 本集新增资产` | Edit |
| scriptwriter-script Phase 5 后 | `## 本集资产清单`（含两子段 superset） | Edit（detect-then-write） |

director-outline 自身阶段仅写「本集新增资产」段；scriptwriter Phase 5 后段名切换为「本集资产清单」并扩充为含「### 新增资产」+「### 已有资产（本集出场）」两子段 superset，详见 scriptwriter-script/rules.md。
