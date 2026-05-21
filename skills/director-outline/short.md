# Short Mode: director-outline 专属指南

## 额外上下文读取
- 仅 config.md (无 arc，无全局 outline)

> 注: `故事类型` 字段不在 short.md outline 中要求。若用户/项目需要标注故事类型，应在 config.md 中声明。short.md 只在公共骨架基础上追加"开场策略"与"结局设计"两个字段，仍生成场景级 outline。

## Phase 4: 补充字段

### 顶部插入 (在"本集信息传达"之上，必含)

## 开场策略
{开场怎么抓人，单集没有"下集"承接，第一秒必须抓住}

### 末尾插入 (在"场景列表"之后)

## 结局设计
{结局合理性 + 情感落点：观众离场时记住什么}

## Phase 6: 同步全局 outline
跳过 (short 无全局 outline 文件)

## Short 专属失败模式
- 单集戏剧结构不完整: 场景节奏角色缺铺垫直接进入冲突 / 高潮后无收束场景
- 结局设计仓促: 结局是"故事结束"而非"情感落点"
- 开场过弱: 第一场景节奏角色不是"开场"或"铺垫" → 错过抓住观众
- 跳跃式开场承接生硬: 同 series 描述

## 「本集新增资产」段 short 模式补充

（公共规则见 director-outline/SKILL.md Phase 5 + director-outline/rules.md 「新增资产规则」段）

short 模式约束:
- **单集自闭合**: 无 arc / 跨集复用, 全部场景出场角色 / 地点 / 已知道具 / 已知建筑 → 入「本集新增资产」段
- **二次跑 short-video（同项目 ep02 等）**: 上一 ep 的 asset 也算复用（按 Glob `assets/{characters,locations,items,buildings}/*.md` 判断, 已注册 → 不入新增）
