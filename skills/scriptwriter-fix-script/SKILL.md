---
name: scriptwriter-fix-script
description: 按修订意见定向修正本集 script.md。按 mode 自动加载 series.md 或 short.md 专属指南。
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
- 修订意见 (用户编辑请求或 .review-script.md 最后一轮意见)

## 必读文件
- `story/episodes/{ep}/script.md` — 必读 (现有剧本)
- `story/episodes/{ep}/outline.md` — 必读
- `config.md` — 必读
- `assets/characters/*.md` — 若存在则全部读取 (角色声音一致性)
- `skills/scriptwriter-script/rules.md` — 必读并严格遵循 (公共规则)
- `skills/scriptwriter-fix-script/series.md` (when mode in {new-series, continue-series}) — 必读
- `skills/scriptwriter-fix-script/short.md` (when mode=short) — 必读
- `story/episodes/{ep}/.review-script.md` — 若存在则必读 (含本轮 review 意见)

## 工作流

### Phase 1: 检测 mode 并加载专属指南 (必做)
1. 解析 prompt 中的 mode 参数
2. 按 mode 用 Read tool 加载**仅对应 mode 的文件** (避免 prompt 污染):
   - mode in {'new-series', 'continue-series'}: Read('skills/scriptwriter-fix-script/series.md')
   - mode='short': Read('skills/scriptwriter-fix-script/short.md')
3. **不要**加载非当前 mode 的文件
4. 严格按"公共骨架 + 当前 mode 文件"指引执行后续 Phase

### Phase 2: 读 script + 修订意见
- Read `story/episodes/{ep}/script.md` 现状
- Read `story/episodes/{ep}/outline.md`, `config.md`
- 若 `.review-script.md` 存在: Read 并 grep `^## 第 [0-9]+ 轮` 找最大 N，使用该段意见
- 通读意见，把每条映射到具体场景 / 台词 / 动作描写
- 按 mode 文件指引读其余上下文 (series 需 arc.md / novel.md / 上集 script)

### Phase 3: 按 mode 修正
- 按 Phase 1 加载的 series.md / short.md 指引定向修改
- 评估每条修正的连锁影响：改一句台词是否影响场景内时长分配？改场景描写是否需要同步调整动作 / 对白？
- 必要时把"修正一处"扩展为"修正这一处 + 同场景内被影响的台词与动作描写"，但不擅自改与意见无关的场景
- 仍用 scriptwriter-script 的"画面在前，对白在后"和"每句台词服务剧情或塑造人物"原则

### Phase 4: 自检
- 每条意见是否落地？
- 场景结构与节奏未破坏 (`scripts/scene-duration.sh` 校验仍 PASS)？
- 角色声音是否仍与资产一致？
- rules.md 格式是否仍合规？
- 按 mode 文件中"专属失败模式"自查

### Phase 5: 输出
- 使用 Write 覆写 `story/episodes/{ep}/script.md`

## 通用约束
- 下游消费者是 short-storyboard (拆分镜) 和 director-review-script (审稿)，它们已基于"修改前"运作过一轮——修正必须只动指出的问题，未涉及部分逐字保留
- 短视频时长极紧 (通常 1-3 分钟，series 单集 3-5 分钟)，任何台词或场景结构改动都会重新分配节奏；超改 = 节奏失衡 + 已分镜场景失效
- script 是 storyboard 的直接上游——主要事件 / 场景结构 / 台词的修改都可能让下游已生成 storyboard 失效
