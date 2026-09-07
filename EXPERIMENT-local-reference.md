# Local Reference Experiment

## Current Outcome

The real shot15 request was submitted to Dreamina with ID `05945b88-03e4-4d47-93c5-2c5ab0abf599`, using seedance2.5, 16:9, 720p, 12 seconds, six asset PNGs and the BOX POV MP4. The user reports viewing the completed video and finding the result very good. This is user feedback, not an assistant-run final-video review or a claim that the local task has been downloaded/marked done.

The resulting product direction is asset images plus a local camera/layout/trajectory MP4 for every newly prepared shot. Sheet generation, sheet creative skills and sheet gates have been removed. Existing recorded provider IDs and image receipts retain retrieval/settlement support; new paid preparation follows the current MP4 contract. Existing story materials and submitted snapshots are preserved.

Cross-shot continuity is assessed semantically on relevant boundary pairs in the existing shot-input review. Actual compared neighboring manifests/media/sources enter the result's input fingerprints. This detects changes to recorded dependencies; it does not automatically discover or certify all continuity links or regenerate downstream work.

Validation after retirement: 450 tests passed, zero failed/skipped; 36 Codex wrappers synchronized. Scoped checking supports isolated shot15 while validating unique ordered headings; whole-episode checking retains contiguous numbering. The sections below document earlier experiment stages, not current production requirements.

## Scope And Ownership

- Baseline: `95dcceb` (`refactor: adopt role-led creation and reliable media generation`).
- Worktree: `/home/huangz/repos/ShortVideoDirector-local-reference`, branch `experiment/local-reference-studio`.
- Explore editable local 2D/2.5D, Blender stills and motion previews as optional asset/sheet references. The main/general engineering agent owns SVD development architecture, test design/management and test-environment orchestration. Director may coordinate scoped actual creative production and independently review art, not manage repository development or the experiment.
- Knowledge-first: Creator chooses tools, writes arbitrary task-specific scripts, renders, inspects and revises. No fixed geometry DSL, mandatory template or new local production runner. Creative scripts and editable inputs belong in the story project's `references/`.
- Thin helpers handle declaration/path readiness, ordered reference forwarding and existing evidence/state contracts. Provider wrappers and pending/receipt safeguards remain in force; they do not make artistic decisions or prove visual quality.
- This update changes docs/agents/skills/READMEs and this note, plus authorized generator-produced Codex wrappers. Pre-existing scripts/tests remain untouched. No creative-project edits, image viewing, secret/account reads, paid generation or commit. `docs/` is ignored; this root note is the durable record.

## Latest Decision: Box-Level Local Video

The user's latest decision supersedes the prior r3 limb/contact/pose/regrip checks and stops that limb-animation effort. Local VIDEO defaults to camera/shot design, positioning/layout and object motion trajectories. People and similar actors are rigid, static-shape BOX proxies: static means no deformation/performance, while whole-box translation/rotation remains valid trajectory guidance. No pose, limbs, fingers, face or texture identity is to be built unless an explicit different commission changes scope.

Concrete action, posture and expression are entirely prompt/model responsibilities. Close-ups emphasizing twisting/regrip remain camera language compatible with boxes. Review boxes only for framing, scale, positions, whole-object trajectories and camera controls; missing hands or anatomical occlusion/contact proof is not failure. Check text action clarity and final-shot framing readability separately. Missing declared media, fingerprints, independent gates and unknown for unassessable necessary declared trajectories remain intact.

Keep useful environment/prop geometry for camera/layout. Do not apply actor boxes to static asset shape references; valve stills remain useful. The B-style detailed positive appearance approach, one unified work-level art baseline and actual assets remain unchanged.

This is a documentation-only engineering update in this worktree. No creative files, images, generation, rigs, DSL, registry, parser, prose-matching tests or commits were made. No box video has been produced or inspected by this update, and it does not claim one already exists or replace historical review records with a pass. Earlier experiment results below remain historical, not acceptance of this new scope.

Validation for this documentation-only decision: `git diff --check` passed; `python3 .codex/build-codex-skills.py --check` passed with all 43 wrappers synchronized. No wrapper regeneration or test-suite run was needed; historical test counts below are not a new run or semantic/visual acceptance of box video.

## Actual Results

### Sheetless POV BOX Input Ready

The isolated project `/home/huangz/repos/LLMVid/Story1-local-reference-clean-e2e` now has a 12-second shot15 package with six current asset PNGs and one MP4, no sheet entry. Its active reference is `references/shot15-box-r2/preview-12s.mp4` (640x360, 20fps, 240 frames). Characters are rigid BOX proxies without limbs or identity textures; the operating section uses the operator's POV. Detailed actions and unified appearance are supplied by the full prompt and actual identity assets.

An independent fresh input review inspected helper thumbnails and ten selected video times. It accepted the declared camera/layout/trajectory scope, not unsampled interpolation, anatomical action or final-video quality. `.review-shot-inputs.md` round 2 records 53 unchanged input hashes, including all 43 mechanically required paths. The corrected opening camera separates the stationary BOX from both valves.

Actual scoped command `SVD_CONFIG=config.md node scripts/review-evidence.mjs check ep01 15` (using this worktree's absolute script path from the story project) exits 0. Empty selected-sheet target sets report `ok`; this does not approve the earlier failed sheet image. The actual resolver returns `sheetCards:[]`.

No final provider video was submitted and no video tasks/grants were created for this step. The real MP4+PNG provider submission remains untested. Creative subagents explicitly read worktree source knowledge; native hot-loaded skill discovery in the existing session remains unverified.

Prior experiment results supplied for this review: two fresh exploration images and agent-authored `bpy` stills. These are limited exploration/render results, NOT a full local-reference E2E run or independent production acceptance. They were not regenerated or re-reviewed here; creative-project files were left alone.

### Blockout-Only Style Comparison

The later valve experiment uses only `references/local/correct-valve-input.png` as its uploaded reference, not generated identity/style images. Results live in `/home/huangz/repos/LLMVid/Story1-local-reference-clean-e2e/references/style-valve/`. Both prompts explicitly limit the blockout to topology, proportions, marker placement and camera angle; appearance is supplied by text. Both use Dreamina 5.0Pro, 16:9, 2k.

- A ID: `b8e9ee01-3ab5-432e-a49f-a771f555805d`.
- B ID: `554b24b8-fccf-4d4a-b2d9-253e48ff2b85`.
- Both downloaded with done receipts, no retry. A fresh Creator task compared only helper-generated 1024x576 previews of the source and pair; its full observations and hashes are in `comparison.md`.
- Both improve smoothness, surface texture and volume lighting over the blockout. A better preserves composition/proportions in this sample; B has stronger visible wear but a larger, narrower projected wheel. More detailed style prose is not automatically better. One sample per prompt does not isolate random variation or prove causality.

This is an image-refinement experiment, not accepted final video. The shared craft rules now require explicit structural/motion versus appearance authority in BOTH image and video prompts using blockouts.

User decision after this comparison: stop further style A/B generation and adopt B-like detailed positive appearance descriptions. This selects the prompting approach, not B's output as an approved asset or its composition drift. All assets and shots within a work must share one art-direction baseline; subject-specific detail must preserve that style and existing identities/structure. No further generation was performed for this rule update.

## Prior Host Evidence

Earlier notes record 2026-09-07 `command -v blender` / `blender --version`: `/home/huangz/.local/bin/blender`, 4.5.13 LTS, build `daeeeca98fb0`, and a prior cube smoke inspection at `/tmp/opencode/blender-render-qXxMzH75/cpu-smoke.png`. This update does not repeat those commands or open that image. Historical smoke evidence is not artistic acceptance or current E2E validation.

The inspectable checksum manifest is `/tmp/opencode/blender-install-OP0ffsgq/blender-4.5.13.sha256`. Running `sha256sum /tmp/opencode/blender-install-OP0ffsgq/blender-4.5.13-linux-x64.tar.xz` matched its Linux archive entry:

```text
da4e69b06b75b9e642d106496c50e7e240218b411d2f6e18271c1d1d819cef91
```

This checks the retained archive against the local manifest, not independent manifest authenticity or every installed file. Temporary evidence paths may expire; reusable skills use `blender` and discover its version instead of embedding these host details.

## Mechanical Checks

Run from this worktree:

```bash
TMPDIR=/tmp/opencode node --test \
  .opencode/tests/transform-skills.test.js \
  .opencode/tests/load-agents.test.js \
  .opencode/tests/commands-derive.test.js \
  .opencode/tests/local-reference.test.js
python3 .codex/build-codex-skills.py --check
git diff --check
```

Prior run: 67 tests and 42 wrapper checks passed. Current run below supersedes these mechanical counts; neither establishes live creative orchestration or visual quality.

## Live-Host Limit

The current session advertises the older plugin/cache rooted at the sibling `ShortVideoDirector` checkout and does not expose `creator-local-reference` as a loadable skill. Source edits and passing transform tests do not hot-reload that session or establish live subagent/review isolation.

Quit and restart OpenCode with the plugin installation pointing to this experimental worktree, then verify the actual loaded root/cache and both the new skill and `tools.md`. This review did not change host configuration or reload it. A fresh scoped exercise still needs actual tool use, inspected outputs, revisions where needed, card/reference integration and independent art-review evidence before claiming E2E success; the main/general engineering agent owns that test orchestration.

## Current v1 Contract Update

Read actual shot-inputs, converters, video-task-inputs, video wrapper, review-evidence and check-storyboard-sheets code. Docs describe exact `{version:1,references:[...]}` manifests, header identity refs first, explicit local PNG/MP4 and optional current sheet after them. Converter uses `--json`; wrapper uses `--references-json`. Capture returns four settings plus `input_version:1,references:[{media,path,sha256}]`; sources bind evidence, not uploads.

Sheets are optional STATIC key visual nodes, not dense continuous-motion proof. Existing panel/time-marker schema stays without prose-only contiguous full-duration requirements. Requested shot15 no-sheet is documented, NOT applied to creative files. Creator gets explicit assembly knowledge, not a pipeline. New independent director-review-shot-inputs reviews final prompt/media semantics and necessary temporal evidence in fresh contexts with mandatory thumbnails/crops. GIF is rejected/temporally unknown; still endpoints cannot prove motion.

Current validation:

```bash
TMPDIR=/tmp/opencode node --test .opencode/tests/transform-skills.test.js .opencode/tests/load-agents.test.js .opencode/tests/commands-derive.test.js .opencode/tests/local-reference.test.js .opencode/tests/shot-inputs.test.js .opencode/tests/review-evidence.test.js .opencode/tests/storyboard-sheet-to-prompt.test.js .opencode/tests/storyboard-sheet-generation-flow.test.js
python3 .codex/build-codex-skills.py
python3 .codex/build-codex-skills.py --check
git diff --check
```

141 tests passed, zero failed. Generator produced 43 wrappers; `--check` confirms all 43 synchronized and `git diff --check` passes. Tests use fixtures/provider stubs, not live generation or independent art judgment. No full creative E2E claim.

## Remaining Code Boundaries

- No-manifest and explicit `--legacy` paths still require sheets/asset-prompt and can execute persisted CSV tasks even after a manifest appears. Code does not mechanically prove a CSV record is historical. Docs restrict new preparation to v1; enforcing that distinction requires code, not prompt wording.
- V1 drops asset-prompt from final readiness after actual asset-visual acceptance; selected sheets still require BOTH sheet-prompt and sheet-visual. Removing stale selected-sheet prompt requirements after visual acceptance would need an explicit code change, not a reviewer waiver.
- `reconcile-storyboard-sheet-images.sh` only pairs disk cards/PNGs, ignores manifests and deletes unpaired PNGs without pending-aware selection. Docs prohibit treating it as the new selected-sheet generator/cleanup list. Making it manifest/pending-aware requires code.
- Media helpers validate suffix/path/nonempty bytes and fingerprints, not PNG/MP4 decoding, continuous playback, source completeness or semantic temporal sufficiency. No enforced fresh-task/thumbnail guard exists; those remain mandatory agent rules. Missing required viewing stays unknown.
- `storyboard-sheet-to-prompt.mjs` still requires at least one base asset, resolved image settings and only adjacent N-1 previous-sheet links. Optional sheets do not enable arbitrary earlier-sheet inheritance or schema-free static cards. No code changes were made here.
