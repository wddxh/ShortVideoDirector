# 资产参考图片生成 设计文档

> **执行方式：** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。

**目标：** 利用即梦CLI（Dreamina CLI）为资产文件自动生成参考图片，并在现有 edit skill 中集成图片重新生成能力。

**架构：** 三层抽象 — skill 路由层根据 config 选择模型 skill，模型 skill 负责编排（登录检查、遍历资产、错误处理），脚本负责单张图片的机械执行（调用 API、下载文件）。

---

## 1. 三层抽象

### 1.1 路由层（业务 skill）

`creator-generate-images` 读取 `config.md` 中的 `图像模型` 值，使用 Skill tool 调用对应的模型 skill：
- `none` → 跳过，不调用
- `dreamina` → 调用 `creator-image-dreamina`
- 其他值 → 报错提示不支持

### 1.2 模型 skill 层（编排）

`creator-image-dreamina` — 即梦专属 skill，负责：
- 登录检查（`dreamina user_credit`）
- 遍历资产列表，逐个读取提示词
- 调用脚本生成图片
- 错误处理、跳过已有图片
- 输出生成摘要

未来新增模型 → 新增 `creator-image-{model}` skill。

### 1.3 脚本层（单次执行）

`scripts/image-gen-dreamina.sh` — 只负责单张图片的生成和下载，纯机械操作。

**输入参数：**
- `$1` — 提示词文本
- `$2` — 输出图片文件路径
- `$3` — 图片比例（可选，默认 `1:1`）
- `$4` — 分辨率（可选，默认 `2k`）
- `$5` — 模型版本（可选，默认 `4.0`）

**行为：**
1. 调用 `dreamina text2image --prompt="$1" --ratio="$3" --resolution_type="$4" --model_version="$5" --poll=60`
2. 解析返回 JSON 中的 `gen_status`：
   - `success` → 继续步骤 3
   - `fail` → 输出 `FAIL {fail_reason}` 并退出（exit 1）
   - `querying`（poll 超时，任务仍在排队/生成中）→ 提取 `submit_id`，输出 `PENDING {submit_id}` 并退出（exit 2）
3. 使用 `grep`/`sed` 从返回 JSON 中提取 `result_json.images[0].image_url`
4. 使用 `curl -fsSL` 下载图片到 `$2` 指定路径
5. 输出 `OK {文件路径}`

**退出码约定：**
- `0` — 成功，图片已下载
- `1` — 失败，任务出错
- `2` — 待定，任务仍在进行中，stdout 输出 `PENDING {submit_id}`

**实测数据（2026-04-11）：**
- 返回格式：JSON，图片 URL 在 `result_json.images[0].image_url`
- 2k 分辨率生成 2048x2048 图片，约 3MB/张
- `model_version=4.0` 不消耗积分；`model_version=5.0`（默认）每张 3 积分
- 支持的模型版本：3.0, 3.1, 4.0, 4.1, 4.5, 4.6, 5.0
- 3.0/3.1 支持 1k/2k；4.0+ 支持 2k/4k
- `--poll=60` 足够等待生成完成
- `user_credit` 未登录时 exit code 1，可用于登录检查

**可扩展性：** 未来增加其他模型时，新增对应的 `scripts/image-gen-{model}.sh`，保持相同的参数接口。

### 1.4 config.md 变更

**图像模型选项改为两个：**
- `none` — 不自动生成图像资产（默认）
- `dreamina` — 使用即梦CLI生成

**交互式配置引导流程：**

**图像模型选择：**
- A) none（不生成图像）
- B) dreamina（即梦）

若用户选择 `dreamina`，继续询问即梦相关配置：

**即梦 — 图像模型版本：**
- A) 4.0（免费，推荐）
- B) 5.0（每张约 3 积分，画质更高）
- C) 其他版本（3.0/3.1/4.1/4.5/4.6）

**即梦 — 图片比例：**
- A) 1:1（推荐）
- B) 3:4
- C) 16:9
- D) 其他

**即梦 — 图片分辨率：**
- A) 2k（推荐）
- B) 4k（仅 4.0+ 支持）

**config.md 模板示例（选择 dreamina 时）：**
```markdown
## 模型配置
# - 视频模型: generic        # 暂不可选，待接入视频生成后启用
- 图像模型: dreamina         # none / dreamina
- 视频风格: 3D写实

## 图像生成配置（仅图像模型非 none 时生效）
- 即梦模型版本: 4.0           # 3.0 / 3.1 / 4.0 / 4.1 / 4.5 / 4.6 / 5.0
- 图片比例: 1:1               # 1:1 / 3:4 / 16:9 / 等
- 图片分辨率: 2k              # 1k(仅3.x) / 2k / 4k(仅4.0+)
```

**config.md 模板示例（选择 none 时）：**
```markdown
## 模型配置
# - 视频模型: generic        # 暂不可选，待接入视频生成后启用
- 图像模型: none              # none / dreamina
- 视频风格: 3D写实
```

交互式配置引导中跳过视频模型选择。

选择 `none` 时不写 `## 图像生成配置` 区域。

脚本和模型 skill 从 config 读取这些参数并传递给 `image-gen-dreamina.sh`。待未来接入新模型时，新增模型 skill + 脚本 + 对应的配置项即可。

## 2. 图片存储

**路径规则：** `assets/images/{category}/{asset_name}.png`

目录结构镜像 `assets/` 的分类：
```
assets/images/
├── characters/
├── items/
├── locations/
└── buildings/
```

目录由模型 skill 在生成前自动创建。

## 3. 新增技能

### 3.1 `creator-generate-images`（不可用户调用 — 路由层）

**职责：** 批量为指定集的资产生成参考图片。读取 config 后将工作委托给对应的模型 skill。

**frontmatter：**
- `name: creator-generate-images`
- `user-invocable: false`
- `context: fork`
- `agent: creator`
- `allowed-tools: Read, Glob, Skill`

**输入：**
- `$ARGUMENTS[0]` — 集数（如 `ep01`）

**流程：**
1. 读取 `config.md` 获取图像模型值，若为 `none` → 跳过，输出提示并结束
2. 读取 `story/episodes/{集数}/outline.md` 中的 `## 本集资产清单`，收集所有资产文件路径
3. 过滤掉 `assets/images/{category}/{name}.png` 已存在的资产（跳过已有图片）
4. 若无需生成 → 输出提示并结束
5. 使用 Skill tool 调用 `creator-image-{model}` skill，传递参数：`"{资产路径1}" "{资产路径2}" ...`（仅传入需要生成的资产）
6. 输出生成摘要：成功数、跳过数、失败数

### 3.2 `creator-image-dreamina`（不可用户调用 — 即梦模型编排）

**职责：** 使用即梦CLI为指定的资产列表生成参考图片。

**frontmatter：**
- `name: creator-image-dreamina`
- `user-invocable: false`
- `context: fork`
- `agent: creator`
- `allowed-tools: Read, Glob, Bash`

**输入：**
- `$ARGUMENTS` — 资产文件路径列表（如 `"assets/characters/张三.md" "assets/locations/小巷.md"`）

**流程：**
1. 读取 `config.md` 中 `## 图像生成配置` 获取即梦模型版本、图片比例、图片分辨率
2. 使用 Bash 执行 `dreamina user_credit` 检查登录状态，失败 → 输出错误提示并结束
3. 对每个资产路径：
   a. 读取资产文件中的 `## 图像生成提示词` 内容
   b. 根据资产路径推导输出图片路径（`assets/characters/张三.md` → `assets/images/characters/张三.png`）
   c. 确保输出目录存在
   d. 使用 Bash 调用 `bash scripts/image-gen-dreamina.sh "{提示词}" "{输出路径}" "{比例}" "{分辨率}" "{模型版本}"`
   e. 根据退出码处理：
      - exit 0（OK）→ 记录成功
      - exit 1（FAIL）→ 记录失败
      - exit 2（PENDING）→ 从 stdout 提取 `submit_id`，加入待查列表
4. 所有资产处理完毕后，若待查列表非空 → 进入轮询阶段：
   a. 等待 30 秒
   b. 对每个 pending 的 `submit_id`，使用 Bash 调用 `dreamina query_result --submit_id={id} --download_dir={临时目录}`
   c. 检查返回 JSON 中 `gen_status`：
      - `success` → 将下载的图片 `mv` 到目标路径，记录成功
      - `fail` → 记录失败
      - `querying` → 保留在待查列表
   d. 若待查列表仍非空，重复步骤 a-c（最多重复 5 轮，共约 3 分钟）
   e. 5 轮后仍有 pending → 将超时任务写入 `assets/images/pending.json`，格式：
      ```json
      [
        {"submit_id": "xxx", "asset_path": "assets/characters/张三.md", "output_path": "assets/images/characters/张三.png"},
        ...
      ]
      ```
      若文件已存在则追加（合并去重）。
5. 输出结果摘要：成功数、失败数、超时待查数（提示用户可稍后用 repair skill 恢复）

### 3.3 edit skill 集成图片重新生成

不新增独立的用户可调用 skill，而是在现有 `short-edit-story` 和 `series-edit-story` 中集成图片重新生成。

**新增目标类型 `asset-image`：** 在阶段 1 解析用户意图时，识别"图片/参考图/重新生成图片"等关键词。

**用法示例：**
```
/short-edit-story 张三的头发改成红色，重新生成图片
/short-edit-story 重新生成张三和李四的参考图片
/series-edit-story 重新生成张三的参考图片
```

**`asset-image` 类型的执行流程：**
1. 读取 `config.md` 获取图像模型值，若为 `none` → 提示用户需要先配置图像模型，结束
2. 使用 Glob 在 `assets/**/*.md` 中查找匹配的资产文件
3. 若用户附带了修改建议（如"头发改成红色"）→ 使用 Skill tool 调用 `creator-fix-asset` skill 更新提示词
4. 使用 Skill tool 调用 `creator-image-{model}` skill，传递资产路径列表（覆盖已有图片）
5. 输出结果摘要

**现有 `asset` 类型的级联增强：** 当修改资产文件后（`creator-fix-asset`），若 config 图像模型非 `none`，自动为被修改的资产重新生成图片（调用 `creator-image-{model}` skill）。

## 4. 工作流集成

### 4.1 主流水线

在以下三个工作流的「创建资产」步骤之后、「生成分镜」步骤之前，插入图片生成步骤。**流水线在阶段 1 读取 config 时已获取图像模型值，若为 `none` 则跳过此步骤，不调用 skill。**

图片生成与分镜流程完全独立，采用"并行不等待"模式：在资产创建完成后，图片生成与分镜生成/审核/修复并行执行，分镜流程不等待图片完成。

**`skills/short-video/SKILL.md`（阶段 4.5 之后）：**
```
并行执行（分镜流程不等待图片完成）：
- creator-generate-images ep01（仅图像模型非 none 时）
- short-storyboard → short-review-storyboard → short-fix-storyboard（正常推进）
```

**`skills/new-story/SKILL.md`（步骤 5b 之后）：**
```
并行执行（分镜流程不等待图片完成）：
- creator-generate-images ep01（仅图像模型非 none 时）
- storyboarder-storyboard → director-review-storyboard → storyboarder-fix-storyboard（正常推进）
```

**`skills/continue-story/SKILL.md`（资产创建并行步骤完成后）：**
```
并行执行（分镜流程不等待图片完成）：
- creator-generate-images ep{N+1}（仅图像模型非 none 时）
- storyboarder-storyboard → director-review-storyboard → storyboarder-fix-storyboard（正常推进）
```

图片生成若超时，pending.json 会记录，后续 repair skill 可恢复。

### 4.2 修复流水线

在以下两个修复工作流中增加资产图片检查和补生成。**仅当 config 图像模型非 `none` 时执行。**

**`skills/series-repair-story/SKILL.md`：**

阶段 3 新增检查项（在检查 4「资产文件」和检查 5「分镜」之间，仅图像模型非 none 时检查）：

```
检查 4b — 资产图片待查任务（仅图像模型非 none 时）：
- 检查 assets/images/pending.json 是否存在且非空
- 若存在 → 逐个用 dreamina query_result --submit_id={id} --download_dir={临时目录} 查询
  - success → mv 到 output_path，从 pending.json 移除该条目
  - fail → 从 pending.json 移除，记入缺失列表
  - querying → 保留在 pending.json（仍在排队）
- pending.json 为空时删除该文件

检查 4c — 资产图片完整性（仅图像模型非 none 时）：
- 对照已有资产文件，检查 assets/images/{category}/{name}.png 是否存在
- 有缺失的图片 → 状态：资产图片缺失
- 通过 → 继续检查
```

阶段 5「从资产文件开始恢复」末尾追加（仅图像模型非 none 时）：
```
使用 Skill tool 调用 `creator-generate-images` skill，传递参数：`{集数}`
```

**`skills/short-repair-story/SKILL.md`：** 同上逻辑，固定为 `ep01`。

### 4.3 编辑流水线

在 `short-edit-story` 和 `series-edit-story` 中：

- 新增 `asset-image` 目标类型（见 3.3）
- 现有 `asset` 类型级联增强：修改资产文件后，若图像模型非 `none`，自动重新生成该资产图片
- 现有 `asset-list`、`outline`、`script`/`novel` 类型的级联中，`creator-create-assets` 后若图像模型非 `none`，追加调用 `creator-generate-images`

## 5. 积分与模型版本

脚本默认使用 `model_version=4.0`（免费）。若用户在 config 中或命令参数中指定更高版本模型，模型 skill 在执行前必须提醒用户积分消耗（5.0 约 3 积分/张），用户确认后才开始生成。使用 4.0 时无需确认。

## 6. 不在本次范围内

- 资产 `.md` 文件中不新增图片路径字段（留待视频生成工作流引入时添加）
- 不实现视频生成功能
- 不修改分镜引用方式
