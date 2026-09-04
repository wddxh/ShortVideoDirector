# Storyboard Sheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace per-keyframe generation with one model-independent, multi-panel storyboard sheet per video shot and use that sheet as the primary video reference.

**Architecture:** `storyboard.md` remains the shot timeline. New, initially unconnected Creator/Director skills derive and review one `shotNN.md` card and one 16:9 PNG per shot. A single atomic cutover removes the KF runtime, connects sheet generation to all pipelines, and makes `tasks.json.images` sheet-first and order-stable for initial submission and retries.

**Tech Stack:** Markdown skills and prompts, Bash protocol scripts, Dreamina CLI adapter, Node.js `node:test`, Python Codex wrapper generator, OpenCode runtime transformer.

---

## Execution Rules

- Work in `/home/huangz/repos/ShortVideoDirector/.worktrees/storyboard-sheets` on `refactor/storyboard-sheets`.
- Follow `docs/superpowers/specs/2026-09-04-storyboard-sheets-design.md`.
- Use TDD for scripts and source contracts. Never call real Dreamina in tests.
- Do not cap reference images. Return provider limits as provider errors.
- Follow repository `AGENTS.md`: mechanically test only deterministic paths, schemas, states, ordering, and tool boundaries.
- Do not encode natural-language quality or LLM judgment as keyword/regex tests. Panel quality, continuity meaning, and prompt quality belong to semantic Director review.
- Add defensive tests only for observed bugs or credible inputs produced by supported callers; do not expand tasks for contrived unreachable cases.
- Regenerate `.codex/skills/` in every commit that changes the source skill set.
- Tasks 1-6 add inactive foundations while the old pipeline stays operational.
- Task 7 is the single atomic cutover; do not commit a partial Task 7.
- After cutover, old KF detection literals are allowed only in `scripts/detect-legacy-kf.sh`.

## Stable Protocols

```text
Card:  assets/storyboard-sheets/{ep}/shotNN.md
Image: assets/images/storyboard-sheets/{ep}/shotNN.png
Prompt review: story/episodes/{ep}/.review-storyboard-sheet-prompts.md
Visual review: story/episodes/{ep}/.review-storyboard-sheets-visual.md
```

`storyboard-sheet-to-prompt.sh <card>`:

```text
IMAGES:<characters>,<location/item/building>,<optional previous sheet>
---
**参考资产：** [name:{图片1}] ...

<verbatim image prompt>
```

`storyboard-to-prompt.sh <storyboard> <shot>` after cutover:

```text
IMAGES:<current sheet>,<characters>,<location/item/building>
DURATION:<seconds>
---
**视频参考图：** [CURRENT_SHOT_STORYBOARD_SHEET:{图片1}] ...
**分镜板解释规则：** <panel order; prose authoritative; labels not rendered>
<verbatim shot block>
```

Converters return `1` for invalid current input and propagate legacy-detector exit `2`. Errors are `FAIL ...` on stderr. References are never truncated.

### Task 1: Characterize Provider-Neutral Media Arguments

**Files:**
- Create: `.opencode/tests/asset-to-image-path.test.js`
- Create: `.opencode/tests/image-gen-dreamina.test.js`
- Create: `.opencode/tests/video-gen-dreamina.test.js`
- Modify: `scripts/image-gen-dreamina.sh`
- Modify: `scripts/video-gen-dreamina.sh`

- [ ] **Step 1: Write path mapping tests**

```js
assert.equal(run('assets/storyboard-sheets/ep01/shot01.md').stdout.trim(),
  'assets/images/storyboard-sheets/ep01/shot01.png');
assert.deepEqual(runMany(['assets/items/A.md', 'assets/locations/B.md']),
  ['assets/images/items/A.png', 'assets/images/locations/B.png']);
```

- [ ] **Step 2: Run mapping tests**

Run: `node --test .opencode/tests/asset-to-image-path.test.js`

Expected: PASS as characterization; otherwise make only the mapping fix.

- [ ] **Step 3: Write fake-provider tests**

Place a fake `dreamina` first in `PATH`; it writes argv to `$DREAMINA_ARGS` and prints `$DREAMINA_RESPONSE`. Test image2image receives an 11-reference CSV unchanged. Test video receives repeated `--image` flags in sheet/character/location order and preserves prompt metacharacters. Add a test that empty video images does not invoke the fake provider.

```js
assert.equal(valueAfter(args, '--images'), refs11);
assert.deepEqual(imageFlagValues(args), [sheet, character, location]);
assert.match(result.stdout, /^SUBMITTED abc/m);
```

- [ ] **Step 4: Run tests and observe one failure**

Run: `node --test .opencode/tests/{image-gen-dreamina,video-gen-dreamina}.test.js`

Expected: ordering/no-limit tests PASS; empty video input FAILS.

- [ ] **Step 5: Add the empty-input guard and neutral comments**

```bash
if [ -z "$IMAGES" ]; then
  echo "FAIL images list is empty"
  exit 1
fi
```

Remove comments promising a numeric provider limit. State that full reference input and provider errors pass through.

- [ ] **Step 6: Verify and commit**

Run: `node --test .opencode/tests/{asset-to-image-path,image-gen-dreamina,video-gen-dreamina}.test.js`

Expected: PASS.

```bash
git add scripts/image-gen-dreamina.sh scripts/video-gen-dreamina.sh .opencode/tests
git commit -m "test: lock media reference ordering"
```

### Task 2: Add A Central Legacy Detector

**Files:**
- Create: `scripts/detect-legacy-kf.sh`
- Create: `.opencode/tests/detect-legacy-kf.test.js`

- [ ] **Step 1: Write failing detector tests**

Run with `<ep> [storyboard-path] [tasks-path]` against temporary projects. Current input returns `0`. Any old state returns exit `2` and one actionable stderr line containing all evidence, “当前版本不兼容”, “旧 release”, and “人工迁移”. Cases: episode legacy JSON, either old directory, old storyboard link/marker, and a persisted task image using the old image directory.

```js
assert.equal(legacy.status, 2);
assert.match(legacy.stderr, /^FAIL legacy KF contract detected:/);
assert.match(legacy.stderr, /当前版本不兼容.*旧 release.*人工迁移/s);
```

- [ ] **Step 2: Run and verify missing script**

Run: `node --test .opencode/tests/detect-legacy-kf.test.js`

Expected: FAIL because the detector does not exist.

- [ ] **Step 3: Implement the detector**

Check only explicit legacy files/directories, storyboard markers/links, and optional tasks image paths. Collect comma-separated repo-relative evidence, print one stderr line, and exit `2`. Do not migrate or delete anything. Other production files call this detector and do not embed legacy literals.

- [ ] **Step 4: Verify and commit**

Run: `node --test .opencode/tests/detect-legacy-kf.test.js`

Expected: PASS.

```bash
git add scripts/detect-legacy-kf.sh .opencode/tests/detect-legacy-kf.test.js
git commit -m "feat: detect incompatible keyframe projects"
```

### Task 3: Add The Inactive Sheet Prompt Converter

**Files:**
- Create: `scripts/storyboard-sheet-to-prompt.sh`
- Create: `.opencode/tests/storyboard-sheet-to-prompt.test.js`

- [ ] **Step 1: Write failing happy-path tests**

Fixture `shot02.md` includes two characters, location/item/building, duplicate links, optional `./shot01.md`, and multiline prompt. Assert base order, path deduplication, previous sheet last, and prompt preservation.

```js
assert.deepEqual(images(result), [charA, charB, location, item, building, previous]);
assert.match(result.stdout, /\[PREVIOUS_SHOT_SHEET:\{图片6\}\]/);
assert.match(result.stdout, /first line\nsecond line$/);
```

- [ ] **Step 2: Run and verify missing converter**

Run: `node --test .opencode/tests/storyboard-sheet-to-prompt.test.js`

Expected: FAIL because the converter does not exist.

- [ ] **Step 3: Implement section parsing and output**

Extract only `引用资产`, `连续性参考`, and `图像生成提示`. Normalize links to repo paths, output characters first and remaining base links in card order, then optional previous sheet. Generate slots from final order; never persist them. Call `detect-legacy-kf.sh` first.

- [ ] **Step 4: Run happy-path tests**

Run: `node --test .opencode/tests/storyboard-sheet-to-prompt.test.js`

Expected: PASS for valid fixtures.

- [ ] **Step 5: Add failing validation tests**

Cover noncanonical name, no base asset, empty prompt, multiple/non-adjacent previous links, 11 references preserved, and no-link continuity equal to `无`. Assert prompt says to inherit only declared elements and not copy prior grid, panels, composition, or camera.

- [ ] **Step 6: Implement validation and rerun**

Derive shot numbers from canonical names. Do not test PNG existence. Propagate detector exit `2`; use exit `1` for new-schema failures.

Run: `node --test .opencode/tests/{detect-legacy-kf,storyboard-sheet-to-prompt}.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/storyboard-sheet-to-prompt.sh \
  .opencode/tests/storyboard-sheet-to-prompt.test.js
git commit -m "feat: add storyboard sheet prompt converter"
```

### Task 4: Add Inactive Sheet Planning And Prompt Review Skills

**Files:**
- Create: `skills/creator-storyboard-sheet-prompts/{SKILL.md,rules.md}`
- Create: `skills/director-review-storyboard-sheet-prompts/SKILL.md`
- Create: `skills/creator-fix-storyboard-sheet-prompt/SKILL.md`
- Create: `.opencode/tests/storyboard-sheets-contract.test.js`
- Modify: `.opencode/tests/transform-skills.test.js`
- Regenerate: `.codex/skills/`

- [ ] **Step 1: Write failing skill/schema tests**

Assert deterministic frontmatter, output/review paths, argument schema, card section/field names, dirty-list shape, review footer, and fix write boundaries. Do not mechanically score prose quality, visual beat selection, color style, or continuity meaning; the skill instructions delegate those judgments to the Creator/Director LLM roles.

Use this frontmatter matrix:

| Skill | Agent | Model | Tools |
|---|---|---|---|
| creator-storyboard-sheet-prompts | creator | sonnet | Read, Write, Edit, Glob, Grep, Bash |
| director-review-storyboard-sheet-prompts | director | opus | Read, Write, Edit, Glob, Grep, Bash |
| creator-fix-storyboard-sheet-prompt | creator | sonnet | Read, Edit, Glob, Grep |

All are `user-invocable: false` and `context: fork`.

The card template in `rules.md` must contain these literal sections/fields: `基本信息`, `所属集数`, `对应分镜`, `时长`, `类型: 分镜板`, `Panel 数量`, `引用资产`, `连续性参考`, `Panel 规划`, `PANEL 01`, `时间码`, `景别`, `机位`, `摄影机`, `画面`, `连续性`, and `图像生成提示`.

- [ ] **Step 2: Run and verify missing skills**

Run: `node --test .opencode/tests/storyboard-sheets-contract.test.js`

Expected: FAIL because three skills are absent.

Before adding them, replace the transform integration's hard-coded directory count with dynamic source `*/SKILL.md` versus output `*/SKILL.md` counting. This keeps every later commit's full suite green as skills are added/removed.

- [ ] **Step 3: Write planning skill and rules**

`full` writes every card and deletes orphan cards. `incremental <shot...>` only rewrites specified shots; numbering changes require `full`. Cards store links/naked names, never slots. Missing storyboard assets are upstream errors. Creator does not modify storyboard or generate PNGs.

- [ ] **Step 4: Write prompt review and fix skills**

Reviewer semantically checks card identity, panel timing and beats, references, adjacent continuity, board protocol, and converter slots. Mechanical tests verify only that this review stage is routed, persists round/status/owner fields, and exposes card-path dirty entries. Tag owner `generator`, `prompt-fix`, or `upstream-storyboard`. Fix edits only `Panel 规划`, `连续性参考`, and `图像生成提示`.

- [ ] **Step 5: Verify source and regenerate wrappers**

Run: `node --test .opencode/tests/{storyboard-sheets-contract,transform-skills}.test.js`

Run: `python3 .codex/build-codex-skills.py && python3 .codex/build-codex-skills.py --check`

Expected: PASS and wrappers synchronized while old pipeline remains active.

- [ ] **Step 6: Commit**

```bash
git add skills/creator-storyboard-sheet-prompts \
  skills/director-review-storyboard-sheet-prompts \
  skills/creator-fix-storyboard-sheet-prompt .opencode/tests .codex/skills
git commit -m "feat: add storyboard sheet planning loop"
```

### Task 5: Add Inactive Visual Review And Impact Skills

**Files:**
- Create: `skills/director-review-storyboard-sheets-visual/SKILL.md`
- Create: `skills/director-review-storyboard-sheet-visual-single/SKILL.md`
- Create: `skills/creator-fix-storyboard-sheet-image/SKILL.md`
- Create: `skills/director-review-storyboard-sheet-impact/SKILL.md`
- Create: `.opencode/tests/fixtures/storyboard-sheets/three-shot/*`
- Create: `.opencode/tests/storyboard-sheet-impact-flow.test.js`
- Modify: `.opencode/tests/storyboard-sheets-contract.test.js`
- Regenerate: `.codex/skills/`

- [ ] **Step 1: Write failing role and output tests**

Assert deterministic review plumbing only: aggregate dispatches one isolated reviewer per sheet, persists a review round, and writes `card|image` dirty entries; impact has read-only tools and exact JSON. Do not use word matching to determine whether a generated image should pass.

```json
{"upstream":"shot01","downstream":"shot02","status":"affected","reason":"...","fix_direction":"..."}
```

Statuses are `no_dependency`, `unaffected`, and `affected`; only affected has nonempty direction.

Use this frontmatter matrix:

| Skill | Agent | Model | Tools |
|---|---|---|---|
| director-review-storyboard-sheets-visual | director | opus | Read, Write, Edit, Glob, Grep, Bash, Task |
| director-review-storyboard-sheet-visual-single | director | opus | Read, Glob, Bash |
| creator-fix-storyboard-sheet-image | creator | sonnet | Read, Edit, Glob, Grep, Bash, Task |
| director-review-storyboard-sheet-impact | director | opus | Read, Glob, Bash |

All are non-user-invocable fork skills. The impact skill must not contain Write/Edit/Task tools. Its Bash access is limited to existing read-only scripts, checks, and temporary validation; it must not write, modify, or delete business artifacts.

- [ ] **Step 2: Write failing impact-boundary tests**

Fixture: shot02 declares a dependency on shot01; shot03 declares none on shot02. Feed predetermined reviewer statuses into the harness. Do not mechanically infer `affected` from clothing, pose, lighting, labels, or other natural-language descriptions; that classification belongs to the Director LLM.

Add an executable pure test harness in the test file: feed fixed reviewer JSON into an orchestrator function that appends impact records and invokes fake regenerate callbacks. Verify `unaffected` stops, `affected` regenerates/enqueues shot02, regeneration failure stops, and shot03 is never touched without a declared dependency. This tests state transitions without asking an LLM to judge images.

- [ ] **Step 3: Run and verify missing skills**

Run: `node --test .opencode/tests/storyboard-sheets-contract.test.js`

Expected: FAIL because four skills are absent.

- [ ] **Step 4: Implement review, fix, and impact contracts**

Aggregate at most five parallel single reviews, retry once, persist dirty/unknown plus unique footer, and read the prior dirty/unknown union after round one. Deduplicate that retry scope by card path. Only M=0 and K=0 is terminal; an unknown-only `pass K_unknown` round must retry its unknown scope on the next default call. Whole-sheet fix edits panel/prompt, deletes PNG, calls targeted generation, and returns only successful regenerated shots. Impact reads only new upstream plus direct downstream card/PNG and never writes.

- [ ] **Step 5: Define the affected handoff exactly**

The orchestrator converts affected JSON to this entry before calling image fix:

```text
assets/storyboard-sheets/ep01/shot02.md|assets/images/storyboard-sheets/ep01/shot02.png|impact|<fix_direction>
```

Append under `### 连续性影响评估` and add the card/image to `### dirty list`. Call `creator-fix-storyboard-sheet-image <ep> <review-path> shot02`. If regeneration fails, stop that branch and record failure; if it succeeds, enqueue shot02. `unaffected/no_dependency` are appended with reason but never dirty.

- [ ] **Step 6: Verify and regenerate wrappers**

Run: `node --test .opencode/tests/{storyboard-sheets-contract,storyboard-sheet-impact-flow}.test.js`

Run: `python3 .codex/build-codex-skills.py && python3 .codex/build-codex-skills.py --check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add skills/director-review-storyboard-sheets-visual \
  skills/director-review-storyboard-sheet-visual-single \
  skills/creator-fix-storyboard-sheet-image \
  skills/director-review-storyboard-sheet-impact .opencode/tests .codex/skills
git commit -m "feat: add sheet visual and impact reviews"
```

### Task 6: Add An Inactive Sheet Generation Harness

**Files:**
- Create: `scripts/generate-storyboard-sheets-dreamina.sh`
- Create: `.opencode/tests/storyboard-sheet-generation-flow.test.js`
- Modify: `.opencode/tests/storyboard-sheets-contract.test.js`

- [ ] **Step 1: Write failing static routing tests**

Require the coordinator itself to use fixed `16:9` semantics, preserve full references, and numeric-sort cards. Provider-to-coordinator routing is tested only in Task 7. Existing router skills remain untouched here.

- [ ] **Step 2: Write failing fake-provider flow tests**

Use three cards and fake wrappers that record calls/create selected PNGs. Cases: all succeed; shot01 failure stops later shots; missing shot02 base PNG blocks later shots; over 10 references remain; PENDING stops after shot01; creating shot01 PNG then rerunning skips it and starts shot02; unresolved pending never starts shot02.

```js
assert.deepEqual(callOrder(), ['shot01', 'shot02', 'shot03']);
assert.equal(existedWhenCalled('shot02', shot01Png), true);
assert.deepEqual(callOrderAfterFailure(), ['shot01']);
```

The test invokes the coordinator with fake wrappers; it does not invoke an LLM or paid service. Task 7 connects the provider skill.

- [ ] **Step 3: Run and verify old router fails**

Run: `node --test .opencode/tests/{storyboard-sheets-contract,storyboard-sheet-generation-flow}.test.js`

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 4: Implement coordinator serial behavior**

Implement `generate-storyboard-sheets-dreamina.sh <resolution> <model> <card...>`: numeric-sort canonical cards, run converter, verify references, derive output, and call the image wrapper with `16:9`. Continue only after exit 0 and output exists. FAIL exits 1. PENDING prints `PENDING <id> <card> <output>` and exits 2. Existing outputs skip on rerun. Do not modify router skills.

- [ ] **Step 5: Verify and commit**

Run: `node --test .opencode/tests/{storyboard-sheets-contract,storyboard-sheet-generation-flow,storyboard-sheet-to-prompt,image-gen-dreamina}.test.js`

Expected: PASS.

```bash
git add scripts/generate-storyboard-sheets-dreamina.sh .opencode/tests
git commit -m "feat: add serial storyboard sheet generation"
```

### Task 7: Atomic Runtime Cutover

**Files:**
- Rewrite: `scripts/storyboard-to-prompt.sh`, `scripts/check-episode.sh`
- Delete: `scripts/{parse-storyboard-kf,keyframe-to-prompt}.sh`
- Delete: `skills/creator-keyframe-prompts/`
- Delete: `.opencode/tests/storyboard-kf-parsing.test.js`
- Modify: `agents/{storyboarder,creator,director}.md`
- Modify: `skills/storyboarder-storyboard/{SKILL.md,rules.md}`
- Modify: `skills/storyboarder-fix-storyboard/SKILL.md`
- Modify: `skills/director-review-storyboard/SKILL.md`
- Modify: `skills/_meta/rules/{output-language,visual-prompt-craft-common,review-meta-rules}.md`
- Modify: `skills/generate-episode-pipeline/{SKILL.md,new-series.md,continue-series.md,short.md}`
- Modify: `skills/director-review-asset-prompts/SKILL.md`
- Modify: `skills/director-review-asset-prompt-single/SKILL.md`
- Modify: `skills/director-review-assets-visual/SKILL.md`
- Modify: `skills/director-review-asset-visual-single/SKILL.md`
- Modify: `skills/creator-fix-asset-image/SKILL.md`
- Modify: `skills/creator-generate-images/SKILL.md`
- Modify: `skills/creator-image-dreamina/SKILL.md`
- Modify: `skills/{generate-video,creator-video-dreamina,check-video,auto-video}/SKILL.md`
- Modify: `.opencode/skill-overrides/auto-video/SKILL.md`
- Modify: `skills/edit-story/{SKILL.md,series.md,short.md}`
- Modify: `skills/repair-story/{SKILL.md,series.md,short.md}`
- Modify: `skills/series-video/SKILL.md`
- Modify: `skills/director-review-script/SKILL.md`
- Modify: `skills/creator-{create-assets,fix-asset}/SKILL.md`
- Modify: `skills/{series-video,short-video}/config-template.md`
- Modify: `.opencode/lib/{load-agents,tool-mapping,bootstrap,cache}.js`
- Modify: `.opencode/tests/{transform-skills,cache,load-agents,asset-section-naming,bootstrap}.test.js`
- Modify: `README.md`, `.opencode/README.md`
- Create: cutover contract/integrity/video tests below.
- Regenerate: `.codex/skills/`

Do every step below before committing. The worktree may be red during this task; its final state must be fully green.

- [ ] **Step 1: Write all failing cutover tests before production edits**

Create/replace:

- `storyboard-to-prompt.test.js`: sheet first, assets after, prose intact, reading instruction, strict errors.
- `video-input-contract.test.js`: `### shot N` selection, converter CSV source, order stable across all submissions.
- `check-episode-storyboard-sheets.test.js`: exact shot/card/PNG sets, malformed sets, none skipped, legacy exit 2.
- `no-legacy-storyboard-contract.test.js`: check removed file/path identifiers and active skill references only; do not ban generic historical prose by broad natural-language matching.
- Extend `storyboard-sheets-contract.test.js`: pipelines, roles, generic review separation, edit/repair order, impact queue.

All paths are under `.opencode/tests/`.

Integrity cases must assert exact status details for `S=1,3`, `S=1,2,2,3`, `S=1,3,2`, missing card/image 2, orphan card/image 4, `shot2.md`, and `shot02.md` declaring shot 3. Image model `none` outputs `storyboard-sheet-images:skipped`. Legacy input propagates the detector's actionable exit 2.

- [ ] **Step 2: Run cutover tests and capture expected failures**

Run:

```bash
node --test .opencode/tests/{storyboard-to-prompt,video-input-contract,check-episode-storyboard-sheets,no-legacy-storyboard-contract,storyboard-sheets-contract}.test.js
```

Expected: FAIL on old runtime seams; inactive foundation tests remain PASS.

- [ ] **Step 3: Cut over storyboard and agents**

Keep seven shot fields; `引用资产` contains location/item/building only. Remove KF markers. Require action end-state, screen direction, and spatial state. Storyboarder never plans panels; Creator owns cards/images; Director owns three gates. Fix returns changed/added/deleted/renumbered shot sets.

- [ ] **Step 4: Cut over all three episode pipelines**

Use exact subchain:

```text
storyboarder-storyboard → director-review-storyboard
→ creator-storyboard-sheet-prompts → director-review-storyboard-sheet-prompts
→ creator-generate-images storyboard-sheets
→ director-review-storyboard-sheets-visual
```

Image model `none` still runs card/prompt review. Visual fix uses Task 5 handoff; maximum two rounds. Initial generation skips impact because downstream uses current upstream.

For sheet Prompt review owner handling: `generator` reruns card generation then review; `prompt-fix` runs prompt fix then review; `upstream-storyboard` runs storyboard fix/review, regenerates affected cards, then sheet Prompt review. Maintain one shared `fix_attempts` count; after two unsuccessful fixes, print remaining issues and continue using existing cards, matching current soft-gate behavior.

Connect image routing only now: add `basic`, `storyboard-sheets`, and `paths` scopes; Dreamina sheet scope calls the Task 6 coordinator, polls a returned pending ID to terminal success/failure, moves output, then reruns coordinator from the first missing PNG. Remove orphan sheet PNGs without cards.

- [ ] **Step 5: Cut over video conversion and tasks**

Rewrite converter to stable protocol. Generate-video enumerates exact `### shot N`, validates unique/selected shots and every image, and stores CSV unchanged. Creator and auto retry pass it unchanged; interactive correction reconverts prompt/images/duration. Submitted/done remain protected. All call the legacy detector.

- [ ] **Step 6: Cut over integrity, edit, and repair**

Checker calls detector, then compares ordered unique shots `S`, canonical cards `M`, and PNGs `P`: enabled `S=M=P`, none `S=M`. Report missing, duplicate, out-of-order, noncanonical, metadata mismatch, and orphans. Resolve helpers via `SCRIPT_DIR`.

Edit rebuilds changed/direct-reference sheets, then reviews dependents outside the dirty batch. Repair order is outline → novel/script → base card/image → storyboard/review → card/prompt review → PNG/visual review.

When image model is `none`, edit and repair still create/review sheet cards, treat `storyboard-sheet-images:skipped` as successful, skip sheet PNG generation, visual review, and impact review, and report each skipped stage with the configuration reason.

- [ ] **Step 7: Remove old runtime and separate generic reviews**

Delete old scripts/skill/test. Generic asset reviews become basic-only. Remove active references to deleted files/skills from shared rules, auto-video, agent injection, config templates, README files, and OpenCode docs. Remove `单镜头资产上限`. The no-legacy test checks deterministic identifiers, not every occurrence of words such as “关键帧”. Correct bootstrap to nohup plus OpenCode HTTP prompting.

- [ ] **Step 8: Fix OpenCode cache/discovery while source set changes**

Make transform tests count `*/SKILL.md`, not directories. Include `.opencode/skill-overrides` and `.opencode/lib` in source hash and test both. Update cache/script/asset-section assertions. This occurs before expecting transform tests green.

- [ ] **Step 9: Regenerate wrappers and run cutover tests**

Run: `python3 .codex/build-codex-skills.py`

Run:

```bash
node --test .opencode/tests/{detect-legacy-kf,storyboard-sheet-to-prompt,storyboard-to-prompt,video-input-contract,check-episode-storyboard-sheets,no-legacy-storyboard-contract,storyboard-sheets-contract,storyboard-sheet-generation-flow,transform-skills,cache}.test.js
```

Expected: PASS. Fix failures and rerun this full set. Do not commit yet.

- [ ] **Step 10: Run complete verification and commit atomically**

Run: `npm test`

Run: `python3 .codex/build-codex-skills.py --check`

Expected: zero failures and synchronized wrappers. Inspect `git status --short` and `git diff --check`. Exclude media, cache, `.superpowers`, and `package-lock.json`.

```bash
git add -A agents skills scripts .opencode .codex README.md
git commit -m "refactor: replace keyframes with storyboard sheets"
```

### Task 8: Runtime Smoke Test And Final Review

**Files:**
- Modify only files directly implicated by verification.

- [ ] **Step 1: Re-run automated evidence**

Run: `npm test`

Run: `python3 .codex/build-codex-skills.py --check`

Run: `git diff --check 3734c7b..HEAD`

Expected: all green.

- [ ] **Step 2: Run OpenCode discovery if available**

```bash
opencode agent list
opencode debug skill
```

Expected: five agents, seven entry workflows, new sheet skills discoverable, and no old keyframe skill. If unavailable, record the testing gap.

- [ ] **Step 3: Inspect branch contents**

```bash
git status --short
git diff --stat 3734c7b..HEAD
git log --oneline --decorate 3734c7b..HEAD
```

Expected: intended source/tests/docs/wrappers only; no package lock, media, caches, or brainstorming files.

- [ ] **Step 4: Commit verification fixes only if needed**

Inspect `git diff -- <each changed path>`, stage each verified path with `git add <path>`, then commit:

```bash
git commit -m "test: verify storyboard sheet migration"
```

If no files changed, do not create a commit.

## Completion Checklist

- [ ] Every shot has one canonical card and, when enabled, one PNG.
- [ ] Sheet generation uses all current assets plus optional adjacent previous sheet.
- [ ] Video input is sheet-first and identical across initial and retry submission.
- [ ] Prompt, visual, and impact reviews have separate ownership and persisted outputs.
- [ ] Impact stops on `no_dependency`/`unaffected`; affected handoff is actionable and tested.
- [ ] Repair orders storyboard before card before PNG.
- [ ] Runtime prompts/wrappers contain no old KF execution contract.
- [ ] Full tests and Codex sync checks have fresh passing evidence.
