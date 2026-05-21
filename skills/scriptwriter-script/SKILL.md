---
name: scriptwriter-script
description: 把 outline (+ series 模式下的 novel) 转译为可拍摄剧本。半结构化场景级 schema，自由分配场景时长，Phase 5 把 outline 末尾 `## 本集新增资产` 段切换并扩充为 `## 本集资产清单` superset (含 ### 新增资产 + ### 已有资产（本集出场）)。
user-invocable: false
context: fork
agent: scriptwriter
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入
通过 prompt 接收：
- mode: 'new-series' | 'continue-series' | 'short'
- ep: 'epXX'

## 必读文件
- `skills/scriptwriter-script/rules.md` — 必须读取并严格遵循 (公共规则)
- `skills/scriptwriter-script/series.md` (when mode in {new-series, continue-series}) — 含 novel 输入处理
- `skills/scriptwriter-script/short.md` (when mode=short) — 无 novel 输入

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (双重保护)
1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode in {'new-series', 'continue-series'}: Read('skills/scriptwriter-script/series.md')
   - mode='short': Read('skills/scriptwriter-script/short.md')
3. **不要**加载非当前 mode 的文件
4. 严格按"公共骨架 + 当前 mode 文件"指引执行后续 Phase

### Phase 2: 上下文准备
- 读 `config.md`
- 读 `story/episodes/{ep}/outline.md`
- 按 mode (series) 读 `story/episodes/{ep}/novel.md`
- 其余上下文按 series.md / short.md 指引

### Phase 3: 扫描 assets/ 复用
执行命令：
```bash
ls -1 assets/{characters,locations,items,buildings}/*.md 2>/dev/null
```
对已存在 asset 优先复用，避免重复创建。

### Phase 4: 生成剧本
- 按场景级 schema 展开 (详见 rules.md §3.4)
- 自由分配场景时长 (节奏角色为软引导，剧本以可拍摄性为最高目标，不硬 mapping)
- 写入 `story/episodes/{ep}/script.md`

### Phase 5: 写「本集资产清单」superset 到 outline (含 detect-then-write)

完整流程详见 `skills/scriptwriter-script/rules.md` 「scriptwriter Phase 5」段。摘要：

1. Read outline.md 末尾 `## 本集新增资产` 段（director-outline 阶段产物）
2. Grep 本集 script.md 所有 `assets/{characters,locations,items,buildings}/<名称>.md` 引用路径（**不兜底**，未带路径的 asset 名不识别 → 依赖 director-review-script hard gate 拦截）
3. Glob `assets/{characters,locations,items,buildings}/*.md` → 已注册全集
4. 路径分类:
   - ∈ 已注册 → 复用 asset
   - ∉ 已注册 → 新增 asset
5. 合并 + dedupe by 路径:
   - "新增" 子段 = outline 初稿 ∪ 剧本提取的新增
   - "已有（本集出场）" 子段 = 复用集
6. **detect-then-write** outline.md（3 态自适应）:
   - 状态 A（已有 `## 本集新增资产`）→ 删除该段 + Append `## 本集资产清单`
   - 状态 B（已有 `## 本集资产清单`）→ in-place 重写（仅替换该段，其他段保留）
   - 状态 C（两段都无）→ Append `## 本集资产清单`

替换必须按 `^## ` 严格分段定界，不破坏用户手工添加的其他 section。

### Phase 5 段格式

```
## 本集资产清单

### 新增资产
- characters: <ids>
- locations: <ids>
- items: <ids>
- buildings: <ids>

### 已有资产（本集出场）
- characters: <ids>
- locations: <ids>
- items: <ids>
- buildings: <ids>
```

每类型行齐全顺序固定，无内容写 `(无)`。asset id 按 director-outline/rules.md「asset id 规则」编写。

### Phase 6: 自检
- 调用 `scripts/scene-duration.sh` 校验场景"目标时长"字段累加和是否落在 target × [0.9, 1.1] 区间
- 调用方式见 spec §3.4
- 不通过则回到 Phase 4 微调
