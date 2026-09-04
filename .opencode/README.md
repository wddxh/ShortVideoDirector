# ShortVideoDirector — OpenCode 插件

短视频创作工作流插件。子代理来自 `agents/*.md`，skills 来自 `skills/*/SKILL.md`，均按当前源码动态加载。

源代码是 Claude Code 插件，OC 兼容层在 `.opencode/` 下，运行时把源 skills 转换到 `~/.cache/short-video-director/<hash>/` 供 OC 加载，不污染源仓库。

## 依赖

需要在系统上预先安装：

- `dreamina` CLI（即梦视频生成）
- `python3`（部分脚本依赖）

## 安装

### 方式 A：从 GitHub 安装（推荐给终端用户）

编辑 `~/.config/opencode/opencode.json`：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"
  ]
}
```

启动 OC 即生效。首次启动会编译 cache（1-3 秒），后续启动复用 cache。

### 方式 B：本地路径安装（推荐给开发/魔改场景）

如果你已经 clone 了仓库到本地（例如 `~/repos/ShortVideoDirector`），用 `file://` 协议指向本地路径：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "file:///home/huangz/repos/ShortVideoDirector"
  ]
}
```

> 路径必须是**绝对路径**且带 `file://` 前缀（三个斜杠）。Windows 用 `file:///C:/path/to/ShortVideoDirector`。

OC 会直接读取该路径下的 `package.json` 与 `.opencode/plugin/index.js`，**不复制不缓存**——改源码立刻生效（OC 重启即可）。

### 方式 C：仅在项目目录内使用

如果你只在仓库目录里跑 OC：

```bash
cd /path/to/ShortVideoDirector
opencode
```

OC 会自动扫描当前目录的 `.opencode/plugin/*.js` 加载插件，**不用动 `opencode.json`**。
缺点：在其他目录（如 `/tmp/test-project/`）跑 `opencode` 看不到 SVD plugin。

### 三种方式对比

| 方式 | 全局可见 | 改源码立即生效 | 需要联网 | 适合场景 |
|------|---------|--------------|---------|---------|
| A. git+https | ✓ | ✗（需 `--force` 重拉） | ✓ | 终端用户、CI |
| B. file:// | ✓ | ✓ | ✗ | 开发、调试、魔改 |
| C. 项目本地 | ✗（仅项目目录内） | ✓ | ✗ | 偶尔在仓库内开发 |

## 验证安装

启动 OC 后，在另一个终端运行：

```bash
opencode agent list
```

应该看到：

```
build (primary)
creator (subagent)
director (subagent)
scriptwriter (subagent)
storyboarder (subagent)
writer (subagent)
```

进一步验证 skills 是否从 `~/.cache/short-video-director/<hash>/skills/` 加载，并与当前源码集合一致：

```bash
opencode debug skill | head -30
```

## 升级

```bash
opencode plugin short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git --global --force
```

## 卸载

从 `opencode.json` 移除 plugin 条目，然后清 cache：

```bash
rm -rf ~/.cache/short-video-director/
rm -rf ~/.cache/opencode/node_modules/short-video-director/
```

## 可选：收紧 build agent 权限

默认 OC `build` agent 全 allow，开箱即用。安全洁癖用户可在 `~/.config/opencode/opencode.json` 加：

```json
{
  "agent": {
    "build": {
      "permission": {
        "bash": {
          "bash ${CLAUDE_PLUGIN_ROOT}/scripts/*": "allow",
          "mkdir -p story/episodes/*": "allow",
          "opencode run*": "allow",
          "*": "ask"
        },
        "task": {
          "director": "allow",
          "writer": "allow",
          "scriptwriter": "allow",
          "storyboarder": "allow",
          "creator": "allow",
          "*": "deny"
        }
      }
    }
  }
}
```

## 工作原理

插件做 3 件事：

1. **`config` hook**：把 cache 目录注册到 `config.skills.paths`，把 `agents/*.md` 动态注册到 `config.agent`
2. **`shell.env` hook**：注入 `CLAUDE_PLUGIN_ROOT=<插件根目录>` 环境变量给所有 bash 调用，作为 bash subprocess 的兜底（与 CC 原生 env var 同名同义），使源 skill 中 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/X.sh` 之类的调用在 OC 下也能定位脚本
3. **`experimental.chat.messages.transform` hook**：在首条 user message 前注入动态 workflow/agent bootstrap，用 `SVD_BOOTSTRAP_MARKER` 实现幂等

转换规则（源 CC skill → OC cache skill）：

- **frontmatter**：CC 字段（`context: fork`, `agent`, `user-invocable` 等）移到 `metadata.svd-*`，description 截断到 1024 字符
- **`使用 Skill tool 调用 X`**：若 X 有 `context: fork` → 重写为 `task({ subagent_type: ..., prompt: "..." })`；否则重写为 `调用 \`skill({ name: "X" })\``
- **`${CLAUDE_PLUGIN_ROOT}` inline 替换**：transform-time 把源 skill / agent 中的 `${CLAUDE_PLUGIN_ROOT}` 字面量替换为插件根目录绝对路径，与 CC 原生 inline 替换行为对齐（CC 在 prompt 注入时也是直接 substitute 这个 token）
- **user-invocable workflow 顶部**：按 `USER_INVOCABLE_ENTRY_WORKFLOWS` 当前集合注入派发约束，无独立计数常量
- **fork-context skill 顶部**：注入"执行上下文：本 skill 已在 X 子代理中"提示
- **auto-video skill**：CC 的 `CronCreate/List/Delete` 原语替换为基于 nohup loop + HTTP `/session/{SID}/prompt_async` 的调度（OC override 实现，见 `.opencode/skill-overrides/auto-video/`）

cache 失效逻辑：sha256(`skills/`、`agents/`、`scripts/`、`.opencode/skill-overrides/`、`.opencode/lib/` 的转换输入 path+mtime+size + plugin version) 的前 16 hex 字符；保留最新 3 个 cache。

Storyboard sheet 链由当前源码中的这些 skills 组成：

- `creator-storyboard-sheet-prompts`
- `director-review-storyboard-sheet-prompts`
- `creator-fix-storyboard-sheet-prompt`
- `director-review-storyboard-sheets-visual`
- `director-review-storyboard-sheet-visual-single`
- `creator-fix-storyboard-sheet-image`
- `director-review-storyboard-sheet-impact`

图片统一经过 `creator-generate-images` 的 `basic`、`storyboard-sheets` 或 `paths` scope 路由。

## Inline 替换 `${CLAUDE_PLUGIN_ROOT}`

源 skill / agent / aux 文件中**统一**用 `${CLAUDE_PLUGIN_ROOT}` 表达任何插件内绝对路径（bash 命令、文档引用、配置示例皆然）。跨 runtime 兼容靠两条机制：

1. **Transform-time inline 替换**：plugin 转换源文件到 cache 时，把字面量 `${CLAUDE_PLUGIN_ROOT}` 替换成插件根目录绝对路径（如 `/home/x/repos/ShortVideoDirector`）写进 cache 文件。LLM 看到的就是绝对路径，无需运行时 shell 展开——和 CC 原生 prompt 注入时的 inline substitute 行为完全对齐。
2. **`shell.env` 注入兜底**：plugin 同时在 `shell.env` hook 里给 bash subprocess 注入 `CLAUDE_PLUGIN_ROOT=<同一绝对路径>`。这条仅作为兜底（防 LLM 偶发直接 emit 未替换的 `${CLAUDE_PLUGIN_ROOT}` 字面量到 bash），正常路径已被 #1 覆盖。

→ 零 adapter、零自定义 env var（历史上的自定义 `SVD_*` env var 已废）；CC 原生支持、OC 模拟、Codex 用原生 env var（详见 `.codex/tool-mapping.md`）。

## Troubleshooting

**问题：启动后看不到源码中定义的子代理**

- `opencode agent list` 看输出，若没有 director/writer 等说明 plugin 未加载
- 检查 `opencode.json` 的 plugin 配置正确性
- 强制重新拉取插件：`opencode plugin short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git --global --force`
- 清 cache 后重启：`rm -rf ~/.cache/short-video-director/`

**问题：调用 skill 时报"unknown skill"**

- 可能 cache 不完整。手动清 cache：`rm -rf ~/.cache/short-video-director/`，重启 OC 触发重建
- 用 `opencode debug skill` 核对输出与当前 `skills/*/SKILL.md` 动态集合一致

**问题：bash 脚本调用失败说找不到文件**

- 检查 `$CLAUDE_PLUGIN_ROOT` 是否正确：在 OC 会话里跑 `bash -c 'echo $CLAUDE_PLUGIN_ROOT'`，应输出插件根目录绝对路径
- 如果输出为空，可能是 OC 版本不支持 `shell.env` hook，请升级 OC（≥ 1.15）

**问题：auto-video 的 nohup loop 没执行 / OC TUI 没收到自动 prompt**

排查步骤：
1. 确认启动 OC 时加了 `--port`：`pgrep -af opencode` 应看到 `--port NNNN`。
   没加 → loop curl 找不到 server → loop 几分钟内自杀。重启 OC 用 `opencode --port 4096 -s <SID>`。
2. 确认 loop 进程在跑：`ls /tmp/svd-auto-video-loop-*-*.pid` + `kill -0 $(cat /tmp/svd-auto-video-loop-*-*.pid)`。
3. 查 loop 日志：`tail -20 /tmp/svd-auto-video-loop-*-*.log` 看有无 curl 错误（connection refused = OC 已关或没起 server）。
4. 手动验证 server: `curl http://127.0.0.1:NNNN/global/health` 应返回 `{healthy:true}`。
5. 重装：删 PID/log/prompt 文件后重跑 `/auto-video ep01 1200`。

## 与 CC 版本的关系

- 源 `skills/`、`agents/`、`scripts/`、`.claude-plugin/` 完全不变，CC 用户继续按现有方式使用
- OC 兼容层（`.opencode/`、`package.json`）独立增量，不影响 CC
- 同一仓库同时支持 CC 与 OC，无需 fork

## 开发

测试零依赖 —— 用 Node 内置 `node --test` runner（Node 18+）：

```bash
# 跑完整单元测试
npm test
# 或直接：
node --test .opencode/tests/*.test.js

# Watch 模式
npm run test:watch

# 验证 plugin 加载（OC 已启动后另开终端跑）
opencode agent list
opencode debug skill | head -30
```

无 `node_modules`、无 `package-lock.json`、无外部依赖。`package.json` 仅保留 OC 加载需要的字段（`name` / `version` / `type` / `main` / `repository` / `license` / `scripts`）。

## 维护契约：改 CC 源后的 OC 同步 checklist

源（`skills/`、`agents/`、`scripts/`）是单一真相源。**改源后，OC 兼容层有几处硬编码/断言会随之失效**，须同步更新并跑 `npm test` 验证。

### Runtime Write Guard (tool.execute.before hook)

`.opencode/lib/write-guard.js` 在 plugin 启动时注册为 `tool.execute.before` hook，对**每次** tool 调用做参数大小检查：

| 行为 | 触发条件 |
|---|---|
| 通过（不干预）| 所有字符串参数 ≤2000 字符 |
| Throw Error | 任何字符串参数 >2000 字符（**无文件类型例外**）|

Error 信息含 tool-specific advice（write / edit / task / apply_patch / bash 各自的正确分段建议）。LLM 看到 error 自然 retry。

阈值固定 `MAX_STRING_ARG_LEN = 2000`（写死，与 AGENTS.md 全局约束一致）。

**为什么没有文件类型例外**：OC 卡死 root cause 是 LLM emit 长字符串参数时的 streaming 中断，跟文件内容类型无关。JSON / YAML 同样按增量模式分段（详见 `ENTRY_WORKFLOW_DISPATCH_DISCIPLINE`）。

### 管线与 Storyboard Sheets 变更记录

- `USER_INVOCABLE_ENTRY_WORKFLOWS` 从 9 → 7：合并 `series-edit-story` + `short-edit-story` → `edit-story`；`series-repair-story` + `short-repair-story` → `repair-story`。`tool-mapping.js` 中 Set 已更新，对应 OC commands 自动 derive。
- 删除 `new-story` / `continue-story` 等分流 skill，由 `generate-episode-pipeline` 统一承载；skill 集合由目录动态发现。
- Storyboard sheet 链包含 card 生成、prompt review/fix、串行生图、visual review/fix 和 direct-impact review。
- pipeline mode 文件加 `review 循环 (通用模式)`：每个 `review-*` 步骤遵循"≤2 轮修复 + 自动跳过"模式，2 轮仍 dirty 则 main session print 警告并继续，用户后续可用 `/edit-story` 手动修订。
- 子 skill 严格 stateless functional：`director-plot-options` 加 `action` 参数（generate/modify）+ `previous_options_path`；`director-input-confirm` 加 `selected_plot_option` 参数；两者均删除"等待用户回应/重新执行本 skill"等交互指令，由 main session 处理。
- `generate-episode-pipeline` 不再 fork（删 `context: fork` + `agent: director`），运行在调用方（`series-video` / `short-video`） session 中，使 review 失败时主 session 可直接 print 警告并自动跳过。
- `config.md` 新增 `总集数` 字段（默认 1）：`series-video` 入口 `new-series` 模式检测到默认值时问用户后写入；`director-arc` 从 config 读总集数（不再走 prompt 参数）。
- `director-fix-outline` / `scriptwriter-fix-script` 输入统一为 `$ARGUMENTS[0] = .review-*.md 路径` + 可选 `extra_instructions`（与 `storyboarder-fix-storyboard` / `writer-fix-novel` / `creator-fix-asset-image` / 新增 `director-fix-arc` 一致）。
- 旧 `episodes/` 目录用新 skill 触发会报错（Task 24 clean break），无向后兼容路径。

### 资产段名分工 + 新增资产规则（2026-05-22）

- **段名分工**: outline 阶段中间段 `## 本集新增资产`（director-outline 产物，characters/locations/items/buildings 全 4 类初稿）→ scriptwriter Phase 5 后切换为终态 `## 本集资产清单` superset（含 `### 新增资产` + `### 已有资产（本集出场）` 两子段）。Supersedes 2026-05-21-pipeline-refactor-design.md:191 段名 rename 决策（保留段名「本集资产清单」+ 显式列复用 asset）。
- **scriptwriter Phase 5 重写为 detect-then-write 3 态**: 状态 A（已有 `## 本集新增资产`）→ 删除 + Append；状态 B（已有 `## 本集资产清单`）→ in-place 重写；状态 C（两段都无）→ Append。按 `^## ` 严格分段定界，不破坏用户手工段。
- **asset id 规则文档闭合**: asset id = 资产名（与 `creator-create-assets/rules.md:76` 文件名一致）；语言遵循 `config.md` 「语言」设置（auto/zh/en/自定义），en 用下划线 `Shen_Zhao`；禁止 `char-`/`loc-`/`item-` 英文 prefix 与 kebab-case 转写；同一 outline 内 asset id 语言一致（R3）。
- **director-review-script 加 hard gate**: script.md 中任何 asset 引用必带 `(assets/<type>/<名称>.md)` 路径后缀（无路径 → review fail），与 scriptwriter Phase 5 grep 提取依赖配套。
- **下游资产消费者**: storyboarder、Creator 基础资产流程和 storyboard sheet 流程继续读取 `## 本集资产清单`；sheet 卡按 shot 单独维护。
- **director-review-outline 删 character ≥5 警告**（按剧情自由安排，不设硬阈值）。

### mode-specific 文件约定（series.md / short.md）

`series-video` / `short-video` / `generate-episode-pipeline` 等 mode-aware skill 把差异化指令拆到 sibling 文件：

- 目录结构示例：
  ```
  skills/series-video/
    ├── SKILL.md         # 通用主体
    ├── series.md        # series mode 专属步骤
    └── short.md         # short mode 专属步骤（若入口同时支持两种 mode）
  ```
- **SKILL.md Phase 1 强制 Read 当前 mode 文件**：避免 LLM 凭印象执行；mode 不匹配会立即 fail-fast
- **transform-skills 处理 sibling 文件**：`.md` aux 同样执行标准 skill-call rewrite 与 plugin-root 替换；其他 aux 原样复制
- 维护契约：改 mode-specific 文件不需要动 `.opencode/` 任何代码；只要文件落在 skill 目录下即自动生效



| 改动 | 同步位置 | 失败征兆 |
|------|----------|---------|
| **加/减 skill 目录** | 无手工计数；transform test 动态比较 source/output `*/SKILL.md` 集合 | source/output 集合不一致 |
| **新 skill 带 `user-invocable: true`** | `.opencode/lib/tool-mapping.js` 的 `USER_INVOCABLE_ENTRY_WORKFLOWS` Set（同时 `.opencode/tests/tool-mapping.test.js` 的硬编码列表） | `USER_INVOCABLE_ENTRY_WORKFLOWS contains exactly 7 entries` 失败 |
| **删除已有的 `user-invocable` skill** | 同上 | 同上 |
| **改 skill 间 `使用 Skill tool 调用 X` 引用** | SKILL.md 和 aux Markdown 都自动处理；X 必须存在 | transform integration 报 unknown skill |
| **新 fork skill（`context: fork`）被其他 skill 引用** | 引用位置**必须**用 `使用 Skill tool 调用 \`<name>\` skill[, 传递参数：\`<args>\`]` 标准模板。`transform-skills.js` 只识别此模板，会改写为 `task` 派发；自然语言"调用 X"会让 OC LLM 选 `skill()` 同上下文加载，破坏 fork 隔离语义（fork→fork 嵌套场景会导致下游 subagent 全部图片/数据塞进单一上下文，附件压缩中断） | 无测试失败（沉默 bug）；只在实际跑 OC 工作流时表现为"该 fork 的下游没被 fork 出去"。verify: wipe cache + `grep "task(" ~/.cache/.../skills/<caller>/SKILL.md` 应有 task 代码块 |
| **新 review→fix 链路** | review skill append `.review-{type}.md` 并返回稳定状态；fix 读取最后一轮；entry 仅传短参数。同步 reviewer/fixer/caller 三层 | fix 拿不到意见或派发 prompt 过长 |
| **改 skill `description` 字段超 1024 字符** | 自动 clip 到 1024（无错，但用户可能看到截断的描述） | 无测试失败，但 `opencode debug skill` 看到的 description 被截断 |
| **删除 `writer-novel/rules.md`** 或类似 aux 文件 | `.opencode/tests/transform-skills.test.js:272` 的 `aux files (rules.md) are copied` test 用了它 | aux test 失败；改用另一个 skill 的 aux 文件即可 |

### 改 `agents/` 时

| 改动 | 同步位置 | 失败征兆 |
|------|----------|---------|
| **加/减 agent** | `.opencode/lib/load-agents.js` 的 `AGENT_BASH_CONFIG`（5-agent permission 矩阵，硬编码 director/writer/scriptwriter/storyboarder/creator）+ `.opencode/tests/load-agents.test.js:148` 的硬编码列表 | `loads all 5 agents from real project` 失败 |
| **改 agent frontmatter 的 `model:` 字段** | 自动处理（`model: inherit` 被丢，其他保留） | 无 |
| **改 agent body（system prompt）** | 自动处理；prompt 末尾会被注入 OC 执行契约 | `agent prompt includes OC execution contract` 检查 `OC 执行契约` 字串存在，不检查内容 |

### 改 `scripts/` 时

| 改动 | 同步位置 | 失败征兆 |
|------|----------|---------|
| **加新 script `scripts/X.sh`** | 如果某 agent 需要调用，添加到 `.opencode/lib/load-agents.js` 的 `AGENT_BASH_CONFIG[agent].allowScripts` 数组（director/writer/scriptwriter/storyboarder；creator 设为 `'ALL'` 自动放行） | OC 运行时该 agent 调用 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/X.sh` 被 `bash: deny` 拦 |
| **重命名/删除 script** | 同上：从 `AGENT_BASH_CONFIG` 中移除 | 无测试失败，但 skill 调用旧名会运行时 fail |
| **源里 bash 调用路径** | 一律写 `bash ${CLAUDE_PLUGIN_ROOT}/scripts/X.sh`；transform-time inline 替换为绝对路径，`shell.env` 注入同名 env 兜底（详见上文「工作原理」） | 写成相对 `bash scripts/X.sh` → CC 走 cwd 解析可能失败；OC 在 plugin-dir 之外 cwd 也找不到脚本 |
| **scripts/ 文件改动触发 cache 重建** | 自动处理；`computeSourceHash` 包含 scripts/ 全部文件 `path:mtime:size`，改动 → 新 hash → cache miss → 重建 → 实复制 scripts/ 到 `cacheDir/scripts/`（保留源文件 mode 位） | 无；若 cache 中 scripts 缺失，强制 `rm -rf ~/.cache/short-video-director/` 重建 |

### 加 / 改 OC skill override

某些 skill 需要 OC 专属实现（如 `auto-video` 因 OC 没有 `CronCreate` 工具）。

| 改动 | 同步位置 | 失败征兆 |
|------|----------|---------|
| **加新 OC override `<name>`** | 建目录 `.opencode/skill-overrides/<name>/` 含 `SKILL.md` + 可选 aux 文件（`.sh` `.txt` 等）；`transformAllSkills` 自动检测优先使用 | 无（自动生效）；可用 `rm -rf ~/.cache/short-video-director/ && opencode debug agent director` 验证 cache 内容 |
| **改 OC override SKILL.md** | 直接编辑 `.opencode/skill-overrides/<name>/SKILL.md` | 同上；cache hash 自动跟随源文件 mtime 变化 |
| **CC 源改了共享段（如 `## 失败处理`）** | 必须同步到 OC override SKILL.md 同 heading 下；测试 `OC auto-video override shares core sections with CC source` 会 detect 脱钩 | npm test 失败提示不一致段名 + diff |
| **加 aux 文件** | 放进 OC override 目录；`transformAllSkills` 自动 copy 到 cache | LLM 通过 `${CLAUDE_PLUGIN_ROOT}/.opencode/skill-overrides/<name>/<aux>` 引用 |

### OC commands 自动 derive

plugin config hook 自动为 `USER_INVOCABLE_ENTRY_WORKFLOWS` 集合中每个 skill 注册同名 OC command（如 `/auto-video`），template 含 `$ARGUMENTS` + `$1~$4` 占位符，OC 会在 user 输入 `/skill-name args...` 时替换并发给 LLM。

维护契约：
- 新增 user-invocable entry workflow 时，加到 `.opencode/lib/tool-mapping.js` 的 `USER_INVOCABLE_ENTRY_WORKFLOWS` 集合即可，plugin 自动 derive command
- 用户在 `~/.config/opencode/opencode.json` 自定义同名 command 会被保留（skip-if-exists）
- 如需修改 template 措辞，改 `.opencode/lib/commands-derive.js` 的 `buildCommandTemplate` 函数（一处生效全部）

### 添 / 改 `agents/` permission 配置（5-agent 矩阵）

如果想把 5 agents 的脚本访问范围调整（例如允许 director 调用 image-gen-dreamina.sh）：

- 改 `.opencode/lib/load-agents.js` 的 `AGENT_BASH_CONFIG[agent].allowScripts`
- 看 `.opencode/tests/load-agents.test.js` 的 `buildPermissionForAgent` describe 块对应测试，可能需要更新断言

### 触发 cache 重建

任何源文件改动后，源 hash 自动变 → 下次 OC 启动重建 cache（一次性，~1 秒）。无需手动清。但开发期想强制清：

```bash
rm -rf ~/.cache/short-video-director/
```

### 单次同步流程速查

```bash
# 1. 改源（agents/X.md 或 skills/X/SKILL.md）
$EDITOR agents/new-agent.md  # 或类似

# 2. 跑测试看哪里炸
npm test
# (按上表对应同步位置修复)

# 3. 重跑测试，全绿后再 commit
npm test && git add -A && git commit -m "..."

# 4. 启动 OC 真实验证
opencode agent list
opencode debug skill | head -30
```
