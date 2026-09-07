# Codex 安装说明

Codex 支持由 `.codex-plugin/plugin.json` 提供。

Claude Code 从 `skills/` 加载源 skills。Codex 从 `.codex/skills/` 加载生成的轻量适配层。

## 单一 Skill 源

`skills/` 是唯一需要人工维护的 skill 目录。不要手动修改 `.codex/skills/` 下生成的适配层。

适配层只包含 Codex 可识别的元数据、`.codex/tool-mapping.md`，以及指向源 skill `skills/<name>/SKILL.md` 的执行说明。适配层不复制源 skill 正文。

修改 `.codex/tool-mapping.md` 或源 skill 的头部元数据后，重新生成适配层：

```bash
python3 .codex/build-codex-skills.py
```

只检查适配层是否已同步，不写文件：

```bash
python3 .codex/build-codex-skills.py --check
```

## 用户可调用工作流

- `series-video`
- `short-video`
- `edit-story`
- `repair-story`
- `generate-video`
- `check-video`
- `auto-video`

入口请求由宿主原样传输 `$ARGUMENTS`，整体理解自然语言、文件、范围和监控意图；不拆位置参数或构造内部 skill 参数串。缺失/冲突目标先澄清，不默认最新/全部；配置查看只读，缺失不初始化。

## 说明

- 所有当前源 skills 保留在 `skills/`，供角色按 description 发现并按需要加载；不是要求入口按名称执行完整调用链。
- `allowed-tools` 和 `model` 等 Claude 专用头部元数据继续保留在源 skill 中供 Claude Code 使用。Codex 适配层的头部元数据只保留跨运行时的发现信息。
- `/auto-video` 的源 skill 仍描述 Claude Cron 行为。Codex 通过 `.codex/tool-mapping.md` 解释这些运行时差异。

## Troubleshoot

**症状**：Codex LLM 报 "Cannot read file `${CLAUDE_PLUGIN_ROOT}/...`"。

**验证**：在 Codex 会话里跑 `echo $CLAUDE_PLUGIN_ROOT`，应输出绝对路径。

**处理**：核对插件安装位置和宿主传入的环境。文件工具不会展开字面量 `${CLAUDE_PLUGIN_ROOT}`，先取得绝对路径再读取；项目 story/assets/config.md 仍相对故事工作区。不要手改生成 wrapper，当前生成器不注入 export fallback。

## 角色委托与发现

五个角色都通过 description 发现所需知识，加载 skill 不改变角色。Director 拥有制作成果，Writer 拥有散文叙事，Scriptwriter 拥有剧本/资产清单，Storyboarder 拥有镜头，Creator 拥有视觉资产和 sheet。各角色选择方法，跨所有者建议由 Director 协调。

Task/Agent 按 [运行时映射](tool-mapping.md) 建立真正的子代理上下文，应用 `${CLAUDE_PLUGIN_ROOT}/agents/<role>.md`，传成果、参考路径、范围、约束和决策余地，不指定技能链。wrapper 保留 agent 关联元数据，但元数据或本地 skill 加载不等于已派发角色。

明确嵌套拒绝后记住本会话限制；主 AI 忠实转交 Director 的专家请求，再用宿主任务/agent ID 恢复原 Director。主 AI 不另排流程、不自动提高宿主深度。普通任务失败不代表深度受限。

独立材料审核新建 Director 上下文，不继承制作历史，不恢复制作任务。逐图通常单独派发，汇总只读结论。审核者可做只读 Bash 检查，只写受托审核记录；若 relay 也无法提供隔离，报告阻塞，禁止自审替代。

## 制作与视频边界

完整制作需要剧本、分镜、实际基础资产卡/图和每镜头 sheet 卡/图及当前独立审核；outline/novel/arc 按用途选择。用户要求制作前确认时先交约定材料并等待实际批准，审核 pass 不替代批准。有效图像提供方 none 不豁免图片，也不阻断取回；缺图或未决审核只可部分交付。可选 [制作情境参考](../skills/director-outline/reference-workflows.md) 是判断知识，不是必跑技能链。

视频仅提交、查询和下载，由用户评判成片质量，不自动审片、剪辑或合成。任务准备记录原模型/比例和有序图片身份，首次提交和失败重试分别使用用户真实 initial/retry grant。wrapper 在 provider 前 reserve 并持久化 inflight，明确结果 settle；未知意图须核实，不能自动重提。

`querying`/1 为等待；查询/下载 `error`/2 保留 submitted/id，重试同一任务取回，不付费重生。`done` 只表示下载，`all_complete` 可含 human_needed，不是所有视频通过。无 Codex automation 时可手动或获准外部周期委托检查，传明确 target 和 unattended 意图，不要求用户 flags。首次/周期检查均保留 Creator relay，仅有效同目标末行 JSON 可决定停止。

Bash、Node.js 与 Python 3 用于本地脚本/生成层；实际生成另需可用 Dreamina CLI。本次不安装、升级或调用 provider。更多命令和配置见 [主 README](../README.md)。

## 配置与执行接口

统一 Creator provider 知识按当前版本/help 解释能力，入口记录真实固定/委托字段，不维护静态模型表。使用 `图像提供方/图像模型版本`、`视频提供方/视频模型版本` 及比例/分辨率字段；`参数选择授权` 区分 images/sheets/video。缺值或 auto 不是授权，共享固定值约束 sheets，覆盖需明确范围。

系列从所有已准备任务继承视频 provider/model/ratio/resolution；short 共用整集 ratio/resolution。集总时长由用户初始决定，系列各集共用而非按前集实际漂移。每张 sheet 保存四项已解析设置，画布与视频比例分开，不限制为 16:9。

图片 wrapper 为 `[--force] PROMPT OUTPUT RATIO RESOLUTION MODEL REFS SOURCE`；视频为 `PROMPT OUTPUT IMAGES DURATION RATIO MODEL RESOLUTION`，均恰好七参数，空 REFS 也占位。分辨率实际转发；不接受任意 flags、自定义宽高或多图输出。Coordinator 为 `[--force] CARD...`，逐卡取设置；图片 `.generation.json` 保存真实 tuple/status/hash，恢复先 settle 后移除 pending，不给已有图片补造历史。

配置相关工作先用 `review-evidence.mjs config-path [PATH]` 规范化实际 SVD_CONFIG（未设才 config.md），仅支持项目内配置。每次相关 Bash 显式传同一路径，委托、批准写入与指纹共用 canonical 项目相对路径；纯取回不经过配置门禁。详见主 README 的接口参考。

## 验证状态

`--check` 只校验 wrapper 内容/集合与源及映射同步，不启动 Codex，不证明子角色发现、relay、审核隔离或 automation 可用。源 allowed-tools/model 在 Codex 中是提示，实际能力以宿主为准；每次 Write/Edit 保持 2000 字符以内，不限制最终篇幅。

Codex 和 Claude Code 的当前 live-host 行为未验证。历史 OpenCode 有 depth 1 拒绝、转交/恢复、局部独立审核及旧 cache 的限定重启探测，但不证明本次 provider/autonomy 改动或 Codex 支持。后续需在实际宿主记录版本、加载路径、任务引用、选择性加载和独立审核证据。

本地 [审计索引](../docs/evaluations/skill-autonomy-audit.md) 与 [Provider 记录](../docs/evaluations/creator-provider.md) 列出当前核对及未运行场景；[历史评估](../docs/evaluations/role-led-creation.md) 只证明其标明版本和范围。docs 按仓库规则忽略，发行副本可能不包含这些文件。
