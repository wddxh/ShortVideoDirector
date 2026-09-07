# ShortVideoDirector OpenCode 适配

插件从 `agents/*.md` 动态加载五个角色，从 `skills/*/SKILL.md` 发现技能，转换到 `~/.cache/short-video-director/<hash>/`。角色拥有专业工作，Skill 仅加载知识；当前源码契约与 live-host 验证状态必须分开，见「已知运行边界」。

## 依赖

Bash、Node.js（测试 Node 18+）、Python 3；实际图片/视频生成需要可用的 `dreamina` CLI。安装或升级 provider 不属于本文文档任务。

## 安装

方式 A，GitHub 安装，在 `~/.config/opencode/opencode.json` 添加：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    "short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"
  ]
}
```

方式 B，本地开发使用绝对 `file://` 路径：

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["file:///home/huangz/repos/ShortVideoDirector"]
}
```

替换为自己的仓库路径；Windows 形如 `file:///C:/path/to/ShortVideoDirector`。本地包直接读取源码，但转换后的 skills/agents 仍使用 SVD cache。修改后需退出并重启 OpenCode，不是热更新。

方式 C，在仓库目录运行 `opencode`，由宿主扫描 `.opencode/plugin/*.js`。此方式不使插件在其他故事项目目录全局可见。选择一种加载方式，避免重复配置。

方式 A 更新需刷新安装的包；方式 B/C 更新本地源码后重启。已有升级命令：

```bash
opencode plugin short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git --global --force
```

是否支持该 CLI 子命令以安装的 OpenCode 版本为准，本次未重装或验证升级。卸载时移除配置条目；不再需要时可清理 `~/.cache/short-video-director/` 和对应 OpenCode 包缓存，勿误删故事项目。

## 验证加载

重启后核对角色与当前 skill 集合：

```bash
opencode agent list
opencode debug skill
```

应包含 creator、director、scriptwriter、storyboarder、writer 五个 subagent；技能路径应来自本次转换的 cache，与源码集合一致。七个入口仍是 `series-video`、`short-video`、`edit-story`、`repair-story`、`generate-video`、`check-video`、`auto-video`。发现列表不证明子任务能加载知识、嵌套能运行或审核隔离成立，需另做只读宿主探测。

七个 command 原样传输 `$ARGUMENTS`，不拆 `$1` 等位置参数；入口整体理解自然语言、文件参考、范围和监控意图。缺失/冲突目标先澄清，不自动 latest/all。配置查看只读，缺失不初始化；短写示例不是内部 skill 参数协议。

## 协作契约

主 AI 处理用户沟通、范围和授权，把期望成果及材料路径委托 Director。Director 负责制作材料与专业协作；所有五个角色都有 description-based discovery 和本地 `skill()` 加载。加载 skill 不创建任务或改变角色，也不建立独立审核。

Director/Creator 的 Task 权限用于实际角色委托。嵌套可用时直接派发；明确深度/工具拒绝后记住本会话限制，普通任务失败不能据此判定嵌套不可用。不反复探测，也不自动改宿主深度。

不能嵌套时 Director 返回 role、outcome、references、scope、constraints，主 AI 忠实派发目标专家，将实际结果通过原 `task_id` 送回同一个 Director。主 AI 不接管创作顺序。若主 AI 也无法提供所需上下文则阻塞，不在当前会话冒充专家。

材料审核必须新建 Director 任务，不恢复制作任务或继承制作历史。逐图通常独立派发，汇总只读结论；审核者可做只读 Bash 检查，只写受托审核记录。无法隔离就保留未通过状态，不自审。范围及整文件身份过期需评估，不能用重试次数换通过。

完整交付要求剧本、分镜、相关基础资产卡/图、每镜头 sheet 卡/图和当前独立审核。规划材料按用途选择，用户要求制作前确认时等待真实批准。有效图像提供方 none 不是缺图豁免，不阻止取回。视频只在明确授权后提交；下载后由用户评判质量，不自动审片或合成。可选 [制作情境参考](../skills/director-outline/reference-workflows.md) 保留经验而非固定技能链；详细接口见 [主 README](../README.md)。

Creator 通过统一 provider 知识解释当前 CLI 能力，入口呈现用户固定/委托选择，不内置模型表。配置使用 `图像提供方/图像模型版本`、`视频提供方/视频模型版本` 和比例/分辨率字段，sheet 覆盖须明确授权。系列继承视频四元组，short 共用整集 ratio/resolution；集时长由用户初始决定，系列不漂移。Sheet 卡保存自身四项已解析设置，画布不等于视频比例。图片/视频 wrapper 均为七参数，视频分辨率实际转发；图片 receipt 保存真实执行信息，不补造历史。

## 适配实现

图片批量使用 `generate-images-dreamina.mjs [--force] [--concurrency N] JOBS.json`，sheet cards 用 `generate-storyboard-sheets-dreamina.sh [--force] [--concurrency N] CARD...` 接入同一 runner。Manifest 数组每项 `{source,output,prompt,images,settings:{provider,model,ratio,resolution}}` 只承载已授权目标、当前已审核提示及完整有序真实图片引用，不是新技能链或授权表。

默认 5 是本次本地 active 上限，不是账号总配额；Creator 根据当前接入限制/用户约束覆盖，不反复询问。实际基础/衍生/previous-sheet 依赖等待，其他 ready jobs 并发，不要求 sheets 全串行或分阶段 poll-all。当前依赖证据仍须满足，不 shell 并行 raw CLI/wrapper 绕过 runner。

首次失败/pending 停新、排空 active，保留全批成功、IDs 和未启动旧图；预检命中 target/ref pending 则全批阻塞。非 force completed skip 在 output claim 内复查；force 全批仅限明确替换目标。pending helper 互斥写入，stale claim/lock 或未知 receipt 人工核实，不自动过期。调度器不盲重试、不设质量轮次。CLI 非零仍可能已有成功，按 PNG/receipt/pending 核对；成功集合排除 skip，保留既有验收和全部未决审核范围。详见 [图像协议](../skills/creator-provider-dreamina/image.md)。

| 位置 | 当前行为 |
| --- | --- |
| `plugin/index.js` config hook | 注册 cache skills、角色和入口 commands；保留用户同名 command。未设置主上下文 external_directory 时默认 allow。 |
| `lib/load-agents.js` | 五个角色显式启用 Bash/Skill；Director、Creator 可 Task，其余禁用 Task。`model: inherit` 交宿主继承。 |
| `lib/transform-skills.js` | 保留 name/description，将角色等元数据放入 metadata.svd-*；标准 skill 引用一律重写为本地 skill 加载，保留代码块/引用边界和未知名称报错。 |
| `lib/tool-mapping.js` | 注入成果委托、忠实 relay、独立审核及分段写入约束，不维护创作调度器。 |
| `lib/bootstrap.js` | 生成角色/入口导览和当前协作契约，通过 SVD_BOOTSTRAP_MARKER 幂等注入。 |
| `lib/write-guard.js` | tool.execute.before 检查字符串参数，超过 2000 字符拒绝并给分段建议。 |

权限不是细粒度安全沙箱：当前五个角色的 Bash、external_directory 及读写均放行，reviewer 的“只写审核记录”是角色/委托约束，而非文件 ACL。收紧主 agent 不会自动收紧这些子角色；自定义权限后需验证 Skill、Task 和只读检查实际可用，不要把 allow 当作付费授权。

写入限制针对单次参数，不限制最终篇幅，JSON/YAML 同样分段。`apply_patch` 也须保持字符串参数不超过 2000 字符。

### 路径与 Cache

故事配置相关操作用 `review-evidence.mjs config-path [PATH]` 规范化 SVD_CONFIG（未设才 config.md）；仅支持项目内路径，拒绝外部或 symlink 越界。每次相关 Bash 显式传同一 SVD_CONFIG，委托/relay、配置与批准写入、fingerprint 共用 canonical 项目相对路径。纯已登记任务取回无需配置门禁；这与下面的插件根路径解析不同。

`${CLAUDE_PLUGIN_ROOT}/skills/` 在转换时指向 cache skills，其他 plugin-root 路径替换为插件根目录。shell.env 同时注入 `CLAUDE_PLUGIN_ROOT` 供 shell 兜底；aux Markdown 同样转换，其他辅助文件复制，共享 `_meta` 资源与脚本也进入 cache。

cache hash 使用 skills、agents、scripts、OC overrides/lib 的输入路径、mtime、size 与插件版本，取 SHA-256 前 16 位，保留最新三个 cache。相关源码变化后，下次启动生成新 hash；不会替换当前会话已加载的提示或历史 bootstrap。故障时可在退出宿主后清理 SVD cache 再启动，勿把清理视为实测通过。

## 自动监控

OpenCode 没有直接使用 Claude Cron 原语，而由 [auto-video override](skill-overrides/auto-video/SKILL.md) 启动 nohup loop，通过 HTTP `/session/{SID}/prompt_async` 触发检查。先做一次隔离检查；若无需继续或出现不可恢复错误，不安装 loop。

```bash
opencode --port 4096 -s YOUR_SESSION_ID
```

`/auto-video ep01` 可使用建议间隔 1200 秒，自定义间隔至少 60 秒；仅支持 epNN/all，部分镜头需确认范围，不静默扩展。解析需找到 server 端口和 session ID，检查 health endpoint；按 target/SID 保存 `/tmp/svd-auto-video-loop-*.pid`、`.log` 和 `/tmp/svd-cron-prompt-*.txt`，避免重复 loop。首次和周期检查只按有效末行 JSON 且 target 完全匹配决定停止，不从 prose 推断。

监控从 tasks.json 恢复真实授权：未调用 pending 可在 initial grant 内首次提交；failed 原输入重试需要独立 retry grant。wrapper reserve/settle 负责提交意图和状态，未知 inflight 人工核实，不自动清理或重提。`querying`/1 正常等待，`error`/2 保留 submitted/id 重试取回，不付费重生下载失败。

`all_complete` 只表示无需继续监控，可能仍有 human_needed；清理 loop 时必须报告已下载和待人工决定的差别。监控不做创作修复，不扩展授权，不评判视频质量。当前适配器的 live monitor 尚未实测。

## Troubleshooting

- 看不到角色/技能：核对 plugin 配置、实际安装路径、`opencode agent list` 和 `opencode debug skill`。退出重启后确认新 cache，不能只看旧会话描述。
- plugin 文件找不到：检查会话 shell 的 `CLAUDE_PLUGIN_ROOT`，文件读取使用解析后的绝对路径；脚本路径与故事工作区路径不同。
- 嵌套拒绝：保留真实拒绝证据并走主 AI relay，不自动调高深度。普通任务失败按任务原因处理。
- loop 无回调：核对进程的端口/session、PID 存活和日志；用 `curl http://127.0.0.1:4096/global/health` 检查对应端口。先确认旧 loop 已停，再重新启动，避免重复监控。
- 长参数被拒绝：缩小每次工具参数，不删减最终材料内容。

## 开发维护

```bash
npm test
npm run test:watch
python3 .codex/build-codex-skills.py --check
git diff --check
```

测试使用 Node 内置 runner，无 npm 依赖安装步骤。源码 skills/agents/scripts 是共同内容层；OpenCode 仅处理运行时适配。

- 加减 skill：集合动态发现，检查转换输出与源集合及 Codex wrappers 同步，不维护手工总数。
- 加减入口：更新 `lib/tool-mapping.js` 的入口集合，commands 自动 derive，检查参数和同名用户 command 保留。
- 修改角色：检查 `load-agents.js` 的角色权限映射、frontmatter 与实际子任务工具；不能由声明推断 live 支持。
- 修改 skill 引用：标准引用走本地加载，跨角色成果委托显式用 Task。aux Markdown 与主文档一起检查。
- 修改审核：对齐范围、输入身份和状态消费者；自然语言质量用独立语义评估，不写成关键词测试。
- 修改 auto-video：同步共享授权、错误和摘要语义至 OC override 及 cron prompt；保留宿主专属 loop 生命周期。
- 修改生成代码：检查原输入身份、初始/重试授权、reserve/settle、pending 恢复和 query/download，用 stub 测试，不提交真实任务。

### 画面方位语义评估

共享视觉原则 6 及资产、分镜、Panel 作者／审核提示负责方位表达，不新增方向 schema、转换引擎或关键词门禁，不修改故事项目与 provider。机械回归核对完整 shot／Panel 文本、引用转换、技能适配与 wrappers；这些测试通过不证明生成质量。

后续独立语义评估应使用隔离样例，比较修改前后作者输出与 reviewer 判断，保留实际输入、参考和结论，不运行付费生成：

- 已选机位使东边投影到画面左侧，与没有机位依据的“东边／西侧上方”配对；前者写实际几何，后者查参考或交 owner，不猜左右。
- 右下格的 PANEL 内人物向画面后景走，与反打后窗投影到另一侧配对；分别核对格内纵深、同一门窗拓扑，不固定整板格位或跨角度左右。
- 正面／转身后角色自己的右手持杯，与真正换持有手破坏后续动作配对；只阻塞后者。无实质影响的姿态与 cm 偏差仍可通过。
- 对白“去东门”、地名和已设计罗盘读数，与含混的仪器画面位置配对；原文／读数保留，位置用画面坐标，不新增地图道具。

本次未运行独立 agent 的前后语义评估；以上为后续评估范围，不是 pass 记录，也不替代现有独立审核。

## 已知运行边界

历史评估记录包含 OpenCode depth 1 拒绝、主 AI 转交/原 Director 恢复、局部独立审核，以及 cache `a68637a1939665f7` 的两项重启后探测。它们不是本次 provider/autonomy 改动后的验证，不证明当前新 cache 或完整监控可用，也不能推断所有安装都只支持一层。

本次只核对源码与机械测试，不更改宿主配置或重载插件。Claude Code、Codex 尚未 live 验证。后续需退出重启 OpenCode，并在新加载上下文记录版本、任务引用、发现/加载、relay 和独立审核证据。隔离不可用时材料验收仍阻塞。

本地 [审计索引](../docs/evaluations/skill-autonomy-audit.md)、[Provider 记录](../docs/evaluations/creator-provider.md) 和 [历史证据](../docs/evaluations/role-led-creation.md) 按仓库规则忽略，发行副本可能没有；主 README 保留核心验证边界。
