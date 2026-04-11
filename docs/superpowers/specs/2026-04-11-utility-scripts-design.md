# 工具脚本固化 设计文档

> **执行方式：** 使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实施。

**目标：** 将 skill 中频繁使用的机械性、确定性步骤提取为独立 Bash 脚本，提高可靠性和一致性。

**架构：** 6 个独立脚本，每个脚本负责一个确定性操作。skill 通过 Bash 调用脚本获取结果，不再依赖 LLM 执行这些机械步骤。

---

## 1. `scripts/read-config.sh`

**用途：** 从 config.md 提取指定键的值。

**用法：**
```bash
bash scripts/read-config.sh "图像模型"          # 输出: dreamina
bash scripts/read-config.sh "每集小说字数"       # 输出: 4000-5000
bash scripts/read-config.sh "即梦模型版本"       # 输出: 4.0
bash scripts/read-config.sh "视频模型"           # 输出: none
```

**输入参数：**
- `$1` — 键名（如 `图像模型`）
- `$2` — config 文件路径（可选，默认 `config.md`）

**行为：**
1. 在文件中匹配 `- {键名}: {值}` 格式的行（跳过 `#` 注释行）
2. 提取冒号后的值部分，去除行尾注释（`#` 及其后内容）和首尾空格
3. 若找到 → stdout 输出值，exit 0
4. 若未找到 → stdout 输出空，exit 1

**影响的 skill（7 个）：** creator-generate-images, creator-image-dreamina, creator-video-dreamina, check-video, generate-video, series-repair-story, short-repair-story

## 2. `scripts/check-episode.sh`

**用途：** 一次性检查指定集的文件完整性，输出结构化检查结果。

**用法：**
```bash
bash scripts/check-episode.sh ep01 config.md
# 输出（每行一项）:
# outline:ok
# novel:ok
# script:missing
# asset-list:ok
# assets:missing:张三,小巷
# images:missing:张三,小巷
# storyboard:incomplete:5/15
```

**输入参数：**
- `$1` — 集数（如 `ep01`）
- `$2` — config 文件路径（可选，默认 `config.md`）

**行为：**
按顺序检查以下项目，每项输出一行 `{检查项}:{状态}[:详情]`：

1. **outline** — 检查 `story/episodes/{集数}/outline.md` 是否存在，是否包含 `## 集尾钩子` 或 `## 结局设计`
   - `ok` / `missing` / `incomplete`

2. **novel** — 检查 `story/episodes/{集数}/novel.md` 是否存在，调用 `bash scripts/word-count.sh` 统计字数，对比 config 中 `每集小说字数` 下限的 50%
   - `ok` / `missing` / `incomplete:{实际字数}/{目标下限}`

3. **script** — 检查 `story/episodes/{集数}/script.md` 是否存在，是否包含 `## 场景`
   - `ok` / `missing` / `incomplete`
   - 注意：novel 和 script 是二选一（系列视频用 novel，短视频用 script），两者都不存在才算缺失

4. **asset-list** — 检查 `story/episodes/{集数}/outline.md` 是否包含 `## 本集资产清单`
   - `ok` / `missing`

5. **assets** — 从资产清单的「新增资产」中提取资产名，检查 `assets/**/*.md` 是否存在
   - `ok` / `missing:{缺失资产名逗号分隔}`

6. **images** — 对照已有资产文件，检查 `assets/images/{category}/{name}.png` 是否存在（仅当 config 图像模型非 none 时检查）
   - `ok` / `missing:{缺失资产名逗号分隔}` / `skipped`（图像模型为 none）

7. **storyboard** — 检查 `story/episodes/{集数}/storyboard.md` 是否存在，统计镜头数（`### 镜头` 出现次数），对比 config 中 `每集分镜数` 的 50%
   - `ok` / `missing` / `incomplete:{实际镜头数}/{目标数}`

**退出码：**
- `0` — 所有检查通过（全部 ok 或 skipped）
- `1` — 有检查项不通过

**影响的 skill（2 个）：** series-repair-story, short-repair-story

## 3. `scripts/storyboard-to-prompt.sh`

**用途：** 从分镜文件中提取指定镜头，将资产链接替换为 `{图片N}` 格式，输出替换后的 prompt 和图片路径映射。

**用法：**
```bash
bash scripts/storyboard-to-prompt.sh story/episodes/ep01/storyboard.md 7
# 输出（两部分用 --- 分隔）:
# IMAGES:assets/images/characters/林知意.png,assets/images/items/唐代铜镜.png,assets/images/locations/考古实验室.png
# DURATION:15
# ---
# ### 镜头 7
# - **引用资产：** [林知意:{图片1}]、[唐代铜镜:{图片2}]、[考古实验室:{图片3}]
# - **镜头类型：** 特写
# ...（完整镜头块）
```

**输入参数：**
- `$1` — 分镜文件路径
- `$2` — 镜头编号（数字）

**行为：**
1. 从文件中提取 `### 镜头 {N}` 到下一个 `### 镜头` 之间的内容
2. 解析 `**引用资产：**` 行，提取所有 `[名称](路径)` 格式的链接
3. 按顺序将每个链接替换为 `[名称:{图片N}]`
4. 将每个资产 md 路径转换为图片路径（调用 `asset-to-image-path.sh` 或内联转换）
5. 提取 `**时长：**` 行的秒数
6. 输出 `IMAGES:` 行（逗号分隔的图片路径）、`DURATION:` 行、`---` 分隔符、替换后的完整镜头块

**退出码：**
- `0` — 成功
- `1` — 镜头不存在或解析失败

**影响的 skill（1 个）：** creator-video-dreamina

## 4. `scripts/asset-to-image-path.sh`

**用途：** 将资产 md 文件路径转换为对应的图片路径。

**用法：**
```bash
bash scripts/asset-to-image-path.sh "assets/characters/张三.md"
# 输出: assets/images/characters/张三.png

bash scripts/asset-to-image-path.sh "../../../assets/characters/张三.md"
# 输出: assets/images/characters/张三.png

bash scripts/asset-to-image-path.sh "assets/items/铜镜.md" "assets/locations/小巷.md"
# 输出（每行一个）:
# assets/images/items/铜镜.png
# assets/images/locations/小巷.png
```

**输入参数：**
- `$@` — 一个或多个资产 md 路径

**行为：**
1. 对每个路径：去除 `../../../` 等相对路径前缀，规范化为 `assets/{category}/{name}.md`
2. 插入 `images/`：`assets/{category}/{name}.md` → `assets/images/{category}/{name}.png`
3. 每个结果输出一行

**退出码：**
- `0` — 成功

**影响的 skill（4 个）：** creator-image-dreamina, creator-generate-images, generate-video, check-video

## 5. `scripts/latest-episode.sh`

**用途：** 检测 story/episodes/ 下最新的集数编号。

**用法：**
```bash
bash scripts/latest-episode.sh
# 输出: ep03
# （若目录不存在或为空，输出空，exit 1）
```

**输入参数：** 无

**行为：**
1. 使用 `ls` 匹配 `story/episodes/ep*/` 目录
2. 按数字排序取最大值
3. 输出 `ep{N}` 格式

**退出码：**
- `0` — 找到
- `1` — 无集数目录

**影响的 skill（2 个）：** continue-story, series-repair-story

## 6. `scripts/task-status.sh`

**用途：** 查询和更新 pending.json / tasks.json 中的任务状态。

**用法：**
```bash
# 查询所有 pending 任务状态（调用 dreamina query_result）
bash scripts/task-status.sh query assets/images/pending.json /tmp/download-dir
# 输出（每行一个）:
# submit_id1:success:/tmp/download-dir/submit_id1_image_1.png
# submit_id2:fail:content_violation
# submit_id3:querying

# 查询视频任务状态
bash scripts/task-status.sh query story/episodes/ep01/videos/tasks.json /tmp/download-dir
# 输出:
# submit_id1:success:/tmp/download-dir/submit_id1_video_1.mp4
# submit_id2:querying

# 更新 JSON 中指定 submit_id 的状态
bash scripts/task-status.sh update assets/images/pending.json submit_id1 done
bash scripts/task-status.sh update story/episodes/ep01/videos/tasks.json submit_id1 done

# 移除 JSON 中指定 submit_id 的条目
bash scripts/task-status.sh remove assets/images/pending.json submit_id1

# 添加条目到 JSON
bash scripts/task-status.sh add story/episodes/ep01/videos/tasks.json '{"shot":1,"submit_id":"xxx","status":"submitted"}'
```

**输入参数：**
- `$1` — 操作（`query` / `update` / `remove` / `add`）
- `$2` — JSON 文件路径
- `$3+` — 操作参数（见上方用法）

**行为：**
- `query` — 读取 JSON，对每个 status 为 `submitted` 的条目调用 `dreamina query_result --submit_id={id} --download_dir={$3}`，输出 `{submit_id}:{gen_status}[:{下载路径或失败原因}]`
- `update` — 读取 JSON，找到 submit_id 匹配的条目，更新 status 字段，写回
- `remove` — 读取 JSON，移除 submit_id 匹配的条目，写回（空数组则删除文件）
- `add` — 读取 JSON（不存在则创建空数组），追加条目，写回

**退出码：**
- `0` — 成功
- `1` — 文件不存在（query/update/remove 时）或参数错误

**注意：** JSON 操作使用 `grep`/`sed`/`awk` 处理（不依赖 jq），因为项目环境是 Git Bash。JSON 结构简单固定，不需要通用 JSON 解析器。

**影响的 skill（4 个）：** creator-image-dreamina, series-repair-story, short-repair-story, check-video

## 7. Skill 引用更新

创建脚本后，需要更新所有受影响的 skill，将原本的 LLM 机械步骤替换为 `bash scripts/xxx.sh` 调用。这是第二阶段的工作，在脚本创建并测试后进行。

## 8. 不在本次范围内

- 不重构 skill 的非机械性步骤（LLM 判断、内容生成、用户交互）
- 不引入 jq 或 Python 等外部依赖
- 不改变 skill 的外部接口和行为
