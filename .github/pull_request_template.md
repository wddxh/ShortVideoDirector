## 变更说明

<!-- 简述这次 PR 的目的与改动范围 -->

## 编辑入口检查

- [ ] 我只编辑了 `src/{skills,agents,workflows}/`、`tools/runtime-config.yml`、`CLAUDE.md`、`README.md`、`tools/build.py`、`tools/check-structure.py` 等**源**文件
- [ ] 我**没有**直接编辑 `.claude/`、`.opencode/`、`.claude-plugin/plugin.json` 等产物（这些由 `tools/build.py` 生成）
- [ ] 改动后我跑了 `uv run tools/build.py` 重新生成产物，并将产物 commit 进本 PR
- [ ] 改动后我跑了 `uv run tools/check-structure.py` 校验结构 → exit 0
- [ ] 我跑了 `uv run --with pytest --with python-frontmatter --with PyYAML pytest tools/tests/ -v` → 全部通过

## 双端验证

- [ ] Claude Code 端：影响的入口（如 `/series-video`）我至少跑了一遍 happy path
- [ ] opencode 端：影响的入口（如 `/series-video`）我至少跑了一遍 happy path（如不可用，请说明原因）

## 关联 issue / 文档

<!-- 如有 issue 编号或相关 design doc 链接，请填写 -->
