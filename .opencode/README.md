# ShortVideoDirector — OpenCode 插件

短视频创作工作流插件，提供 5 个子代理（director, writer, scriptwriter, storyboarder, creator）与 44 个 skills。

源代码是 Claude Code 插件，OC 兼容层在 `.opencode/` 下，运行时把源 skills 转换到 `~/.cache/short-video-director/<hash>/` 供 OC 加载，不污染源仓库。

## 依赖

需要在系统上预先安装：

- `dreamina` CLI（即梦视频生成）
- `python3`（部分脚本依赖）
- 系统 `crontab`（auto-video 需要）

## 安装

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
