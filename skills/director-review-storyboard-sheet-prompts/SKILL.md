---
name: director-review-storyboard-sheet-prompts
description: Use when episode storyboard-sheet cards need a quality gate before sheet image generation or after targeted revisions.
user-invocable: false
context: fork
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
model: opus
---

# Review Storyboard Sheet Prompts

## 输入

- `$ARGUMENTS[0]`：ep，如 `ep01`。
- 读取已审核的 `story/episodes/{ep}/storyboard.md`、`config.md`、`assets/storyboard-sheets/{ep}/shot*.md`、卡中链接的资产，以及 `${CLAUDE_PLUGIN_ROOT}/skills/creator-storyboard-sheet-prompts/rules.md`。
- 维护 `story/episodes/{ep}/.review-storyboard-sheet-prompts.md`；不得修改 card、storyboard、资产或图片。

## Round 控制

1. review 文件不存在时为第 1 轮，审核 storyboard 全部 shots。
2. 文件存在时定位最大 N，并要求唯一 `<!-- /round-N -->` footer；缺失或重复则报 schema 错误，不猜测修复。
3. 最后一轮为“通过”时短路：立即返回 `pass`，不 append、不重审。
4. 后续轮次从最后一轮 `### dirty list` 逐行读取完整 repo-relative card path，只审核这些 dirty cards；不得从 `shot03` 短 id 猜路径，也不得重新引入已通过 card。
5. 本轮无问题时 append 通过轮；有问题时按完整 card path 去重后 append 需修改轮。

第 1 轮使用 Write。后续使用 Edit，以唯一 `<!-- /round-{N} -->` 为 anchor，保留旧 footer 后追加新轮。每轮末尾必须写：

```markdown
---
<!-- /round-{N} -->
```

写后 Read 自检当前 footer 恰好一次，才可返回状态。

## 审核清单

按顺序检查 card 一对一、metadata、panel timing/count/beats/repetition、assets、previous、board 协议和 converter slots：

- storyboard 每个 shot 恰有一张同号 card，无缺失、重复或 orphan；H1、ep、对应分镜、时长、类型和 `Panel 数量` 严格符合 card schema。
- PANEL 编号连续；时间升序、相接并完整覆盖时长；数量由可视 beat 决定，切点覆盖时间边界/cut/机位景别运动变化/姿态结果/反应/建立与结束，且无近重复格。
- 每格景别、机位、摄影机、画面和连续性可拍、相互协调，进入/离开状态无跳变。
- current shot 全资产均为有效简单 link；prompt 用 naked names，无手写 `{图片N}` converter slots。
- previous 仅相邻且确有声明的连续元素；无 previous 必须为 `无`；prompt 禁止复制前板网格、panel、构图、机位。
- 整板明确 16:9 等宽网格、左→右上→下、panel 内项目视频比例、项目彩色风格和短英文 label，并满足安全 Markdown 子集。

只拦截会造成内容漏拍、连续性错误、资产/转换失败、布局含混或高重复的具体问题。

## 意见与 owner

每项意见必须定位到 `shotNN/PANEL NN` 或 `shotNN/整板`，并有且仅有一个 owner：

合法枚举严格为 `owner=generator|prompt-fix|upstream-storyboard`，实际每项只写其中一个完整值。

- `owner=generator`：卡片结构、metadata、时间拆分、Panel 数量、资产链接等需要重新生成的确定性问题。
- `owner=prompt-fix`：结构和源信息正确，仅 Panel 描述、连续性表达或图像生成提示需要定向改善。
- `owner=upstream-storyboard`：源 storyboard 缺失、冲突、编号/时长错误或缺资产；不得要求 card 层编造。

不得把同一意见拆给多个 owner。意见说明 observed、expected 和最小修复方向，不直接重写整张卡。

## 输出格式

通过轮：

```markdown
## 第 {N} 轮 ({timestamp}) - 通过

---
<!-- /round-{N} -->
```

需修改轮：

```markdown
## 第 {N} 轮 ({timestamp}) - 需修改 ({M} shots)

### dirty list
- assets/storyboard-sheets/{ep}/shot03.md

### 意见列表
- location: shot03/PANEL 02
  owner=prompt-fix
  observed: 动作结束状态不明确
  expected: 说明手和道具最终位置
  direction: 在 PANEL 02 画面和连续性中补足可见落点

---
<!-- /round-{N} -->
```

dirty list 每行必须是 `assets/storyboard-sheets/{ep}/shotNN.md` 完整 card path；禁止只写 `shotNN`。`M` 是本轮 dirty card path 去重数，不是意见条数。落盘并自检后，仅返回 `pass` 或 `needs_revision {M}`。
