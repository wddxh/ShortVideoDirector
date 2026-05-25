## 输出 schema (per spec §3.4)

每个场景必须严格按以下 7 sections 顺序输出：

```markdown
# epNN 剧本

## 场景 N: <名字>
- 节奏角色: <开场/铺垫/冲突/高潮/收束/过渡>
- 目标时长: <N>s  (可选注释: 微调原因，例 "25s (微调: 对白密集，从基准 20s 加到 25s)")
- 地点: <名称> (assets/locations/<名称>.md)
- 时间: <时间描述>
- 氛围: <环境氛围、光线、声音环境>
- 出场角色: <角色1>, <角色2>

### 视觉摘要
<2-3 句视觉关键点描写：构图焦点、对比元素、符号道具。不指定景别/运动/镜头。>

### 场景内容
<prose 风格的连贯叙事：角色动作、对白、内心独白、旁白、声音反应交织。音效融在 prose 里 (如 "远处响起雷声")，无需 [音效] 标签。>

### 转场
<切 / 淡入淡出 / 叠化 / 划像> → 场景 N+1

## 场景 N+1: ...
（同上结构）

## 本集时长校验
- 总目标: <target_min>-<target_max>s  (config 每集时长目标 = "<原始值>")
- 场景分配: [<s1>, <s2>, ..., <sN>]
- 分配 sum: <SUM>s  (落在 [<min>, <max>] 范围内)
```

**注意**：`## 本集时长校验` section **仅 LLM 自检显示用，不是校验数据源**。真正校验由 `scripts/scene-duration.sh` 从每场景"目标时长"字段累加。

## 节奏 → 时长映射

1. **LLM 自由分配** — 节奏角色作为软引导，参考分布：
   - 高潮 ~30%
   - 冲突 ~25%
   - 铺垫 ~20%
   - 开场 / 收束 / 过渡 共 ~25%

   实际分配由 LLM 根据本集剧情张力自由调整，软引导**非硬约束**。

2. **微调注释** — 偏离基线的场景必须在"目标时长"字段加注释说明偏离原因：
   - 例 `25s (微调: 对白密集，从基准 20s 加到 25s)`
   - 例 `18s (微调: 纯动作无对白，从基准 25s 降到 18s)`

3. **硬校验** — 必须通过 `scripts/scene-duration.sh` 校验：
   - 用法 1: `scripts/scene-duration.sh <script.md> --target <N>` (单值目标)
   - 用法 2: `scripts/scene-duration.sh <script.md> --target-min <M> --target-max <X>` (范围目标，对应 config 如 "3-5分钟")
   - 通过条件: 场景"目标时长"字段累加 sum ∈ target × [0.9, 1.1] 或落在 [target_min, target_max] 范围
   - 退出码 0=PASS, 1=FAIL；FAIL 必须调整场景时长重写并再次校验直到通过

## 场景级内容密度预算

每场景写完后按目标时长算字数预算。

**密度档位：6-10 字 / 秒**（中位 8；含视觉摘要 + prose 场景内容 + 对白 + 内心独白；不计 markdown 章节标题等结构字符）

| 场景目标时长 | 字数预算（中位 8 字/秒，单边 0~+30%） |
|---|---|
| ≤10s | 80-104 字 |
| 10-25s | 80-260 字 |
| 25-60s | 200-624 字 |
| >60s | 按 8 字/秒线性，单边 0~+30% |

**单边 0~+30% 容差**：
- 不允许下浮（actual < duration × 8 即 fail，必补）—— 写不足导致 storyboarder 无内容拆切片
- 允许上浮 0~+30%（actual ≤ duration × 10.4 即 ok）—— 适度厚度给 storyboarder 留删减空间
- 超 +30%（actual > duration × 10.4）即 fail，必删 —— 远超内容会让 storyboarder 砍剧情或加 shot 数

**自检方法**：写完每场景后心算字数 (`< duration × 8` 必补；`> duration × 10.4` 必删)。

**全集兜底**：下游 director-review-script Phase 3 调 `scripts/script-budget.sh` 算每场景字数 vs 预算；任一场景 fail → 整集打回。

**与「节奏 → 时长映射」+ scene-duration.sh 关系**：节奏映射 + scene-duration.sh 校验**时长**分配；本段校验**字数**密度。两者独立硬约束，必须同时通过。

## Asset 复用与新增

- **优先复用**：在写剧本前必须扫描 `assets/{characters,locations,items,buildings}/` 目录，剧本中引用的角色/地点/物品/建筑若已存在，直接复用既有 asset 路径，**不重复创建**。
- **新增**：仅当剧情真正引入既有 assets/ 中没有的新元素时才作为"本集新增资产"。
- **引用格式**：在元数据字段中按 `<名称> (assets/<type>/<名称>.md)` 引用既有资产。

## scriptwriter Phase 5: 本集资产清单 superset 写回 outline.md

剧本生成完毕后，scriptwriter 必须在 Phase 5 把 outline.md 末尾的 `## 本集新增资产` 段（director-outline 阶段产物）**切换并扩充为** `## 本集资产清单` superset 段（含两子段）：

```
## 本集资产清单

### 新增资产
- characters: 王五 (assets/characters/王五.md), 赵六 (assets/characters/赵六.md)
- locations: 地下室 (assets/locations/地下室.md)
- items: 旧怀表 (assets/items/旧怀表.md)
- buildings: (无)

### 已有资产（本集出场）
- characters: 张三 (assets/characters/张三.md), 李四 (assets/characters/李四.md)
- locations: 茶馆 (assets/locations/茶馆.md)
- items: (无)
- buildings: 鼓楼 (assets/buildings/鼓楼.md)
```

### 段格式约束

- 段标题固定 `## 本集资产清单`（不带阶段标注）
- 子段顺序固定: 先「### 新增资产」后「### 已有资产（本集出场）」
- 每子段下 4 类型行齐全顺序固定（characters / locations / items / buildings），无内容写 `(无)`
- 每条 `<asset id> (assets/<type>/<asset id>.md)`，asset id 严格遵循 director-outline/rules.md「asset id 规则」

### Phase 5 完整流程

1. **Read** `story/episodes/{ep}/outline.md`
   - 取既有 `## 本集新增资产` 段（director-outline 阶段写的初稿）
2. **Read 本集 script.md**（即 scriptwriter 自己刚生成的剧本）
   - Grep 所有形如 `assets/{characters,locations,items,buildings}/<名称>.md` 的引用路径
   - 去重得到本集 asset 全集（路径列表）
   - **不兜底**：剧本中未带路径的 asset 名（仅写"张三"无 `(assets/...)`）**不识别**（依赖 director-review-script hard gate 拦截）
3. **Glob** `assets/{characters,locations,items,buildings}/*.md` → 已注册全集
4. **分类**（按文件路径判定）:
   - 路径 ∈ 已注册 → 复用 asset
   - 路径 ∉ 已注册 → 新增 asset
5. **合并**:
   - "新增资产" 子段 = outline 初稿「本集新增资产」+ 剧本提取的新增 → dedupe by 文件路径
   - "已有资产（本集出场）" 子段 = 复用集 → dedupe by 路径
6. **Edit outline.md**（detect-then-write 决定具体位置，见下）:
   - 删除 `## 本集新增资产` 段（director-outline 产物）
   - 写入 `## 本集资产清单` 段（含两子段）

### detect-then-write 规则（兼容已有 outline.md）

outline.md 扫描已有段名（按 `^## ` 分段定界），按状态分支:

- **状态 A**（已有 `## 本集新增资产`）→ **删除该段 + Append `## 本集资产清单` 段**
- **状态 B**（已有 `## 本集资产清单`）→ **in-place 重写**（仅替换该段及两子段，其他段保留）
- **状态 C**（两段都无）→ **Append `## 本集资产清单` 段**

替换逻辑必须按 `^## ` 严格分段定界（精确边界），**不破坏用户手工添加的其他 section**（如 `## 拍摄备注` 之类）。

### 失败模式

1. 段格式破损（类型行缺失 / 子段顺序错乱）—— 下游 8 skill / 10 文件读 outline 解析失败（见 spec §2.4 文件修改清单）
2. asset id 英文化（违反 director-outline/rules.md「asset id 规则」）—— 与 creator-create-assets 文件名错配
3. 子段重复 / dedupe 不全（同 asset 在新增 + 复用同时出现）
4. detect-then-write 破坏用户手工段（替换边界不准）—— 必须按 `^## ` 严格分段

## 公共失败模式 (须主动规避)

1. **写镜头建议** — 越权到分镜师领域 (如"全景推进"/"特写脸部"/"低角度仰拍")
2. **把剧本写成简化小说** — 无场景结构、无时长分配、无视觉摘要、无转场字段
3. **节奏分布失衡** — 高潮场景 < 总时长 20% (整集缺戏剧高点)
4. **场景对白配速不可拍** — 对白量与场景目标时长不匹配，后续切片必撞 speech-rate gate
5. **视觉摘要含具体镜头建议** — 应只描述视觉关键点 (构图、对比、符号道具)，不指定景别/镜头运动
6. **转场字段缺位** — 场景间缺"切/淡入淡出/叠化/划像"等转场指示
7. **本集新增资产列表不全 / 过度引入** — 剧本引用了 [新道具] 但未追加到 outline；或一集新增 ≥5 角色导致剧本失焦

## 通用规则

- **台词精准** — 每句台词都必须为剧情推进或人物塑造服务，无废话
- **丰富台词设计** — 充分设计对白、内心独白、旁白和角色声音反应 (吼叫、哭泣、叹息等)，场景描写和动作描写要足够详细
- **场景具象化** — 场景描写必须具体、可视觉化，多用具象描写而非抽象叙述
- **节奏适配** — 严格遵循 config.md `每集时长目标`，重要场景留足铺垫空间，不在有限时长内压缩过多剧情
- **遵循大纲** — 必须遵循大纲的故事弧线和结局设计，不得与大纲矛盾
- **角色声音一致** — 角色声音特征必须与资产文件中 `## 声音特征` 描述保持一致
- **主角内心独白** — 多设计主角内心独白，展现想法/感受/判断，增强代入感
- **禁止旁白式叙述** — 场景信息应通过角色对话、自白或反应来传达，避免上帝视角解说
- **注重画面感** — 多用具象描写而非抽象叙述；人物外貌、动作、表情有细节描写
- **版权规避** — 不得使用现实中的明星或公众人物名字、真实地名、商标名
- **输出语言** — 所有输出内容的语言必须遵循 config.md `语言` 设置
