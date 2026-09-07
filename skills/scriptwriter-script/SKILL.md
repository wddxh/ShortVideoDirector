---
name: scriptwriter-script
description: 当故事需要可拍摄剧本、文学改编，或现成剧本需要采用、场景整理与制作资产识别时使用。
user-invocable: false
agent: scriptwriter
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入
从委托确认目标集数、单集/系列语境、素材路径、保留要求与可调整范围。可直接采用成熟剧本，不必先有 outline / novel / arc，也不要求内部参数表；范围不清先询问。

## 必读文件
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/rules.md` — 必须读取并严格遵循 (公共规则)
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/series.md` (when mode in {new-series, continue-series}) — 连续性与可选文学素材处理
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/short.md` (when mode=short) — 单集戏剧弧与结局落点
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 改编与采用方法（参考）

### 选择相关参考
按委托选读 series.md / short.md。新作可从戏剧动作展开，文学改编可从人物动机与声音提炼，成熟剧本可直接核对格式和清单，不要求逐阶段重做。schema、真实资产身份、授权及单集总时长仍是硬契约。

### Phase 2: 上下文准备
- 读实际 SVD_CONFIG（未设时 config.md）；本文及 companions 的 config.md 均指该路径
- 优先读用户提供或现有 `story/episodes/{ep}/script.md`，判断可采用部分与具体缺口
- outline / novel / arc 仅在存在且与当前改编相关时选读；不因缺少可选文件重建整条流程
- 其余上下文按 series.md / short.md 指引

### Phase 3: 扫描 assets/ 复用
用 Glob 查找 `assets/{characters,locations,items,buildings}/*.md`，只读取可能复用的相关资产卡。
对已存在 asset 优先复用，避免重复创建。

### Phase 4: 生成剧本
- 把重要场景写成“试图达成什么、怎样尝试、对方怎样回应、局面怎样变化”，给动作与反应留可表演的空间。薄场景可先想象具体现场再写对白，声音主导场景也可从听觉切入；rules.md 提供目标、利害关系、戏剧节拍与潜台词的解释和例子。
- 新写时按场景级 schema 展开；采用现成剧本时保留合适的场景、对白和结局，仅补齐所需格式、路径、时长及清单，不无理由重写故事
- 自由分配场景时长 (节奏角色为软引导，剧本以可拍摄性为最高目标，不硬 mapping)
- 写入 `story/episodes/{ep}/script.md`
- **密度诊断**：按 rules.md 对照实际对白、动作、停顿与调度判断可拍性；字数仅作线索，不自动补删，也不能放宽确认时长

### Phase 5: 在 script.md 维护「本集资产清单」

剧本分解（script breakdown）是从可拍场景识别制作所需角色、地点、道具和建筑，不是再创作故事。新写、采用与修订都遵循 rules.md 的清单规则：

1. 读实际场景，补全真实视觉资产的路径；排除清单自身、备注和仅被提及而不出镜的元素。
2. 按路径去重；未采用的大纲提案不并入清单。
3. 仍在场景中使用的旧清单条目保留新增/已有分类，不能因 Creator 已建卡就将本集新增改成已有。
4. 首次登记的引用按真实卡文件判断复用或新增；移除不再使用的条目，不删除资产卡。
5. 仅在 script.md 中替换现有清单，缺失则追加；不写回 outline，不把历史 outline 清单当最终依据。

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

每类型行齐全顺序固定，条目为 `<名称> (assets/<type>/<名称>.md)`，无内容写 `(无)`。asset id 即资产名，遵守共享语言规则与已存在的路径身份，不自行英文化或增加前缀。

### Phase 6: 自检
- 保存后按 rules.md 实跑 `scene-duration.sh` 核对确认边界；`script-budget.sh` 可作密度诊断，记录其 status，不作为创作 pass/fail。
- 运行 `node ${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs story/episodes/{ep}/script.md all` 验证清单格式；再逐场核对真实使用，解析成功不代表语义完整。
- schema、时长或身份校验失败在授权内修正；无法满足则报告阻塞，不用补造小说或大纲绕开。计数偏差需结合可拍性判断，不自动扩写。
- 返回采用/改动范围、检查结果与对现有分镜和资产的影响。其他 owner 的修改由 Director 协调；自检不代替独立审核，预审待批时不自行推进正式制作。
