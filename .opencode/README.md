# ShortVideoDirector — OpenCode 插件

短视频创作工作流插件，提供 5 个子代理（director, writer, scriptwriter, storyboarder, creator）与 44 个 skills。

源代码是 Claude Code 插件，OC 兼容层在 `.opencode/` 下，运行时把源 skills 转换到 `~/.cache/short-video-director/<hash>/` 供 OC 加载，不污染源仓库。

## 依赖

需要在系统上预先安装：

- `dreamina` CLI（即梦视频生成）
- `python3`（部分脚本依赖）
- 系统 `crontab`（auto-video 需要）

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

进一步验证 skills 是否加载（应输出 44 个 skill，路径在 `~/.cache/short-video-director/<hash>/skills/`）：

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
          "bash $SVD_PLUGIN_DIR/scripts/*": "allow",
          "mkdir -p story/episodes/*": "allow",
          "crontab*": "allow",
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

1. **`config` hook**：把 cache 目录注册到 `config.skills.paths`，把 5 个子代理注册到 `config.agent`
2. **`shell.env` hook**：注入 `SVD_PLUGIN_DIR=<插件根目录>` 环境变量给所有 bash 调用，使转换后的 `bash $SVD_PLUGIN_DIR/scripts/X.sh` 能定位脚本
3. **`experimental.chat.messages.transform` hook**：在首条 user message 前注入 bootstrap 文本（列出 9 个 user-invocable workflow + 5 个子代理），用 `SVD_BOOTSTRAP_MARKER` 实现幂等

转换规则（源 CC skill → OC cache skill）：

- **frontmatter**：CC 字段（`context: fork`, `agent`, `user-invocable` 等）移到 `metadata.svd-*`，description 截断到 1024 字符
- **`使用 Skill tool 调用 X`**：若 X 有 `context: fork` → 重写为 `task({ subagent_type: ..., prompt: "..." })`；否则重写为 `调用 \`skill({ name: "X" })\``
- **`bash scripts/X.sh`** → **`bash $SVD_PLUGIN_DIR/scripts/X.sh`**
- **9 个 user-invocable workflow 顶部**：注入"写入约束 3000 字符"指引（避免 OC Write 工具超时）
- **fork-context skill 顶部**：注入"执行上下文：本 skill 已在 X 子代理中"提示
- **auto-video skill**：CC 的 `CronCreate/List/Delete` 原语替换为基于 `crontab` + `opencode run --session` 的 bash 调度

cache 失效逻辑：sha256(所有 .md 文件 path+mtime+size + plugin version) 的前 16 hex 字符；保留最新 3 个 cache。

## Troubleshooting

**问题：启动后看不到 5 个子代理**

- `opencode agent list` 看输出，若没有 director/writer 等说明 plugin 未加载
- 检查 `opencode.json` 的 plugin 配置正确性
- 强制重新拉取插件：`opencode plugin short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git --global --force`
- 清 cache 后重启：`rm -rf ~/.cache/short-video-director/`

**问题：调用 skill 时报"unknown skill"**

- 可能 cache 不完整。手动清 cache：`rm -rf ~/.cache/short-video-director/`，重启 OC 触发重建
- 验证转换是否产出 44 个 skill：`opencode debug skill | grep -c '"name":'`

**问题：bash 脚本调用失败说找不到文件**

- 检查 `$SVD_PLUGIN_DIR` 是否正确：在 OC 会话里跑 `bash -c 'echo $SVD_PLUGIN_DIR'`，应输出插件根目录绝对路径
- 如果输出为空，可能是 OC 版本不支持 `shell.env` hook，请升级 OC（≥ 1.15）

**问题：auto-video 的 cron 任务不执行**

- 检查 `crontab -l` 是否真的安装了条目（grep `svd-auto-video`）
- 检查 `/tmp/svd-cron-<session_id>.log` 看错误信息
- 确认 `opencode run` 命令在 cron 环境下可用（cron 的 PATH 通常很小，可能需要绝对路径）
- **Session 时效性**：cron 引用的 OC session 必须保持"近期活跃"。超过 24-48 小时未在 OC 中操作该 session，cron 会静默失败（exit=0 但 LLM 无响应）。建议短视频生成场景使用；超长任务建议手动重新安装 cron。

## 与 CC 版本的关系

- 源 `skills/`、`agents/`、`scripts/`、`.claude-plugin/` 完全不变，CC 用户继续按现有方式使用
- OC 兼容层（`.opencode/`、`package.json`）独立增量，不影响 CC
- 同一仓库同时支持 CC 与 OC，无需 fork

## 开发

测试零依赖 —— 用 Node 内置 `node --test` runner（Node 18+）：

```bash
# 跑单元测试（65 个）
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

### 改 `skills/` 时

| 改动 | 同步位置 | 失败征兆 |
|------|----------|---------|
| **加/减 skill 目录** | `.opencode/tests/transform-skills.test.js:240` 的 `assert.equal(dirs.length, 44)` | `produces SKILL.md for all 44 skills` 失败，错误显示实际目录数 |
| **新 skill 带 `user-invocable: true`** | `.opencode/lib/tool-mapping.js` 的 `USER_INVOCABLE_ENTRY_WORKFLOWS` Set（同时 `.opencode/tests/tool-mapping.test.js:13` 的硬编码列表） | `USER_INVOCABLE_ENTRY_WORKFLOWS contains exactly 9 entries` 失败 |
| **删除已有的 `user-invocable` skill** | 同上 | 同上 |
| **改 skill 间 `使用 Skill tool 调用 X` 引用** | 自动处理；但 X 必须存在于 `skills/` 否则 transform throws | integration test `produces SKILL.md for all 44 skills` 整个崩，错误显示 "Unknown skill referenced: X" |
| **改 skill `description` 字段超 1024 字符** | 自动 clip 到 1024（无错，但用户可能看到截断的描述） | 无测试失败，但 `opencode debug skill` 看到的 description 被截断 |
| **改 `auto-video/SKILL.md` 结构（删 `## ` 一级 section 或加入新非 cron 内容）** | `.opencode/lib/transform-skills.js` 的 `rewriteAutoVideoCron`（从首个 `## ` 截断；如果新内容也用 `## `，会被一起截掉） | `auto-video cache has crontab body, no CronCreate` 可能失败 |
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
| **加新 script `scripts/X.sh`** | 如果某 agent 需要调用，添加到 `.opencode/lib/load-agents.js` 的 `AGENT_BASH_CONFIG[agent].allowScripts` 数组（director/writer/scriptwriter/storyboarder；creator 设为 `'ALL'` 自动放行） | OC 运行时该 agent 调用 `bash $SVD_PLUGIN_DIR/scripts/X.sh` 被 `bash: deny` 拦 |
| **重命名/删除 script** | 同上：从 `AGENT_BASH_CONFIG` 中移除 | 无测试失败，但 skill 调用旧名会运行时 fail |
| **`bash scripts/X.sh` 调用方式不变** | 自动处理；`rewriteBashPaths` 注入 `$SVD_PLUGIN_DIR/` 前缀 | 无 |

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
