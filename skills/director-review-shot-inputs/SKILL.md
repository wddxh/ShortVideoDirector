---
name: director-review-shot-inputs
description: Use when final per-shot manifest input packages need independent semantic and temporal review before video preparation or after scoped changes.
user-invocable: false
agent: director
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, Skill
model: opus
---

# Review Shot Inputs

Read [review evidence rules](../_meta/rules/review-meta-rules.md), [input contract](../_meta/rules/shot-inputs.md), [visual context rules](../_meta/rules/visual-context.md) and [output language](../_meta/rules/output-language.md). Review actual prompt/media integration, necessary boundaries and changed details. Use current storyboard judgment for established narrative/camera decisions unless a concrete input conflict requires reopening them. This is not generated-video review or authority to prepare, submit or fix materials.

Require a fresh independent Director task, never a resumed producer/fixer or favorable summaries alone. Commission exact ep/manifest targets, canonical config_path, script/storyboard, references, constraints and a designated `/tmp/opencode/...` preview directory. Without explicit scope derive manifests for actual shots. Every shot requires local MP4; missing necessary inputs remain unknown.

Every image read/operation requires fresh context, minimum necessary comparison set and helper thumbnails; NEVER Read original images. Further crops, sampling or inspections use new tasks with text/path/hash handoff. Ask main for relay if nesting is unavailable; unavailable independent context or required viewing remains unknown. A singleton writes its assigned round directly. Use an independent text aggregator only for actually separate reviewer results; production cannot invent pass.

## Evidence And Inspection

Only write the commissioned `story/episodes/{ep}/.review-shot-inputs.md` round. The coordinator serializes writes to that file. A delegate commissioned only for a partial inspection returns its raw result to the independent record owner. Temporary helper previews/crops/sampled frames in the designated directory are the sole extra write exception. No production files, grants, receipts or task records may change.

Start a new `## 第 N 轮 ...` with scope and an unfinished evidence block before reading. Use kind=`shot-input`, target=canonical manifest path. Run with the actual SVD_CONFIG:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" fingerprint PATH...
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" required shot-input "{manifest}"
bash "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-to-prompt.sh" --json "{storyboard}" "{shot}"
```

Fingerprint known inputs before reading/resolving; add discovered dependencies before inspection, then verify ALL original-byte fingerprints at completion. `required` resolves dependencies, not semantic acceptance. Include manifest/config/script/storyboard, uploaded originals, sources, asset-visual dependencies and necessary continuity references. Inspect actual editable sources and needed project inputs; helper success does not prove completeness.

Compare final prompt + ordered typed references against the current reviewed shot and user intent. Check slot/use correspondence, identity vs layout/motion control, placeholder leakage, legibility and material continuity. Sources are not uploaded: necessary controls must be in prompt/media, not only source code or reviewer knowledge. Manifest entries are local PNG/MP4 with at least one MP4 per shot; static camera/layout may use a static clip.

## Temporal Judgment

Use [camera-language knowledge](../storyboarder-storyboard/camera-language.md) to assess viewpoint ownership, eyeline, action continuity and motivated camera movement. POV is not necessarily handheld, wide-angle or shaky; an external close-up is not automatically a character's eyes. Local BOX previews need appropriate camera/layout/trajectory, not rendered hands or facial performance. Review the intended view and action prompt together, without imposing third-person coverage.

Local VIDEO defaults to rigid, static-shape BOX proxies for people/similar actors. Static means no deformation/performance; whole-box translation/rotation may convey trajectory. Only an explicit different commission changes scope. Review boxes only for declared framing, scale, position/layout, whole-object trajectories and camera controls, not pose, limbs, fingers, faces or texture identity. Missing hands or anatomical occlusion/contact/regrip proof is not failure. Useful environment/prop geometry is allowed; static asset shape references such as valve stills retain their own geometry scope.

Check that the work-wide art baseline appears once in source `视频风格`, with detailed action, expression and sound in audiovisual prose. Reference `use` states controls and placeholder limits. The converter binds references and includes the full shot, without style injection or deduplication. Check readable framing and asset identities. Close-ups are compatible with boxes; identify text/framing/trajectory conflicts rather than missing proxy anatomy.

For MP4 controls inspect framing, scale, positions, whole-object trajectories, camera path and relevant timing in fresh delegated contexts. Record actual playback/sampling method, original media hash, sample times/frame mapping and temporal coverage/limits. Sample images go through review-image.py; read only returned previews, with necessary detail crops in new contexts. Use the minimum necessary comparison set.

Select required boundary scope from the actual story and shot dependencies, including adjacent, nonadjacent and cross-episode pairs when relevant. Compare both final prompts and MP4 boundary evidence for positions, trajectories, key states, axis and identity. Minimal-pair visual tasks return raw findings; fingerprint every consulted manifest, storyboard, media, source and identity reference in the affected target's existing inputs. Explain the selected scope and limits in prose. Missing necessary inputs are unknown, not an assumed continuity pass. Mechanical dependency discovery is not exhaustive continuity judgment. Changes trigger assessment of actual dependent evidence, not automatic recursive re-rendering or a new review kind/schema.

Endpoints or a few stills cannot certify interpolation or full-duration continuity; require only coverage needed to assess the declared camera/whole-object trajectory controls, not continuous performance proof. If available viewing cannot assess a necessary declared trajectory, return `unknown` naming that gap, not pass from source code, ffprobe or hashes. Missing declared media, unreadable required inputs and fingerprint/evidence gates remain blocking. Do not demand pose/contact/expression evidence assigned to prompt/model. GIF remains unsupported by the resolver. A definite relevant conflict is `needs_revision`; optional aesthetic improvements are not blockers.

For changed bookkeeping or sources with unchanged rendered media, use a scoped independent compatibility assessment: inspect the actual diff, prior reviewed basis, current prompt/refs and media fingerprints. Explain why the changed dependency preserves the judgment before issuing a new round with current inputs. Do not blindly refresh hashes or require automatic full review. Any necessary new visual operation still uses a fresh task and thumbnails.

## Result

Use shared `{kind,scope,results}` evidence, one result per scoped manifest: `{target,status,inputs,blockers}`, status=`pass|needs_revision|unknown`. Inputs retain actual `{path,sha256}` before-reading values; optional `visual_inspection` holds real preview helper JSON and prose records temporal limits.

Complete the same evidence block after checking unchanged inputs and raw delegated conclusions; append the unique `<!-- /round-N -->` footer. Preserve incomplete/older rounds and out-of-scope findings. Return review path, covered targets and boundary pairs, statuses, concrete locations/impacts and limitations. Current usable evidence ends the quality loop; pass never supplies video grants or waives script/storyboard/asset-visual gates. New images separately need asset-prompt review. Production Director coordinates scoped repairs and independent re-review.
