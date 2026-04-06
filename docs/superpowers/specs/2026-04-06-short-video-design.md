# 单集短视频功能设计

## 概述

新增单集短视频创作功能（`/short-video`），与现有多集系列视频（`/series-video`）区分。单集短视频是独立的、剧情简单但完整的短视频，支持各类主题（搞笑反转、温馨治愈、悬疑烧脑、日常共鸣、情感冲击等）。

## 工作流程

```
/short-video [故事材料]
  |
  1. 配置加载（短视频专属配置）
  |
  2. 输入分流
  |-- 有故事材料 → short-input-confirm（Director 确认输入）
  +-- 无故事材料 → short-plot-options（Director 生成 3 个选项）
  |
  3. short-outline（Director 生成单集大纲）
  |
  4. scriptwriter-script（Scriptwriter 写剧本）
  |
  5. director-review-script（Director 审核剧本，最多 2 轮修正）
  |
  6. storyboarder-asset-list（Storyboarder 提取资产清单）[复用]
  |
  7. creator-create-assets（Creator 创建资产）[复用]
  |
  8. short-storyboard（Storyboarder 生成分镜，自检最多 3 轮）
  |
  9. short-review-storyboard（Director 审核分镜，最多 2 轮修正）
  |
  10. 完成
```

## 新增 Agent

### Scriptwriter（`agents/scriptwriter.md`）

短视频编剧，擅长在 1-2 分钟内讲完一个完整故事。

角色定位：
- 精通各类短视频风格：搞笑反转、温馨治愈、悬疑烧脑、日常共鸣、情感冲击
- 台词设计精准，每句台词都为剧情推进或人物塑造服务，无废话
- 善于利用内心独白快速建立观众代入感
- 节奏感强，懂得在短篇幅内制造情绪起伏（铺垫 → 冲突 → 高潮 → 收束）
- 注重"可拍性"，场景描写服务于视觉呈现，避免难以影像化的抽象内容

职责：
- 将 Director 大纲转化为剧本
- 台词设计（对白、内心独白、旁白、声音反应）
- 场景动作设计
- 情绪节奏把控

不负责：镜头语言、视频技术参数（Storyboarder 的职责）

## 新增 Skill

### 1. `short-video/`（入口）

用户可调用 skill。参数：`[故事材料|文件路径]`

流程：
1. **配置加载** — 读取或创建 `config.md`（短视频专属配置，见配置章节）
2. **输入解析** — 解析 `$ARGUMENTS` 获取故事材料
   - 特殊命令：`$ARGUMENTS` 为 `config` → 展示并编辑配置，流程结束
   - 故事材料为空 → 无材料
   - 故事材料以 `.txt` 或 `.md` 结尾 → 读取文件内容
   - 其他 → 内联文本
3. **输入分流**：
   - 有故事材料 → 调用 `short-input-confirm` skill
   - 无故事材料 → 调用 `short-plot-options` skill
4. **创建目录**：`story/`、`story/episodes/ep01/`、`assets/characters/`、`assets/items/`、`assets/locations/`、`assets/buildings/`
5. **执行流水线**：按顺序调用 skill（工作流程步骤 3-9）

### 2. `short-plot-options/`（Director 生成选项）

读取：`config.md`

输出格式（3 个选项）：
```markdown
## 选项 A: {主题名称}
- **剧名：** {剧名}
- **剧情概要：** {一句话概括完整剧情走向}
- **结局类型：** {反转/温馨/开放/幽默/...}
- **卖点分析：** {为什么适合短视频}

## 选项 B: {主题名称}
...

## 选项 C: {主题名称}
...
```

用户选择一个选项（或要求重新生成）。

### 3. `short-input-confirm/`（Director 确认用户输入）

读取：`config.md`

将用户故事材料结构化为：
```markdown
## {主题名称}
- **剧名：** {剧名}
- **剧情概要：** {一句话概括完整剧情走向}
- **结局类型：** {反转/温馨/开放/幽默/...}
- **卖点分析：** {为什么适合短视频}
```

用户确认或提供反馈。

### 4. `short-outline/`（Director 生成大纲）

读取：`config.md`

写入：`story/episodes/ep01/outline.md`（不写 `story/outline.md`）

输出格式：
```markdown
# {剧名} 大纲

## 故事类型
{搞笑反转/温馨治愈/悬疑烧脑/日常共鸣/情感冲击/...}

## 开场策略
{如何在前几秒抓住观众注意力}

## 主要事件
1. {铺垫}
2. {冲突/发展}
3. {高潮}

## 角色出场
- **{角色名}：** {外貌特征简述}；{性格简述} — {在故事中的作用}

## 结局设计
- **结局类型：** {反转/温馨/开放/幽默/...}
- **描述：** {具体结局描述}
```

规则：
- 必须在 config 时长目标内规划完整的故事弧线（铺垫 → 冲突 → 高潮 → 收束）
- 开场必须立即吸引观众
- 事件节奏应适配 1-2 分钟时长
- 结局类型根据故事类型和剧情灵活选择（反转、温馨、开放、幽默、自然等）
- 主角姓名必须传达
- 版权规避适用

### 5. `scriptwriter-script/`（Scriptwriter 写剧本）

Agent: scriptwriter

读取：`story/episodes/ep01/outline.md`、`config.md`、`assets/characters/*.md`（如有）

写入：`story/episodes/ep01/script.md`

输出格式：
```markdown
# {剧名} 剧本

## 场景 1: {场景名称}
**地点：** {具体地点}
**时间：** {时间描述}
**氛围：** {环境氛围、光线、声音环境}

{场景叙事：角色动作、对白、内心独白、旁白、声音反应交织的连贯描写。
风格类似小说但更精练，侧重可拍性。}

## 场景 2: {场景名称}
...
```

规则（独立 `scriptwriter-script/rules.md`）：
- 每句台词都必须为剧情推进或人物塑造服务
- 丰富的台词设计：对白、内心独白、旁白、声音反应
- 场景描写必须具体、可视觉化
- 节奏适配 1-2 分钟视频时长
- 必须遵循大纲的故事弧线和结局设计
- 角色声音与资产文件保持一致
- 版权规避
- 语言遵循 config.md 设置

### 6. `scriptwriter-fix-script/`（Scriptwriter 修正剧本）

Agent: scriptwriter

读取：现有 `script.md` + Director 修改意见

仅定向修正，不重写未提及的内容。

### 7. `director-review-script/`（Director 审核剧本）

Agent: director

读取：`story/episodes/ep01/outline.md`、`story/episodes/ep01/script.md`、`assets/characters/*.md`（如有）

规则参考：`scriptwriter-script/rules.md`

导演专属审核重点：
- **故事完整性** — 剧本是否覆盖了大纲的完整弧线（铺垫、冲突、高潮、收束）？
- **节奏** — 节奏是否合适，有无过于仓促或拖沓的段落？
- **人物一致性** — 动作和台词是否符合已建立的性格特征？
- **结局执行** — 结局是否匹配设计的类型并产生预期效果？

最多 2 轮反馈。包含版权规避检查。

### 8. `short-storyboard/`（Storyboarder 生成分镜）

Agent: storyboarder

读取：`story/episodes/ep01/outline.md`、`story/episodes/ep01/script.md`、资产文件、`config.md`、`short-storyboard/rules.md`

写入：`story/episodes/ep01/storyboard.md`

自检循环：最多 3 轮，按 rules.md 执行。

输出格式：与系列视频分镜格式一致（镜头类型、镜头运动、视频风格、时长、转场、画面与声音描述）。

### 9. `short-review-storyboard/`（Director 审核分镜）

Agent: director

读取：`outline.md`、`script.md`、`storyboard.md`、`assets/characters/*.md`

规则参考：`short-storyboard/rules.md`

导演专属审核重点：
- **叙事完整性** — 分镜是否覆盖了剧本的所有关键场景？
- **剧情节奏** — 节奏是否张弛有度？
- **人物言行一致性** — 动作和台词是否符合性格特征？
- **剧情铺垫是否充分** — 观众能否获得足够信息来理解剧情？

最多 2 轮反馈。

### 10. `short-fix-storyboard/`（Storyboarder 修正分镜）

Agent: storyboarder

读取：现有 `storyboard.md` + Director 修改意见

仅定向修正。

## 复用 Skill

- `storyboarder-asset-list` — 提取资产清单，标注新增/已有，写入 ep01/outline.md。**需小幅修改**：当前读取 `novel.md`，需支持当 `novel.md` 不存在时检测并读取 `script.md`（单集模式用剧本替代小说）
- `creator-create-assets` — 创建资产 Markdown 文件和图像提示词（无需修改）

## 分镜规则差异（short-storyboard/rules.md vs 系列视频）

沿用不变的规则（来自系列视频分镜规则）：
- 3: 镜头间连贯性
- 4: 镜头自包容
- 6: 角色台词密度（引用来源从"小说"改为"剧本"）
- 7: 旁白规则
- 8: 画面与声音连贯叙事
- 9: 视觉描述具象化
- 10: 视频风格一致性
- 11: 单镜头时长
- 12: 单镜头资产引用上限
- 13: 资产引用必须真实
- 14: 资产引用 Hybrid 模式
- 15: 分镜数量遵循 config
- 17: 主角内心独白
- 18: 台词时长匹配（含 `scripts/speech-rate.py` 工具量化验证）
- 19: 避免画面文字
- 20: 不可感知信息台词化

移除的规则：
- 1: 第一集定位（"后续剧情留给后续剧集"）— 不适用，单集必须讲完完整故事
- 2: 集间连贯性 — 不适用，无前集

修改的规则：
- 5: 结尾收束 — 从"悬念钩子吸引继续观看"改为"根据故事类型选择合适的结局方式（反转、温馨、开放、幽默、自然等）。最后一个镜头的最后几秒必须包含结束转场效果（如画面渐暗淡入黑幕、淡出等）"
- 16: 信息传达 — 从"结合原文和大纲"改为"结合剧本和大纲"

## 配置（短视频专属）

8 项配置（从原有 11 项中去除 3 项系列专属配置）：

1. 视频模型（generic/kling/runway/seedance2.0/自定义）
2. 图像模型（generic/midjourney/flux/nanobanana/自定义）
3. 视频风格（2D动漫/3D动漫/3D写实/2D手绘/自定义）
4. 语言（auto/zh/en/自定义）
5. 每集分镜数（10-20，推荐 15）
6. 每集时长目标（推荐 1-2 分钟）
7. 单镜头时长范围（推荐 10-15 秒）
8. 单镜头资产上限（推荐 5）

去除的配置项：
- 上下文集数（无前集）
- 默认模式（无 full-auto 批量模式）
- 每集小说字数（无小说，剧本长度由大纲内容自然决定）

## 目录结构

与系列视频一致，便于 skill 复用：

```
project/
├── story/
│   └── episodes/
│       └── ep01/
│           ├── outline.md      # 单集大纲
│           ├── script.md       # 剧本（新增，替代 novel.md）
│           └── storyboard.md   # 分镜
├── assets/
│   ├── characters/
│   ├── items/
│   ├── locations/
│   └── buildings/
└── config.md
```

## 插件结构（新增文件）

```
ShortVideoDirector/
├── agents/
│   └── scriptwriter.md                 # 新增
└── skills/
    ├── short-video/
    │   ├── SKILL.md                    # 新增 - 入口
    │   └── config-template.md          # 新增 - 8 项配置模板
    ├── short-plot-options/
    │   └── SKILL.md                    # 新增
    ├── short-input-confirm/
    │   └── SKILL.md                    # 新增
    ├── short-outline/
    │   ├── SKILL.md                    # 新增
    │   └── rules.md                    # 新增
    ├── scriptwriter-script/
    │   ├── SKILL.md                    # 新增
    │   └── rules.md                    # 新增
    ├── scriptwriter-fix-script/
    │   └── SKILL.md                    # 新增
    ├── director-review-script/
    │   └── SKILL.md                    # 新增
    ├── short-storyboard/
    │   ├── SKILL.md                    # 新增
    │   └── rules.md                    # 新增
    ├── short-review-storyboard/
    │   └── SKILL.md                    # 新增
    └── short-fix-storyboard/
        └── SKILL.md                    # 新增
```

合计：1 个新增 agent，11 个新增 skill（13 个新增文件 + rules 文件）
