# Codex 安装说明

Codex 通过 `.codex-plugin/plugin.json` 加载 `.codex/skills/`；Claude Code 直接读取 `skills/`。源 skills 是唯一人工维护层。Wrappers 只含元数据、[运行时映射](tool-mapping.md) 和源文件指引，不复制正文，不手工编辑。

源集合、元数据或映射改变后生成并检查：

```bash
python3 .codex/build-codex-skills.py
python3 .codex/build-codex-skills.py --check
```

生成器按当前源集合重建 wrappers。七个入口为 series-video、short-video、edit-story、repair-story、generate-video、check-video、auto-video。宿主原样传 `$ARGUMENTS`；整体理解自然语言，不拆位置参数。缺目标不默认最新/全部，配置查看只读。

## 角色与工具

Task/Agent 按运行时映射建立真实角色上下文，读取 `agents/<role>.md`，传成果、路径、范围、约束和决策余地。Skill/agent 元数据不等于角色切换或独立审核。Director 协调创作，Writer 拥有叙事，Scriptwriter 拥有剧本/清单，Storyboarder 拥有镜头，Creator 拥有资产、本地参考及 manifest。主 AI/general 负责工程、宿主配置和测试。

嵌套明确拒绝后由主 AI 转交并恢复原 owner task，不反复探测或调高深度。独立审核使用全新 Director task，不继承生产历史；每次视觉操作均新任务和 helper 缩略图，最小必要比较集。无法隔离则 unknown/阻塞，不自审。模型与 allowed-tools 元数据是提示，实际能力由宿主决定；使用当前活动模型。每次手工写入含 apply_patch 不超过 2000 字符，不限制总长度。
## 当前制作契约

每镜 `story/episodes/{ep}/shot-inputs/shotNN.json` 使用 [输入契约](../skills/_meta/rules/shot-inputs.md)：顶层为 references，仅 local PNG/MP4，至少一个 MP4。静态相机可用静态 clip；资产图提供身份，BOX MP4 控制相机、布局、位置和整体轨迹。详细动作表情在 prompt，作品级风格每请求一次；sources 是可编辑与审核输入，不上传。

结构诊断使用 `scripts/check-shot-inputs.mjs EP [SHOT...]`，完整就绪使用 review-evidence check；五类 evidence 为 script/storyboard/asset-prompt/asset-visual/shot-input。最终就绪要求 script/storyboard/asset-visual/shot-input，新生图另须 asset-prompt。单目标独立审核直接保存结果，分别派发的结果按需汇总，文件写入串行执行。

独立 director-review-shot-inputs 按故事选择必要相邻/非相邻/跨集边界，用最小配对比较两端 prompt/MP4 的位置、轨迹、关键状态、轴线及身份；实际依赖保存在既有 inputs 指纹。缺必要输入 unknown，机械检查不证明穷尽连续性；不新建 schema/review kind 或自动递归重渲染。

short/series 包含必要资产图与本地参考，并停在付费视频提交前。后续手动 generate-video 实际请求登记 initial grant。新提交/重试使用实际输入及真实 grants；已提交任务按记录的 ID/provider 查询下载。pending/receipt、次数、locks、inflight 与 submitted/done 保护贯穿执行。

视频 wrapper 为 `--references-json PROMPT OUTPUT REFERENCES_JSON DURATION RATIO MODEL RESOLUTION`，flag 后七参数。Capture 返回 `{provider,model,ratio,resolution,references:[{media,path,sha256}]}`。模型能力按当前 help 核实，技术选择包含 images/video scopes。

## 路径与监控

Codex 插件进程提供 CLAUDE_PLUGIN_ROOT。Shell 展开该变量；文件工具需先取得实际绝对路径，不能读取字面变量。源 skill 的相对指南按源目录解析，故事文件相对工作区。配置用 `review-evidence.mjs config-path` 规范化实际 SVD_CONFIG，相关命令/委托/指纹共用该路径；纯 recorded-ID 取回绕过配置门禁。

auto-video 按运行时映射优先使用 Codex automation，只有用户要求或已同意默认才启动。不可用时说明限制，可手动或按真实授权外部周期委托 checker，不自行编造宿主能力。首次/周期调用都保留 Creator relay 和当前输入契约。仅有效、target 匹配的末行 JSON 决定停止；all_complete 可含 human_needed，不表示全成功。

Querying/1 是等待；error/2 保留 submitted/id 并重试同一 ID 取回，不付费重生下载失败。Done 仅表示下载；成片由用户判断，不自动审片/合成。具体安全与恢复接口见 [主 README](../README.md)。

用户问题按运行时映射完整展示当前题，再用当前模式可用 request_user_input；不能容纳全部选项时说明限制并保留标签和选项文本，不改模式/权限。相关原始答复及条件批量回作者。

## 验证边界

生成器 --check 只验证 wrapper 集合/内容与源同步，不启动 Codex，也不证明任务隔离、relay、automation 或创作质量。当前 live-host 行为须在实际宿主验证。退出重启后核对实际安装路径和源集合；不把本地机械检查称为完整 E2E。
