---
name: scriptwriter-fix-script
description: 当现有剧本的对白、可拍性、连续性、时长或制作资产清单需要按授权请求或当前 findings 修正时使用。
user-invocable: false
agent: scriptwriter
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

## 输入

从委托理解目标集数、单集/系列语境、当前 findings 或授权请求、保留要求及修改范围，不要求内部命令语法或先经过某个阶段。
- 以 `.review-script.md` 为依据时读取最新相关轮并核对当前文本；直接请求不读取或拼接旧 review。
- 范围不清或意见与授权冲突时返回待确认问题，不用模式标签猜测修改许可。

## 必读文件
- `story/episodes/{ep}/script.md` — 必读 (现有剧本)
- 本集 outline — 存在且与改动相关时参考，不要求补建
- 实际配置 SVD_CONFIG（未设时 config.md）；本文及 companions 的 config.md 均指实际路径
- 受影响角色及视觉资产卡 — 核对相关身份与声音，不全读资产库
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-script/rules.md` — 必读并严格遵循 (公共规则)
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-fix-script/series.md` (when mode in {new-series, continue-series}) — 必读
- `${CLAUDE_PLUGIN_ROOT}/skills/scriptwriter-fix-script/short.md` (when mode=short) — 必读
- 仅以 `.review-script.md` 为意见来源时读取该文件；已提供当前 findings 或直接授权请求不需要历史 review
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 修订方法（参考）

### 选择相关参考
按委托选读 series.md / short.md。对白问题可从人物声音切入，时长问题可从表演与调度切入，不必逐阶段重做；当前意见、身份、清单和确认预算仍须核对。

### Phase 2: 读 script + 修订意见
- Read `story/episodes/{ep}/script.md` 现状
- Read `config.md` 与有关的现有材料
- 采用当前有效 findings 或授权请求；旧意见已不适用时说明，不机械重做
- 通读意见，把每条映射到具体场景 / 台词 / 动作描写
- 按 mode 指引选择相关连续性或文学依据，不强制 arc / novel 存在

### Phase 3: 按 mode 修正
- 场景只有概述时，可先恢复现场的站位、注意力和行动：谁在靠近、回避、递出或收回，哪次反应改变了下一句台词。这种视觉先行诊断能把“谈得很尴尬”转成可表演的停顿与选择；再结合具体声音，不规定固定写作顺序，也不替分镜指定景别。
- 台词修订可检查**潜台词（人物真正想要或不肯直说的意思）**与言语策略：请求失败后是在讨价还价、试探还是装作不在意？用改口、抢话、没接住的笑或明确内心声保留层次，不只换同义词。只补当前问题所需的行为与反应，不趁机改动其他场景。
- 按当前问题选用相关 companion 的修订方法
- 评估每条修正的连锁影响：改一句台词是否影响场景内时长分配？改场景描写是否需要同步调整动作 / 对白？
- 必要时把"修正一处"扩展为"修正这一处 + 同场景内被影响的台词与动作描写"，但不擅自改与意见无关的场景
- 保留具体行动、人物声音与动机，画面、对白、独白或旁白可按表达需要组织，不固定书写顺序

### Phase 4: 自检
- 按 scriptwriter-script/rules.md 从实际场景更新 script 内 `## 本集资产清单` 及两子段。排除清单自身和未采用提案，删除不再使用的条目，保留仍使用条目的新增/已有分类；建卡不触发改类。不写回 outline。
- 先保存修订，再运行 `node ${CLAUDE_PLUGIN_ROOT}/scripts/episode-assets.mjs story/episodes/{ep}/script.md all` 与 `scene-duration.sh`，按 rules.md 参数读取真实结果。`script-budget.sh` 可作诊断，其 fail 不是创作失败或自动补删授权。
- 每条意见是否落地？
- 场景结构与节奏未破坏 (`scripts/scene-duration.sh` 校验仍 PASS)？
- 角色声音是否仍与资产一致？
- rules.md 格式是否仍合规？
- 按 mode 文件中"专属失败模式"自查

### Phase 5: 输出
- 保存 `story/episodes/{ep}/script.md` 的授权修订，保留无关内容
- 返回具体变更、清单增删、检查结果及对分镜/资产的影响；超出授权或涉及其他 owner 的修改交 Director 协调，不能把修订自检算独立审核通过。

## 通用约束
- 分镜以剧本为直接依据，但不假设已经生成或审核过。修正只动当前问题及必要一致性范围，保留无关场景，报告实际影响而非重跑固定下游链
- 单集总时长服从用户确认的实际边界；系列沿用初始共同目标，不以前集实际时长重设。具体评估改动的节奏影响，不按模式默认分钟数或宣告所有分镜失效
- script 是 storyboard 的直接上游——主要事件 / 场景结构 / 台词的修改都可能让下游已生成 storyboard 失效
