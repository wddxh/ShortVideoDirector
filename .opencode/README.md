# ShortVideoDirector OpenCode 适配

插件从 `agents/*.md` 动态加载五个角色，从 `skills/*/SKILL.md` 发现技能并转换到 `~/.cache/short-video-director/<hash>/`。Skill 是知识，不是任务调度或角色切换。工程由主 AI/general 负责；Director 保留实际创作协调和独立艺术审核。

## 安装与加载

在 `~/.config/opencode/opencode.json` 选择一个安装来源，避免重复加载：

```json
{"$schema":"https://opencode.ai/config.json","plugin":["short-video-director@git+https://github.com/wddxh/ShortVideoDirector.git"]}
```

本地开发可将 plugin 值改为 `file:///absolute/path/to/ShortVideoDirector`。在仓库内启动时也可由宿主扫描 `.opencode/plugin/*.js`，但不使插件自动全局可见。卸载移除对应配置，保留故事项目。

需要 Bash、Node.js、Python 3；图像 helper 需 Pillow，本地媒体按方法需 Blender/FFmpeg，付费生成需 Dreamina CLI。安装/升级须授权。

源码不是热加载。退出重启 OpenCode 后核对：

```bash
opencode agent list
opencode debug skill
```

应发现 creator/director/scriptwriter/storyboarder/writer、creator-local-reference 和 director-review-shot-inputs，以及七个入口 series-video、short-video、edit-story、repair-story、generate-video、check-video、auto-video。列表应与当前源集合一致。发现名称不证明嵌套、知识加载或审核隔离实际可用。

Commands 原样传 `$ARGUMENTS`，不拆位置参数。入口整体理解目标、路径和范围；歧义不默认 latest/all。配置查看只读，缺失不初始化。
## 当前制作契约

见 [shot-inputs](../skills/_meta/rules/shot-inputs.md)：manifest 顶层仅 references，条目仅 local PNG/MP4，每镜至少一个本地 MP4；静态相机可用静态 clip。Header 资产图提供身份，BOX 控制相机、布局、位置与整体轨迹，动作表情在完整 prompt，作品基线每请求一次。Sources 参与指纹不上传。Converter/task 保存 prompt/duration/typed references，submission 保存四元组和有序媒体指纹。

Creator 可按需直接操作 Blender/2D/FFmpeg，源码与媒体在故事项目 references/，不引入固定场景 DSL 或生产链。基础卡可选本地 PNG/sources，见 [卡片契约](../skills/_meta/rules/local-reference.md)。

检查入口为 `scripts/check-shot-inputs.mjs EP [SHOT...]`，配合 review-evidence check。五类 evidence 为 script/storyboard/asset-prompt/asset-visual/shot-input；最终就绪不含 asset-prompt，授权新增/重生图另须它，复用库存不扩 prompt scope。整集编号 1..N，选镜允许缺号且源编号递增唯一、目标存在。接口不相容报告工程阻塞。

shot-input 审核聚焦实际 prompt/media 集成、变化细节与必要边界，无具体冲突时复用当前 storyboard 判断。比较位置、轨迹、状态、轴线与身份，真实依赖存 inputs 指纹。源码/记账变化且渲染媒体未变可独立 scoped 兼容性评估，有依据才续签，不盲刷哈希或自动全量重审；必要看图仍新 task、缩略图优先。缺必要证据为 unknown。

short/series 含资产图与本地参考，停在付费视频提交前；后续手动 generate-video 建立真实 initial grant。submitted 按 recorded ID/provider 取回，缺 ID 人工核实并保留状态。None 禁新提交而非取回；保留 fixed settings、pending/receipt、grants、locks 和 inflight。

## 运行时适配

| 位置 | 职责 |
| --- | --- |
| plugin/index.js | 注册 cache skills、角色和 commands，保留用户同名 command |
| lib/load-agents.js | 角色工具权限与 model inherit |
| lib/transform-skills.js | 转换元数据、路径与知识引用，复制辅助资源 |
| lib/tool-mapping.js | 角色转交、用户决策、当前契约和分段约束 |
| lib/bootstrap.js | 动态角色/入口导览与幂等 bootstrap |
| lib/write-guard.js | 单次字符串参数最多 2000 字符 |

`${CLAUDE_PLUGIN_ROOT}/skills/` 转为 cache 路径，其他插件路径指向安装根；shell.env 提供根变量。故事 config/assets/references/story 仍相对故事项目。Cache 输入含源 skills/agents/scripts、OC overrides/lib 与版本；重启才加载更新，不改现有会话。

每次视觉操作按 [visual-context](../skills/_meta/rules/visual-context.md) 使用新 task、helper 缩略图与必要 crop，只 Read 返回 preview，原图用于 provider/指纹。独立 singleton 直接写受托轮次，相干小批纯文本可单任务逐 target 判断并落盘；协调者串行安排同文件写入。仅实际分开的 reviewer 结果需合并时用独立汇总者，生产者不编造 pass。只写受托记录及临时预览；规划按需采用。工具 allow 不等于付费/覆盖许可。

需要用户决定时完整展示原角色当前题和全部选项，再用原生 question 单选。主 AI 只依作者条件逐题呈现，完整原答复批量回原任务。嵌套明确拒绝后走忠实 relay，不接管创作、不自审或自动改深度。

## 自动监控

[auto-video override](skill-overrides/auto-video/SKILL.md) 仅在用户要求或已同意默认时启动 nohup loop，通过 OpenCode HTTP session/prompt_async 委托 checker。需要带 --port 的 session：

```bash
opencode --port 4096 -s YOUR_SESSION_ID
```

目标仅 epNN/all，部分镜头须确认边界，不静默扩大。间隔建议 1200 秒，最少 60 秒；按 target/SID 管理 PID、日志和 prompt 文件，避免重复。先执行一次隔离检查，无需继续或不可恢复错误则不安装 loop。端口/session/health 和停止细节由 override 负责。

首次及周期 checker payload 显式传 canonical config_path 或 UNRESOLVED，并沿 Creator relay 保留。未解析只取回并报 human_needed，不选择默认配置。Untouched pending 用真实 initial grant，failed 需 retry grant；付费交真实 Creator，嵌套拒绝则主 AI 派 sibling 后恢复同一 checker。未知 inflight 保留待核实。仅有效同目标末行 JSON 决定停止，all_complete 可含 human_needed。下载失败保留 ID 重试取回；监控不创作修复或审片。

## 维护与验证

修改后生成 Codex wrappers 并 --check，使用 git diff --check 检查补丁；源集合动态发现，不维护手工技能总数。当前契约与代码未同步时由主 AI/general 修工程，不能用 provider 接受请求代替门禁。Live-host 的角色加载、relay、隔离与监控须单独验证，机械检查不证明创作质量或完整 E2E。退出重启后核对当前安装/cache，发现旧名称时先确认路径。
