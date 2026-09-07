---
name: storyboarder-storyboard
description: 在剧本需要镜头设计、空间调度或可生成性诊断时使用；保留七字段 shot 与完整视听描述。
user-invocable: false
agent: storyboarder
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill
model: sonnet
---

## 输入

- 委托本集的 `story/episodes/{ep}/script.md`
- 已有 outline、novel 或邻集材料仅在理解意图、承接关系时选择性读取，不是必备输入
- 实际配置（`SVD_CONFIG` 指定路径，否则 `config.md`）
- 本集资产清单对应的 `assets/**/*.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/storyboarder-storyboard/rules.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/output-language.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-common.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/visual-prompt-craft-video.md`

## 委托上下文

- 从委托确定本集 ep、预期成果、可写范围和需保留的镜头；路径中的 `{ep}` 只是示意。信息冲突时先澄清，不默认最新集或全篇重写。

## 职责

加载本 skill 是补充当前负责人的本地专业知识，不转移角色或启动下一项委派。按委托选择诊断、复用或创作；独立验收由 Director 另行委派，作者自检不能代替。

把剧本忠实翻译为 `story/episodes/{ep}/storyboard.md`。以下是设计检查视角，不是必须依次执行的工序；可从最有风险的动作、对白或空间关系入手：

- 节拍与预算：按视觉节拍和对白边界拆分 shot，同时满足单镜、场景和用户整集预算；单镜可灵活分配，场景 ±10% 不额外扩大集总时长边界。
- 交付格式：每个 shot 有固定七字段和完整的 `画面与声音描述`。
- 视听表达：明确关键动作过程与终态，以及影响理解或衔接的朝向、屏幕方向、持有物和空间事实。每个 shot 可独立理解，不要求每段重复全部空间字段。
- 当前证据：把必要故事信息落实为当前可见/可听指令；年份方位、前情与场景预算不直接搬进 prose，也不为逐条事实新造字幕或装置。选择用眼神/动作表达，保持实际站位与持有关系。
- 表演：区分当前年龄的稳定声音身份与临场重音、呼吸、节奏、音量和音高；按说话对象、想法/态度与触发写可听变化，不只标情绪。原文、倾听与动作共同占用本镜预算，放不下就报告，不静默延时或改台词。
- 剧本保真：不改对白，不引入未声明基础资产，不重新分配场景节奏。
- 写入边界：不含 sheet 卡片/图片。发现剧本对白、节奏或资产清单矛盾时，给出定位、影响和跨负责人建议，不静默改写剧本。

写入前按 rules.md 自检字段、编号、时长、对白配速和资产引用。

## 输出

按授权写入 `story/episodes/{ep}/storyboard.md`，复用适用镜头。返回实际修改范围、诊断依据和未解决问题；纯诊断不写文件，完整创作不等于已验收或自动进入 sheet 制作。
