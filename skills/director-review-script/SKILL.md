---
name: director-review-script
description: 审核单集 script.md 的剧本级合理性 (节奏分布 / 视觉节点覆盖 / asset 列表完整性 + mode 专属戏剧弧)。本 skill 接管 narrative review (旧 director-review-keyframes-narrative 已下线)。按 mode 加载 series.md 或 short.md 专属指南。
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入
通过 prompt 接收：
- mode: 'new-series' | 'continue-series' | 'short'
- ep: 'epXX'

## 必读文件
- `story/episodes/{ep}/script.md` — 必读 (review 目标)
- `story/episodes/{ep}/outline.md` — 必读 (剧本骨架对照)
- `config.md` — 必读 (每集时长目标)
- `assets/characters/*.md`, `assets/locations/*.md`, `assets/items/*.md`, `assets/buildings/*.md` — Glob 列出 (asset 引用核对)
- `skills/scriptwriter-script/rules.md` — 必读 (公共机械规则)
- `skills/director-review-script/series.md` (when mode in {new-series, continue-series}) — 必读
- `skills/director-review-script/short.md` (when mode=short) — 必读

## 接管说明
本 skill **接管原 director-review-keyframes-narrative 的叙事审核职责**。新架构下 keyframes 已不作为独立 narrative 审核节点——script 即叙事骨架，narrative review 在此层一次完成。

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (必做)
1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode in {'new-series', 'continue-series'}: Read('skills/director-review-script/series.md')
   - mode='short': Read('skills/director-review-script/short.md')
3. **不要**加载非当前 mode 的文件

### Phase 2: 读 script + 上下文
- Read script.md, outline.md, config.md
- Glob assets/ 建立已注册 asset 集合
- 按 mode 文件指引读其他上下文 (series 需 arc.md / 上集 script)
- 跑 `scripts/scene-duration.sh story/episodes/{ep}/script.md --target <N>` (N 从 config 取) 拿节奏分布数据

### Phase 3: 公共 review 项 (逐项检查)

1. **节奏分布合理性**
   - `scene-duration.sh` 输出: PASS / FAIL 状态 + sum 秒数
   - 节奏曲线: 按场景顺序看「目标时长 + 节奏角色」分布——是否有"全程冲突"或"全程铺垫"失衡
   - 单场景时长是否过长 (>30s 单一节奏角色) 或过短 (<5s 切碎)
   - 一场景只挂一个节奏角色 (公共规则呼应)

2. **视觉节点覆盖**
   - 剧本每个场景的"视觉摘要"字段是否覆盖该场景的关键视觉点 (构图焦点 / 道具 / 对比 / 符号)
   - 视觉摘要不能写成"一个紧张的场景"等抽象描述——必须给具体可拍画面
   - outline 主要事件每一项是否都能映射到 script 某场景 (枚举主要事件 → 逐项映射到场景 → 缺失打回)

3. **asset 列表完整性 (双向核对)**
   - 剧本中所有 character / location / item 引用 → 必须 ∈ (assets/ 已注册 ∪ outline.md「本集新增资产」)
   - outline.md「本集新增资产」每一项 → 必须在 script.md 中至少出现一次 (反之即冗余声明)
   - 列出所有 dangling 引用 + 冗余声明

4. **rules.md 机械约束**: 台词精准 / 场景具象 / 节奏适配 / 角色声音 / 禁旁白等

5. **mode 专属 review 项**: 见 series.md / short.md

**不审核** assets 卡描述一致性 (由 creator-create-assets 模板保证, spec §10 Q10 决策)。

### Phase 4: 决策与输出
- 只列**框架级 / 会让 storyboard 失败 / 会让剧情断裂**的问题；审美瑕疵不入清单
- 所有进入意见列表的项都会被 scriptwriter-fix-script 直接执行，2 轮 fix 上限内反复挑刺 → fix 反复打补丁
- 意见说清问题方向，不替 scriptwriter 写最终台词

### Phase 5: 写入 .review-script.md (append 模式)

**Round 自检**：
1. Read `.review-script.md` (若不存在为第 1 轮；存在则 grep `^## 第 [0-9]+ 轮` 找最大 N，本次为 N+1 轮)
2. Write (首次创建) 或 Edit (append；oldString 用文件末 50 字符 anchor) 追加本轮段

**本轮段格式** (每轮段前留空行)：

通过时仅 heading 行：`## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 通过`

不通过时：
```markdown

## 第 {N} 轮 ({YYYY-MM-DD HH:MM}) - 需修改 ({M} 项)

1. **{位置 (场景 N / 字段名 / "整体")}：** {问题描述} → {修改建议}
```

## 规则
- 最多 2 轮反馈
- 第 2 轮聚焦仍影响下游分镜的关键问题，不再挑刺
- 发现现实中明星 / 公众人物 / 真实地名 / 商标名，要求替换为虚构名称

## 输出
- 文件: Write 或 Edit `story/episodes/{ep}/.review-script.md` (append, 详见 Phase 5)
- 返回: `pass` 或 `needs_revision {M}` (M = 本轮意见条数) → 返回 workflow
- 详细意见已写入文件，下游 scriptwriter-fix-script 自行读取最后一轮段
