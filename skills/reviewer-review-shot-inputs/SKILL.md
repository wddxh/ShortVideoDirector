---
name: reviewer-review-shot-inputs
description: Use when final grouped-task manifest inputs need independent integration, internal-cut and boundary review before video preparation or after scoped changes.
user-invocable: false
agent: reviewer
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
---

# Review Shot Inputs

Read [review evidence rules](../_meta/rules/review-meta-rules.md), [input contract](../_meta/rules/shot-inputs.md), [visual context rules](../_meta/rules/visual-context.md) and [output language](../_meta/rules/output-language.md). Review actual prompt/media integration, necessary boundaries and changed details. Use current storyboard judgment for established narrative/camera decisions unless a concrete input conflict requires reopening them. This is not generated-video review or authority to prepare, submit or fix materials.

Require a fresh independent Reviewer task, never a resumed producer/fixer or favorable summaries alone. Commission exact ep/task manifest targets, canonical config_path, script/storyboard, references, constraints and a designated `/tmp/opencode/...` preview directory. Derive scope from commissioned groups; partial selected-shot scope reports full membership/additional members, not silent expansion. Each task needs a full-group local MP4; missing necessary inputs remain unknown.

Every image read/operation requires fresh context, minimum necessary comparison set and helper thumbnails; NEVER Read original images. Further crops, sampling or inspections use new tasks with text/path/hash handoff. Ask main for relay if nesting is unavailable; unavailable independent context or required viewing remains unknown for the affected target. Each target Reviewer writes its own canonical file directly, in parallel with independent ready targets; production cannot invent pass.

## Evidence And Inspection

Each target owner uses review-round to write its commissioned `reviews/{ep}/task-inputs/taskNN.md`, serializing only the same ep/kind/target. Each round has scope=[manifest] and one completed result. Create the designated `/tmp/opencode/<task>` directory before start; allow helper STATE, reviewer payload and necessary previews/crops/sampled frames only there, with no workspace duplicate ledger. No production files, grants, receipts or task records may change.

Before reading manifest/config or resolving dependencies, start with explicit actual SVD_CONFIG. Keep kind=`shot-input`, target=`story/episodes/{ep}/task-inputs/taskNN.json`; STATE/PAYLOAD.json are distinct absolute files in the designated temp directory:

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" start shot-input EP TARGET STATE [EXTRA_INPUT...]
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" add-input STATE PATH...
bash "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-to-prompt.sh" --json "{storyboard}" "{task_id}" "{ep}"
```

start captures required dependencies and known extras; use add-input before reading every new semantic reference. STATE binds config and original hashes; finish rechecks them. Include manifest/config/script/storyboard, uploaded originals, sources, asset-visual dependencies and necessary continuity references. Inspect actual editable sources and needed project inputs; discovery does not prove semantic completeness. Preserve capture/discovery errors; finish records unknown on evidence issues, retaining first hashes.

Compare final prompt + ordered references against reviewed member shots and user intent. Check unchanged membership/durations/dialogue/cuts, slot/use correspondence, declared media roles, placeholder leakage, legibility and continuity. Asset stills primarily supply identity/appearance, style, image quality and materials; video may supply perspective, spatial occlusion, camera, layout and whole-object motion. Do not demand identical still/video views or reopen harmless fine-detail differences. Detect actual conflicts affecting plot-critical features/actions, explicit requirements, identity, quality or necessary continuity; explain the observation, responsible control and concrete impact, not a generic anatomy/topology label. Sources are not uploaded; necessary controls belong in prompt/media, not reviewer knowledge. Manifest has exactly shots/references, entries local PNG/MP4, with at least one full-group MP4; static intervals may use static clips. Fingerprint actual dependencies, not a whole-plan hash on every media target.

## Temporal Judgment

When grouping affects dialogue overlap, sound bridges or audio timing, read the relevant [audiovisual craft](../_meta/rules/audiovisual-craft.md) guidance. Verify the source utterance ownership, actual voiced intervals and continuation across cuts; preserve one continuous utterance rather than repeating the full line for each view.

Use [camera-language knowledge](../storyboarder-storyboard/camera-language.md) to assess viewpoint ownership, eyeline, action continuity and motivated camera movement. POV is not necessarily handheld, wide-angle or shaky; an external close-up is not automatically a character's eyes. Local BOX previews need appropriate camera/layout/trajectory, not rendered hands or facial performance. Review the intended view and action prompt together, without imposing third-person coverage.

Local VIDEO defaults to rigid, static-shape BOX proxies for people/similar actors. Static means no deformation/performance; whole-box translation/rotation may convey trajectory. Only an explicit different commission changes scope. Review boxes only for declared framing, scale, position/layout, whole-object trajectories and camera controls, not pose, limbs, fingers, faces or texture identity. Missing hands or anatomical occlusion/contact/regrip proof is not failure. Useful environment/prop geometry is allowed; static asset shape references such as valve stills retain their own geometry scope.

Check exact identical single-line `视频风格` extraction: once at task level, only that parsed field removed from members. Different baselines return to owners. Preserve other fields, dialogue, spaces and continuation lines. Each explicit link must be declared by its own member header. Only leading structural bracket cues rebase by derived shot offsets; valid local bounds allow overlap. Prompt explicitly assigns bracket cues to task time and inline elapsed times to each named shot's local time. Check coherent media/reference clock, internal cuts and sound bridging, alongside external boundaries. Reference use states controls/placeholders; boxes need readable framing, not anatomy.

For MP4 controls inspect framing, scale, positions, whole-object trajectories, camera path and relevant timing in fresh delegated contexts. Record actual playback/sampling method, original media hash, sample times/frame mapping and temporal coverage/limits. Sample images go through review-image.py; read only returned previews, with necessary detail crops in new contexts. Use the minimum necessary comparison set.

Select boundary scope from actual story dependencies, including relevant adjacent, nonadjacent and cross-episode pairs. Compare final prompts and MP4 evidence for positions, trajectories, key states, axis and identity. Before a partial visual delegate reads, the independent target owner captures each needed manifest/storyboard/media/source/identity reference with start/add-input. Delegates return actual observations, read paths, preview evidence and limits. New reference paths return to the owner for capture before a fresh visual task reads them; no post-hoc snapshot may stand for an earlier read, and no import registry is needed. Explain scope and limits in prose. Missing necessary evidence is unknown. Discovery is not exhaustive continuity judgment; changes trigger scoped assessment, not automatic recursive re-rendering or a new kind.

Endpoints or a few stills cannot certify interpolation or full-duration continuity; require only coverage needed to assess declared camera/whole-object trajectory controls, not continuous performance proof. If available viewing cannot assess a necessary declared trajectory, return `unknown` naming that gap, not pass from source code, ffprobe or hashes. Do not claim absent/unviewed video was observed or assume it resolves a conflict. Missing declared media, unreadable required inputs and fingerprint/evidence gates remain blocking. Unseen nonessential detail alone is not unknown. Do not demand pose/contact/expression evidence assigned to prompt/model. GIF remains unsupported by the resolver. A definite relevant conflict is `needs_revision`; optional aesthetic improvements are not blockers.

For changed bookkeeping or sources with unchanged rendered media, use a scoped independent compatibility assessment: inspect the actual diff, prior reviewed basis, current prompt/refs and media fingerprints. Explain why the changed dependency preserves the judgment before issuing a new round with current inputs. Do not blindly refresh hashes or require automatic full review. Any necessary new visual operation still uses a fresh task and thumbnails.

## Result

Author designated temp PAYLOAD.json as `{commentary,result:{status,blockers,...}}`; status must explicitly be `pass|needs_revision|unknown`, blockers a string array and empty for pass. Optional result.visual_inspection holds real preview helper JSON; commentary records observations and temporal limits. Omit helper-owned target/inputs/hashes and round delimiters. Missing status is invalid, not implicit pass. Missing, malformed or incomplete evidence affects only its target.

Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-round.mjs" finish STATE PAYLOAD.json` after judging actual delegated observations. It rechecks dependencies, injects target/original inputs and validates the completed record/footer, preserving older rounds. Exit 0 means record written, not pass. Return actual path/round/status/input_count/evidence_issues, necessary boundary pairs, findings and limits. No mandatory immediate repeat fingerprint, check-target/checkTarget or full-record Read follows normal finish; use them for errors/diagnosis or later downstream gates. Usable current pass ends the quality loop, never supplies grants or waives script/storyboard/asset-visual gates. New images separately need asset-prompt review. Director coordinates repairs and independent re-review.
