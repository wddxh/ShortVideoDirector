---
name: short-video
description: 将故事创意转化为单集短视频的分镜提示词和资产图像提示词。输入故事点子或概述，输出完整的剧本、分镜和资产提示词。使用 /short-video 启动，/short-video config 编辑配置。
user-invocable: true
allowed-tools: Read, Write, Edit, Glob, Bash, Agent, Skill
argument-hint: "[故事材料|文件路径]"
model: opus
---

## 总流程

调用 `/short-video` 后，按以下顺序执行：

1. **配置加载** — 读取或创建 [config.md](config.md)（首次运行进入交互式引导）
2. **输入解析** — 解析用户输入，确定故事来源（内联文本/文件/交互式/Director 生成）
3. **创建目录** — 创建项目目录结构
4. **执行工作流** — 按顺序执行剧本创作流水线

**版权规避：所有生成内容（大纲、剧本、分镜、资产提示词等）不得出现现实中的明星或公众人物名字、真实地名、商标名或其他受版权/商标保护的名称，必要时使用虚构替代名称。**

**硬性约束：每次调用 `/short-video` 生成一个完整的单集短视频内容。** 生成完毕后 skill 结束。

## 阶段 1: 配置加载

1. 使用 Read 工具检查当前工作目录下是否存在 [config.md](config.md)
2. 若已存在 → 读取并解析配置值
3. 若不存在 → 进入**交互式配置引导**（仅首次运行），参考 [config-template.md](config-template.md) 模板进行交互式配置引导，逐个询问每项配置，每次只问一个，提供多选项供用户选择：

   **第 1 项：图像模型**
   - A) none（不生成图像）
   - B) dreamina（即梦）

   **若用户选择 dreamina，继续询问以下 3 项配置：**

   **第 1a 项：即梦 — 图像模型版本**
   - A) 4.0（免费，推荐）
   - B) 5.0（每张约 3 积分，画质更高）
   - C) 其他版本（3.0/3.1/4.1/4.5/4.6）

   **第 1b 项：即梦 — 图片比例**
   - A) 1:1（推荐）
   - B) 3:4
   - C) 16:9
   - D) 其他

   **第 1c 项：即梦 — 图片分辨率**
   - A) 2k（推荐）
   - B) 4k（仅 4.0+ 支持）

   **第 1d 项：视频模型**
   - A) none（不生成视频）
   - B) dreamina（即梦）

   **若用户选择 dreamina，继续询问以下配置：**

   **第 1e 项：即梦 — 视频模型版本**
   - A) seedance2.0fast（推荐，速度更快）
   - B) seedance2.0（标准）
   - C) seedance2.0fast_vip（VIP 加速）
   - D) seedance2.0_vip（VIP 标准）

   **第 1f 项：即梦 — 视频比例**
   - A) 16:9（推荐，横屏）
   - B) 9:16（竖屏，短视频常用）
   - C) 1:1
   - D) 其他

   **第 1g 项：即梦 — 视频分辨率**
   - A) 720p（当前仅支持 720p）

   **第 2 项：视频风格**
   - A) 2D动漫
   - B) 3D动漫
   - C) 3D写实
   - D) 2D手绘
   - E) 自定义输入

   **第 3 项：语言**
   - A) auto（跟随输入语言）
   - B) zh（中文）
   - C) en（英文）
   - D) 自定义输入

   **第 4 项：每集分镜数**（建议 10-20）
   - A) 10
   - B) 15（推荐）
   - C) 20
   - D) 自定义输入

   **第 5 项：每集时长目标**
   - A) 1-2分钟（推荐）
   - B) 2-3分钟
   - C) 自定义输入

   **第 6 项：单镜头时长范围**
   - A) 8-12秒
   - B) 10-15秒（推荐）
   - C) 12-18秒
   - D) 自定义输入

   **第 7 项：单镜头资产上限**
   - A) 3
   - B) 5（推荐）
   - C) 7
   - D) 自定义输入

   所有配置收集完毕后，根据用户选择生成 [config.md](config.md) 写入项目根目录。告知用户可通过 `/short-video config` 随时修改。若图像模型为 `dreamina`，在 config.md 中额外写入 `## 图像生成配置` 区域（包含即梦模型版本、图片比例、图片分辨率）。若图像模型为 `none`，不写此区域。若视频模型为 `dreamina`，在 config.md 中额外写入 `## 视频生成配置` 区域（包含即梦视频模型版本、视频比例、视频分辨率）。若视频模型为 `none`，不写此区域。

4. 解析以下配置值：
   - **图像模型**：none 或 dreamina
   - **图像生成配置**（仅图像模型非 none 时）：即梦模型版本、图片比例、图片分辨率
   - **视频模型**：none 或 dreamina
   - **视频生成配置**（仅视频模型非 none 时）：即梦视频模型版本、视频比例、视频分辨率
   - **视频风格**：视频的视觉风格（2D动漫/3D动漫/3D写实/2D手绘等）
   - **语言**：提示词输出语言
   - **每集分镜数**：每集包含的分镜数量
   - **每集时长目标**：每集目标时长
   - **单镜头时长范围**：每个分镜镜头的时长约束
   - **单镜头资产上限**：每个分镜镜头中引用资产的最大数量

## 阶段 2: 输入解析

解析 `$ARGUMENTS`，提取故事材料。

**特殊命令：** 若 `$ARGUMENTS` 为 `config`，使用 Read 打开 [config.md](config.md) 展示给用户，询问是否编辑。流程结束，不进入后续阶段。

**故事材料识别：**
- `$ARGUMENTS` 为空 → 无故事材料
- `$ARGUMENTS` 以 `.txt` 或 `.md` 结尾 → 使用 Read 读取该文件内容作为故事材料
- 其他 → 作为内联文本故事材料

## 阶段 3: 创建目录 + 输入分流

1. 使用 Bash 创建目录结构：`story/`、`story/episodes/ep01/`、`assets/characters/`、`assets/items/`、`assets/locations/`、`assets/buildings/`

2. 根据故事材料进行输入分流：
   - **有故事材料** → 使用 Skill tool 调用 `short-input-confirm` skill，传递参数：`"{story_input}"`，等待用户确认
   - **无故事材料** → 使用 Skill tool 调用 `short-plot-options` skill，等待用户选择

## 阶段 4: 执行工作流

按以下顺序执行：

**4.1 Director — 生成大纲：**

使用 Skill tool 调用 `short-outline` skill，传递参数：`"{用户确认的剧情方向文本}"`

**4.2 Scriptwriter — 写剧本：**

使用 Skill tool 调用 `scriptwriter-script` skill，传递参数：`ep01`

**4.3 Director — 审核剧本：**

1. 使用 Skill tool 调用 `director-review-script` skill，传递参数：`ep01`
2. 若"需修改"→ 使用 Skill tool 调用 `scriptwriter-fix-script` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

**4.4 Storyboarder — 提取资产清单：**

使用 Skill tool 调用 `storyboarder-asset-list` skill，传递参数：`ep01`

**4.5 Creator — 创建资产：**

使用 Skill tool 调用 `creator-create-assets` skill，传递参数：`ep01`

**4.6 生成分镜 + 生成资产图片（并行）：**

若 config 中图像模型非 `none`，以下两条线并行执行（分镜流程不等待图片完成）：

**图片生成线（后台）：**
使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`ep01`

**分镜流程线（前台，正常推进）：**
1. 使用 Skill tool 调用 `short-storyboard` skill，传递参数：`ep01`

若 config 中图像模型为 `none`，仅执行分镜流程线。

**4.7 Director — 审核分镜：**

1. 使用 Skill tool 调用 `short-review-storyboard` skill，传递参数：`ep01`
2. 若"需修改"→ 使用 Skill tool 调用 `short-fix-storyboard` skill，传递参数：`ep01 "{修改意见}"`（最多 2 轮）

**4.8 完成：**

输出摘要：剧名、镜头数量（分镜数量）、新建资产列表。
