---
name: director-fix-arc
description: 当现有 arc 的人物弧、转折分布、连续性或集数预算需要按授权请求或当前 findings 定向修订时使用。
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

## 输入

通过 prompt 接收:
- 授权修改请求（目标及具体意见），或当前 findings / `.review-arc.md` 路径（一般 `story/.review-arc.md`）

从请求理解受影响节点、人物或集数范围；定位、意图或保留要求不清先询问，不把“修 arc”解释为整份重构。

## 必读

- `story/arc.md` — 必读 (现有 arc, 待修订源)
- 提供的请求或 findings；仅当委托以 review 文件为依据时读取该文件，不强制寻找历史 review
- `${CLAUDE_PLUGIN_ROOT}/skills/director-arc/rules.md` — 必读并严格遵循 (schema / 节点合规性 / 失败模式)
- 实际配置 `SVD_CONFIG`（未设时 `config.md`）— 本文 config.md 均指实际路径
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md` — 必须读取（语言一致性）

## 修订方法（按问题选用）

以下适合定位并修复已知问题，不是每次必走的阶段；局部措辞可直接定位，结构或预算问题再追踪事件分配。schema、确认预算与授权范围不因方法可选而放宽。

### Phase 1: 读现状

1. Read `story/arc.md` 取现有阶段规划
2. Read 实际配置，用 `bash "${CLAUDE_PLUGIN_ROOT}/scripts/read-config.sh" "总集数" "${SVD_CONFIG:-config.md}"` 取整数 N
3. 读委托指定意见；涉及跨集事实时读相关剧本、已有摘要或小说片段

### Phase 2: 确认当前修订依据

直接请求只使用本次授权目标和意见。使用 review 文件时定位最新相关轮次，并核对问题仍存在于当前 arc；意见过时或相互冲突则说明并协调，不自动拼接旧意见。

### Phase 3: 定向修订

节点显得空泛时，定位缺的是动机、行动后果还是揭示后的反应。可把“发现真相”具体化为“知道盟友隐瞒后撤回合作”，使信息改变关系与下一步选择；若转折仓促，检查已有线索如何被误读或忽略，再补授权内必要依据，而不是按配额增加反转。只修现有问题，跨节点重分配或改变核心承诺先协调。

- 只动当前请求 / findings 指出的问题及必要的相邻一致性修正
- 其他内容 (未提及的节点 / 阶段) 保留原样
- 维持 schema 合规 (按 director-arc/rules.md 节点定义)
- 修订后节点总集数严格等于 N

### Phase 3.5: 预算与格式修复（适用时）

若本次任务涉及完整规划交付或预算/格式 findings，按以下方式补足缺失字段；局部修改发现范围外缺口则报告，不擅自扩展为全文迁移：

1. 对受影响节点按 director-arc/rules.md 从实际配置计算预算，写入 header (epXX-YY, 节点预算 ~Zs)；arc-budget.sh 仅可用于实际默认配置，不支持配置参数或 SVD_CONFIG
2. 把核心事件 prose 段拆为 bullet 列表
3. 为每 bullet 加 `(~Ns, 必需|可选)` 标记（LLM 重新决策估时与必需/可选分类）
4. 校验 sum ≤ 预算；超预算按实际叙事取舍，不改确认集数、不用压低估时或改标可选伪造合格。系列保留初始共同目标，不随前集实际时长漂移

无法校验的字段不能算通过；需要超出授权范围的结构改动时交回协调。

### Phase 4: 自检

按 director-arc/rules.md 失败模式清单逐项自查:
- 节点范围连续、不重叠且覆盖确认总集数，不按节点数量或均匀程度判定
- 节点描述是否足以理解事件、人物选择与阶段作用，不强求每节点都有冲突和收束
- 与 config.md 总集数一致

先保存授权修订，再运行文件校验：

```bash
bash ${CLAUDE_PLUGIN_ROOT}/scripts/arc-event-sum.sh story/arc.md
```

退出码非 0 → 在授权范围内修正 schema / 超预算问题后复查；无法解决则返回阻塞，不以反复重试替代决策。

未通过的完整规划不能声明验收完成；局部修改可交付并明确剩余缺口。

### 交付

先保存授权修订再运行文件校验。仅更新 `story/arc.md`，返回变化范围、检查结果及对相关剧本/规划的影响；跨 owner 的修改交 Director 协调，不自行改写或宣告审核通过。

## 失败处理

- 指定 review 无法确定当前意见：返回问题；直接授权请求不需要 review 标题
- 总集数校验失败: 报错退出 "修订后节点集数总和 ≠ config 总集数 N"
- schema 违规：授权范围内修复，否则报告所需决策，不无限重试
