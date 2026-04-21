# short-video-director

`short-video-director` 是一个面向 AI 视频创作的 plugin，将故事创意（点子、原文、概述）转化为分镜提示词、资产图像提示词，并可选地驱动即梦 CLI 完成图像与视频的批量生成。它围绕「故事 → 大纲 → 小说/剧本 → 资产 → 分镜 → 视频」的流水线组织 5 个角色 agent、28 个业务 skill 与 11 个 workflow。

本仓库采用**单仓双 runtime**设计：以 [Claude Code](https://docs.claude.com/en/docs/claude-code/overview) 为首发平台，并兼容 [opencode](https://opencode.ai/)。源代码统一存放在 `src/`，由 `tools/build.py` 编译生成 `.claude/`（Claude Code 产物）与 `.opencode/`（opencode 产物）两份等价产物。两端用户入口、调用契约一致，只在底层加载机制上有差异。

## 双 runtime 架构（Claude Code + opencode）

| 维度 | Claude Code | opencode |
| --- | --- | --- |
| 产物路径 | `.claude/skills/`、`.claude/agents/` | `.opencode/skills/`、`.opencode/agent/`、`.opencode/commands/`、`.opencode/opencode.json` |
| 自动加载入口文档 | `CLAUDE.md` | 无（用户可手动 `cat CLAUDE.md` 注入首轮 prompt） |
| 用户入口 workflow 形态 | `user-invocable: true` 的 skill，在斜杠菜单中显示 `/<workflow-name>` | `commands/<workflow-name>.md`，通过 `/<workflow-name>` 触发 |
| 业务 skill 加载形态 | Skill tool 加载 | task 工具的子会话内通过 skill 工具加载 |
| 角色 agent 形态 | plugin 注入的 subagent | `mode: subagent` 的 agent |
| `/auto-video` 轮询机制 | in-session sleep-loop（关闭会话即终止） | in-session sleep-loop（关闭会话即终止） |

> **重要：** 不要直接编辑 `.claude/` 或 `.opencode/`，所有改动都从 `src/` 出发，跑 `uv run tools/build.py` 重新生成产物。详见 [如何贡献](#如何贡献)。

## 用户入口（user-invocable workflow）

下列 8 个核心入口在 Claude Code 与 opencode 上行为一致；调用方式都是 `/<workflow-name> [参数]`。

### `/series-video`

- **用途**：将故事创意转化为 AI 视频分镜提示词和资产图像提示词。支持持续创作，自动检测新故事/续写模式。输入故事点子、原文或概述，输出完整的分镜和资产提示词。
- **参数**：`[总集数] [故事材料|文件路径]`
- **调用样例**：
  - `/series-video` — 进入交互式引导
  - `/series-video config` — 编辑配置
  - `/series-video 12 ./idea.md` — 12 集系列、从文件读取故事材料
- **背后委派**：根据是否存在 `story/` 目录，分别调用内部 workflow `new-story` 或 `continue-story`。

### `/short-video`

- **用途**：将故事创意转化为单集短视频的分镜提示词和资产图像提示词。输入故事点子或概述，输出完整的剧本、分镜和资产提示词。
- **参数**：`[故事材料|文件路径]`
- **调用样例**：
  - `/short-video` — 进入交互式引导
  - `/short-video config` — 编辑配置
  - `/short-video "电梯故障的反转故事"` — 内联故事材料

### `/series-edit-story`

- **用途**：对多集系列的任意内容（资产、大纲、小说、分镜）提出修改意见。通过对话协商确定方案后，按级联 DAG 按需执行修正。
- **参数**：`[自然语言修改意见]`
- **调用样例**：
  - `/series-edit-story 把 ep03 的反派改成女性`
  - `/series-edit-story` — 不带参数进入对话模式

### `/short-edit-story`

- **用途**：对单集短视频的任意内容（资产、大纲、剧本、分镜）提出修改意见。通过对话协商确定方案后，按级联 DAG 按需执行修正。
- **参数**：`[自然语言修改意见]`
- **调用样例**：`/short-edit-story 第二个镜头节奏太慢`

### `/series-repair-story`

- **用途**：检测指定集的文件完整性，从断点处恢复生成。自动识别缺失或不完整的文件，重新执行后续步骤。
- **参数**：`[集数，如 ep03，不填则自动检测最新一集]`
- **调用样例**：
  - `/series-repair-story` — 自动检测最新一集
  - `/series-repair-story ep03`

### `/short-repair-story`

- **用途**：检测单集短视频的文件完整性，从断点处恢复生成。自动识别缺失或不完整的文件，重新执行后续步骤。
- **参数**：无
- **调用样例**：`/short-repair-story`

### `/generate-video`

- **用途**：将分镜提示词提交为视频生成任务。读取分镜和资产图片，提交到即梦 CLI，异步跟踪任务状态。
- **参数**：`集数 [镜头N ...]`
- **调用样例**：
  - `/generate-video ep01` — 提交整集所有镜头
  - `/generate-video ep01 镜头3 镜头5` — 仅提交指定镜头

### `/check-video`

- **用途**：查询视频生成任务的状态，下载已完成的视频，处理失败的任务。
- **参数**：`集数 [--auto]`
- **调用样例**：
  - `/check-video ep01`
  - `/check-video ep01 --auto` — 自动下载、自动重试

#### `/auto-video`

- **用途**：在当前会话内循环监控视频生成状态：每隔指定间隔起一个 sub-agent 调 `/check-video {目标} --auto`，根据 JSON 摘要判断是否继续；全部完成或遇到不可恢复错误时自动停止；同时内置安全上限（最多 24 轮 / 8 小时），命中即退出。
- **参数**：`[集数|all] [检查间隔秒数]`
- **调用样例**：`/auto-video ep01 300`
- **跨端行为**：Claude Code 与 opencode 完全等价，均通过 in-session sleep-loop 实现，不依赖任何宿主级调度（Cron / launchd / Task Scheduler）。
- **会话生命周期**：循环在当前 LLM 会话内运行，关闭会话即终止。如需脱离会话调度，可改用 OS 级 cron 周期性触发 `/check-video`，参见 [可选：OS 级周期触发](#可选os-级周期触发)。

## Internal workflow

下列 2 个 workflow **不会**出现在用户的斜杠菜单中，仅由 user-invocable workflow 在内部委派调用，用户不直接触发：

- `new-story` — 新故事工作流。从零开始创建第一集：剧情选项 → 大纲 → 小说 → 资产 → 分镜，完整的单集生成流程。被 `/series-video` 在新故事模式下委派。
- `continue-story` — 续写工作流。基于已有故事继续创作下一集：上下文收集 → 剧情选项 → 大纲 → 小说 → 资产 → 分镜。被 `/series-video` 在续写模式下委派。

## 角色 agent

5 个角色 agent 各承担流水线中的一段职责，业务 skill 按 owner 归属到对应 agent；workflow 通过 task subagent 委派业务 skill 时，会路由到该 skill 的 owner agent 上执行。

| agent | 职责 |
| --- | --- |
| `director` | 资深短视频导演，负责叙事规划和质量把控。规划剧集结构、生成剧情选项、创建大纲、审核小说和分镜。 |
| `writer` | 当红网文作家，擅长悬念设置和人物刻画。根据大纲生成小说原文。 |
| `scriptwriter` | 短视频编剧，擅长在极短篇幅内构建完整故事。将 Director 大纲转化为剧本，包含场景描述、角色动作、台词和情绪节奏提示。 |
| `storyboarder` | 资深摄影指导，精通镜头语言和 AI 视频模型提示词。将小说转化为精确的分镜提示词。 |
| `creator` | 资深创意总监，将文字描述转化为精确的图像生成提示词。创建和维护角色、物品、场景资产。 |

## 业务 skill（按 owner 分组）

业务 skill 是流水线中可复用的最小执行单元；用户**不直接调用**，只由 workflow 通过 task subagent / Skill tool 委派。28 个业务 skill 的 owner 归属在 `tools/runtime-config.yml` 中维护。

### director (13)

- `director-arc` — Director 生成阶段级剧情弧线规划。自动读取 config.md、outline.md、最近 M 集 novel，并写入 arc.md。
- `director-fix-outline` — Director 根据修改意见定向修正本集大纲。同步更新 story/outline.md 中对应内容。
- `director-input-confirm` — Director 根据用户故事材料生成结构化确认说明。自动读取 config.md、arc.md、outline.md、最近 M 集 novel。
- `director-outline` — Director 生成本集详细大纲和 outline.md 内容。自动读取 config.md、arc.md，并写入 ep outline 和 story outline。
- `director-plot-options` — Director 生成 3 个差异化剧情走向选项。自动读取 config.md、arc.md、outline.md、最近 M 集 novel。
- `director-review-novel` — Director 审核 Writer 小说原文，检查与大纲一致性、角色塑造和叙事质量。
- `director-review-script` — Director 审核 Scriptwriter 剧本，检查故事完整性、节奏、人物一致性和结局执行。
- `director-review-storyboard` — Director 审核 Storyboarder 分镜，检查叙事完整性、节奏、台词密度和技术合规性。
- `short-fix-outline` — Director 根据修改意见定向修正单集短视频大纲。不同步 story/outline.md。
- `short-input-confirm` — Director 根据用户故事材料生成单集短视频的结构化确认说明。自动读取 config.md。
- `short-outline` — Director 为单集短视频生成详细大纲。自动读取 config.md，写入 ep01 outline。
- `short-plot-options` — Director 为单集短视频生成 3 个差异化剧情选项。自动读取 config.md。
- `short-review-storyboard` — Director 审核单集短视频分镜，检查叙事完整性、节奏、人物一致性和剧情铺垫。

### writer (2)

- `writer-novel` — Writer 根据大纲生成具有画面感和紧凑叙事节奏的小说原文。自动读取大纲、config 和角色资产。
- `writer-fix-novel` — Writer 根据 Director 修改意见定向修正小说原文。读取现有小说，只修改指出的问题。

### scriptwriter (2)

- `scriptwriter-script` — Scriptwriter 根据大纲生成具有画面感和紧凑叙事节奏的剧本。自动读取大纲、config 和角色资产。
- `scriptwriter-fix-script` — Scriptwriter 根据 Director 修改意见定向修正剧本。读取现有剧本，只修改指出的问题。

### storyboarder (5)

- `storyboarder-asset-list` — Storyboarder 提取本集使用的所有资产（标注新增/已有），写入 ep outline.md。
- `storyboarder-storyboard` — Storyboarder 将小说原文转化为完整分镜提示词。包含内部台词密度自检循环（最多 3 轮）。
- `storyboarder-fix-storyboard` — Storyboarder 根据 Director 修改意见定向修正分镜。读取现有分镜，只修改指出的问题。
- `short-storyboard` — Storyboarder 将剧本转化为完整分镜提示词。包含内部自检循环（最多 3 轮）。
- `short-fix-storyboard` — Storyboarder 根据 Director 修改意见定向修正单集短视频分镜。读取现有分镜，只修改指出的问题。

### creator (6)

- `creator-create-assets` — Creator 为新资产创建完整 Markdown 文件，包含视觉描述和图像生成提示词。
- `creator-fix-asset` — Creator 根据修改意见定向修正指定资产文件。修改视觉描述时同步更新图像提示词。
- `creator-generate-images` — 批量为指定集的资产生成参考图片。读取 config 后将工作委托给对应的模型 skill。
- `creator-image-dreamina` — 使用即梦 CLI 为指定的资产列表生成参考图片，包含登录检查、生成、轮询和超时处理。
- `creator-update-records` — Creator 为本集出场的已有资产追加出场记录条目。
- `creator-video-dreamina` — 使用即梦 CLI multimodal2video 执行已登记 pending 镜头的状态转移（pending → submitted/failed），更新 tasks.json。

## 跨 runtime 调用约定

### Claude Code

- workflow 是带 `user-invocable: true` 的 skill，在斜杠菜单中显示为 `/<workflow-name>`。
- workflow 内部通过 **Skill tool** 调用业务 skill；业务 skill 自身带 `user-invocable: false`，不出现在用户菜单。
- 角色 agent 由 plugin 注入为 subagent，`tools` 默认为 `Read, Write, Edit, Glob, Grep, Bash, Skill`，模型继承父会话。
- `CLAUDE.md` 在会话启动时自动加载，提供项目上下文。

### opencode

- workflow user-invocable 形态是 `commands/<workflow-name>.md`，通过 `/<workflow-name>` 触发。
- workflow internal 与业务 skill 都是 subagent 子会话内通过 task 工具加载（`agent: build`, `subtask: true`）。
- 角色 agent 是 `.opencode/agent/<name>.md`，`mode: subagent`。
- opencode 没有自动加载根目录 `CLAUDE.md` 的机制，但用户可以在首轮 prompt 里手动注入：`cat CLAUDE.md`、`read CLAUDE.md` 或在 system prompt 中粘贴关键章节。
- `$ARGUMENTS[N]` 在 opencode 端会被偏移 +1 转为 `$<N+1>`（位置参数 1-based）。

### invoke 协议（源代码格式）

源代码中跨 skill 调用统一用 \`\`\`invoke 块声明，由 `tools/build.py` 在双端展开成各自平台的自然语言指令，避免在源里写死任一平台的细节。

**源代码（src/workflows/new-story.md 节选）：**

```markdown
1. 调用 `director-plot-options`：

` ` `invoke
skill: director-plot-options
args: ""
` ` `
```

**Claude Code 产物（.claude/skills/new-story/SKILL.md）：**

```markdown
1. 调用 `director-plot-options`：

使用 Skill tool 调用 `director-plot-options` skill（无参数）
```

**opencode 产物（.opencode/skills/new-story/SKILL.md）：**

```markdown
1. 调用 `director-plot-options`：

调用 task 工具，传入 agent: `director`，prompt: "执行 director-plot-options skill 描述的任务，无额外参数"
```

带参数时同理：源里 `args: "{用户偏好描述}"` 在 Claude 端展开为「，传递参数：`{用户偏好描述}`」，在 opencode 端展开为「，参数：{用户偏好描述}」。invoke 模板与短语全部集中在 `tools/runtime-config.yml.runtimes.<runtime>.invoke_template` 中维护。

## 可选：OS 级周期触发

`/auto-video` 已通过 in-session sleep-loop 在两端原生可用，**绝大多数场景下不需要 OS 级调度**。仅在以下情形可考虑改用 OS 调度：

- 需要长时间（>8 小时）后台轮询，且不希望保持 LLM 会话窗口开启
- 需要无人值守批量处理多个项目目录
- CI / 服务器环境，无法保留 interactive 会话

在这些场景下，可让操作系统周期性触发 `/check-video <ep> --auto`，等价于一个外部驱动的 sleep-loop（缺少安全上限，需要自己监控停止条件）。

### macOS / Linux (cron)

编辑 crontab：

```bash
crontab -e
```

添加一行（每 5 分钟检查一次 ep01；Claude Code 端把 `opencode run` 换成 `claude --print`）：

```
*/5 * * * * cd /path/to/project && opencode run "/check-video ep01 --auto"
```

### macOS (launchd)

新建 `~/Library/LaunchAgents/com.user.shortvideo.checkvideo.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.user.shortvideo.checkvideo</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>-c</string>
    <string>cd /path/to/project &amp;&amp; opencode run "/check-video ep01 --auto"</string>
  </array>
  <key>StartInterval</key>
  <integer>300</integer>
</dict>
</plist>
```

加载并启动：

```bash
launchctl load ~/Library/LaunchAgents/com.user.shortvideo.checkvideo.plist
```

### Windows (Task Scheduler)

打开「任务计划程序」→「创建基本任务」：

- **触发器**：每 5 分钟
- **操作**：启动程序 `cmd.exe`，参数 `/c cd /d C:\path\to\project && opencode run "/check-video ep01 --auto"`

OS 调度只能驱动 `/check-video --auto`，无法替代 `/auto-video` 的"全部完成自动停止"语义；停止条件需自己根据 `/check-video --auto` 输出的 JSON 摘要（`all_complete=true`）判断并手动 disable cron 项。

## 如何贡献

仓库源代码与产物分离：

| 目录 | 作用 | 是否手工编辑 |
| --- | --- | --- |
| `src/skills/` | 28 个业务 skill 源 | **是** |
| `src/agents/` | 5 个角色 agent 源 | **是** |
| `src/workflows/` | 11 个 workflow 源 | **是** |
| `tools/runtime-config.yml` | owner 映射、双端变换规则、invoke 模板 | **是** |
| `.claude/` | Claude Code 编译产物 | 否 |
| `.opencode/` | opencode 编译产物 | 否 |

工作流：

1. 在 `src/` 下编辑源文件。
2. 跑构建：

   ```bash
   uv run tools/build.py
   ```

3. 跑结构与一致性校验：

   ```bash
   uv run tools/check-structure.py
   ```

4. PR 必须包含**源 + 产物**双端变更（参见 `.gitattributes` 与 PR template）。CI 会重新跑 `build.py` 并对比 `.claude/`、`.opencode/` 的 git diff，不一致直接拒绝。

## 常见问题排查

- **「我编辑了 `src/skills/X` 但没看到效果」** — 产物没重新生成。跑 `uv run tools/build.py`，确认 `.claude/skills/X/`、`.opencode/skills/X/` 已更新，再重新触发。
- **「PR CI 报 git diff 不一致」** — 你只 commit 了 `src/`，没 commit 编译产物。本地跑 `uv run tools/build.py`，`git add .claude .opencode`，再 push。
- **「`/auto-video` 关掉会话后停止了」** — 这是设计行为：循环在当前 LLM 会话内运行，关闭即终止。需要无人值守长时间运行时改用 OS 级调度，参见 [可选：OS 级周期触发](#可选os-级周期触发)。
- **「如何添加新业务 skill」** — 在 `src/skills/<name>/SKILL.md` 创建源文件（带 `name` 与 `description` 前置元数据），并在 `tools/runtime-config.yml` 的 `agents.<owner>` 下注册到对应角色，最后跑 `build.py` 与 `check-structure.py`。
- **「workflow 里如何调其他 skill」** — 用 \`\`\`invoke 块（`skill: <name>`、`args: "..."`），不要写死任一平台的具体调用句式，build.py 会按 [invoke 协议](#invoke-协议源代码格式) 在双端展开。
- **「为什么 opencode 端首轮没有项目上下文？」** — opencode 不自动加载 `CLAUDE.md`。手动执行 `cat CLAUDE.md` 或在 system prompt 中粘贴关键章节即可。

## 进一步阅读

- [README.md](README.md) — 用户安装、详细使用说明、示例工作流。
- [docs/plans/2026-04-20-16-32/opencode-compat-technical-design.md](docs/plans/2026-04-20-16-32/opencode-compat-technical-design.md) — 双 runtime 改造的完整技术设计与 ADR 列表。
- [docs/plans/2026-04-20-16-32/opencode-compat-implementation-plan.md](docs/plans/2026-04-20-16-32/opencode-compat-implementation-plan.md) — 实现计划与 task 拆分。
- [tools/runtime-config.yml](tools/runtime-config.yml) — owner 映射、双端变换规则、invoke 模板的权威配置。
