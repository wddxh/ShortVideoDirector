# Workflow 全局上下文与分支步骤设计

## 背景

workflow 文件存在两个问题：
1. config.md 在多个阶段重复读取，造成编排层 context 膨胀
2. 阶段 2a 和 2b 没有说明各自在什么情况下触发

## 设计目标

1. 引入全局上下文区块，阶段 1 读取一次，后续引用
2. 在阶段 1 和阶段 2 之间加入明确的分支步骤

## 文件变更

```
workflows/
├── new-story.md        # 修改
└── continue-story.md   # 修改
```

SKILL.md 不改。

---

## 变更 1: 全局上下文区块

### new-story.md

阶段 1 后新增：

```markdown
## 全局上下文

以下内容在阶段 1 中读取，后续阶段直接引用，不再重复读取：

- **config** — config.md 的配置内容（阶段 1 步骤 2 加载）
```

### continue-story.md

阶段 1 后新增：

```markdown
## 全局上下文

以下内容在阶段 1 中读取，后续阶段直接引用，不再重复读取：

- **config** — config.md 的配置内容（阶段 1 步骤 3 读取）
- **outline** — story/outline.md 的内容（阶段 1 步骤 1 读取）
- **recent_novels** — 最近 M 集的 novel.md 内容（阶段 1 步骤 4 读取）
- **asset_list** — assets/ 下所有文件路径列表（阶段 1 步骤 5 读取）
```

### agent 调用中的引用格式

全局上下文项在"读取输入"中改为引用格式，不再使用 Read：

```markdown
2. **读取输入：**
   - config（全局上下文）
   - 使用 Read 读取 [story/episodes/ep01/novel.md](...)
```

continue-story 中 outline 和 recent_novels 同理：

```markdown
2. **读取输入：**
   - config（全局上下文）
   - outline（全局上下文）
   - recent_novels（全局上下文）
```

### 注意事项

- continue-story 阶段 3 会追加内容到 outline.md，但全局上下文中的 outline 是阶段 1 读取时的版本
- 阶段 5 Creator 创建新资产后 assets/ 内容会变化，Storyboarder 职责 2 需要重新读取最新的 assets 路径列表（使用 Glob），不能引用全局上下文中的 asset_list

---

## 变更 2: 阶段 1.5 分支步骤

在阶段 1 之后、阶段 2a/2b 之前，新增分支步骤。

### new-story.md

```markdown
### 阶段 1.5: 输入分流

根据 SKILL.md 输入解析结果：

- **用户提供了故事输入**（内联文本、文件路径、或交互式输入）→ 进入**阶段 2b**
- **用户选择让 Director 生成剧情选项**（无 args 时选择 B）→ 进入**阶段 2a**
- **full-auto mode 且无 args** → 进入**阶段 2a**（Director 自动选择）
```

### continue-story.md

同上，内容一致。

---

## 受影响的 agent 调用汇总

以下调用的"读取输入"步骤需要将 config.md 的 Read 改为全局上下文引用：

### new-story.md
- 2a.1 Director 职责 1：config → 全局上下文
- 2b.1 Director 职责 2：config → 全局上下文
- 3.1 Director 职责 3：config → 全局上下文
- 4.1 Writer 职责 1：config → 全局上下文
- 5b Creator 职责 1：config → 全局上下文
- 5c Storyboarder 职责 2：config → 全局上下文

### continue-story.md
- 2a.1 Director 职责 1：config + outline + recent_novels → 全局上下文
- 2b.1 Director 职责 2：config + outline + recent_novels → 全局上下文
- 3.1 Director 职责 3：config + outline + recent_novels → 全局上下文
- 4.1 Writer 职责 1：config → 全局上下文
- 5b Creator 职责 1+2：config → 全局上下文
- 5c Storyboarder 职责 2：config → 全局上下文（asset_list 需重新 Glob）

不受影响的调用（本身就不读 config）：
- 4.2 Director 职责 4A
- 5a Storyboarder 职责 1
- 5e Director 职责 4B
