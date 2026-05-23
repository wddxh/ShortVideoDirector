# Series Mode: director-outline 专属指南

## 额外上下文读取
- 读 story/arc.md (必读，识别当前 ep 对应 arc 节点)
- mode='continue-series': 读 story/outline.md 摘要 + 上一集 outline.md (看连续性)

## Phase 4: 补充字段

### 顶部插入 (在"本集信息传达"之上)

## 在 arc 中的位置
- arc 节点: {N} ({节点名})
- 本集主要事件锚点:
  - {arc 节点中该 bullet 事件首句复述 1}
  - {arc 节点中该 bullet 事件首句复述 2}
  - ...
- 本集对节点的推进: {1-2 句话}

### ep01 only: 在"在 arc 中的位置"之下插入

## 开场策略
{开场怎么抓人}

### 末尾插入 (在"场景列表"之后)

## 集尾钩子
{留给下一集的戏剧悬念，不是"下集见"}

## Phase 6: 同步全局 outline
追加 ## epXX 摘要 到 story/outline.md
摘要含: 主要场景 (标题列表) + 集尾钩子

## Series 专属失败模式
- 与 arc 脱节: outline 没体现本集应推进的 arc 节点
- 集尾钩子无力: 钩子是"下集见"或"主角思考"而非戏剧悬念
- 续集忽视前集设置: 引入与既有 arc/上集冲突的新元素
- 跨集人物状态不一致: 上集结束角色 X 已知 Y，本集开头又问 Y 是什么
- 跳跃式开场承接生硬: 开场用高潮/悬疑跳跃式抓人后，第二场景没有自然承接

## 「本集新增资产」段 series 模式补充

（公共规则见 director-outline/SKILL.md Phase 5 + director-outline/rules.md 「新增资产规则」段）

series 模式额外约束:
- **arc.md 已声明的角色**：若本集首次出场, 仍按"新增"列入「本集新增资产」段（arc.md 是叙事大纲非 asset 注册表; 实际 asset 创建归 creator-create-assets 在本集执行）
- **continue-series 模式**: 前集 outline.md「本集资产清单」中的 asset（已由前集 scriptwriter Phase 5 落地为 `assets/<type>/<名称>.md` 文件）→ 本集复用, **不入**「本集新增资产」（Glob 已注册 → 直接复用）
