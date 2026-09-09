---
name: creator-local-reference
description: Use when Creator needs editable asset stills for shape, layout, topology, multiview or UI control, or groups designed photographic shots into BOX references and typed generation-task inputs.
user-invocable: false
agent: creator
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Skill
model: sonnet
---

# Local Reference Craft

This is tool knowledge for Creator, not a new entry workflow, production script or mandatory stage. Read the commissioned outcome, current script/shot, relevant cards, actual configuration and constraints. Choose methods by what must become understandable; no fixed geometry DSL, scene schema, mandatory template or prescribed skill chain.

Creator owns local visual design, editable scenes, drawings, renders and previews. Storyboarder still owns shots, camera/action intent and timing; Scriptwriter owns script and inventory; Director coordinates cross-owner changes and independent acceptance. A render revealing an impossible action is evidence for that owner, not authority to rewrite the shot. Preserve existing visual identity and untouched project materials.

## Choose The Medium

- Still or 2D drawing: silhouette, color grouping, typography, a layout or one decisive pose.
- 2.5D: layered artwork with limited depth/parallax when full geometry adds no useful evidence.
- 3D stills: topology, scale, occlusion, lighting or multiple views of one space.
- Local video: camera/shot design, positioning/layout and whole-object trajectories with their timing, not actor performance.

Use the least elaborate medium that communicates the actual need, not automatically the cheapest or most complex. Asset previsuals are optional: use a controlled local guide when exact geometry/topology, UI layout or consistent multiple views need spatial evidence that prose or existing references cannot adequately supply. Text2image is suitable for identity roots without required references when appearance can be established through the prompt. Match user-fixed style and settings; local work does not silently replace a selected provider or its required production outputs.

Local VIDEO defaults to rigid, static-shape BOX proxies for people and similar actors. Static means no deformation or performance; each box may translate/rotate as a whole to convey trajectory. Do not build poses, limbs, fingers, faces or texture identity. Only an explicit different commission changes this scope, not action complexity or a reviewer's request for contact proof. Concrete action, posture and expression belong entirely in the actual prompt for the model to realize.

Retain environment/prop geometry useful for camera/layout. Static asset shape references control silhouette, topology and proportions within their declared purpose, not every incidental detail. Asset images primarily convey identity/appearance, style, image quality and materials; video may supply perspective, spatial occlusion, camera, layout and whole-object motion without requiring stills to duplicate it. Preserve plot-critical features/actions and explicit requirements; revise actual identity/quality or control conflicts, not harmless fine-detail differences. Base asset gates do not require future video or claim unviewed video as evidence. Final shot-input review checks the actual integration. Describe appearance through the work-level art baseline and actual asset identities; boxes supply only declared spatial and motion controls.

## Direct Tool Work

Before every image read or operation, follow [visual context and preview rules](../_meta/rules/visual-context.md): a fresh task, minimal necessary images, thumbnail-first, and text/file handoff rather than resuming an image-heavy task. This includes rendering, author inspection and each revision. Delegate directly when supported; after unavailable Task or confirmed depth rejection, reuse that finding and request top-level Director/main relay, returning actual results to the original specialist or review coordinator. Never Read an original image directly.

Consult [Blender, 2D and FFmpeg knowledge](tools.md) as needed. Write arbitrary task-specific `bpy` or other drawing scripts in the STORY PROJECT's `references/`, not the plugin repository. Keep editable `.blend`, scripts, layered/vector originals and actual texture/font/import inputs needed to reproduce or modify the result. Inspect existing scripts before executing them. Use small manual Write/Edit/apply_patch operations (at most 2000 characters each); rendered binaries come from the tools.

Render, inspect the PNG through the shared preview procedure in a fresh task, and hand off findings for any needed edit/render or further inspection in new tasks. A successful process exit is not visual success. For local video, check only framing, scale, positioning/layout, whole-object trajectories and camera controls. Missing hands, anatomical occlusion, contact or regrip proof is not failure. Static shape references retain their own commissioned geometry checks. Retain editable sources; do not impose a universal scene recipe or iteration count.

Explain which details are controlled (for example door adjacency and camera height) and which are placeholders (for example unmodeled faces or neutral block materials). Say how each reference should influence the final image; a blockout is not an approved character redesign. For card integration use the optional [local reference contract](../_meta/rules/local-reference.md).

## Grouped Task References

Read [shot-inputs.md](../_meta/rules/shot-inputs.md). After shot design, group consecutive photographic shots without changing durations, dialogue or cuts. Verify actual model maximum M and aim for task duration `ceil(0.7*M)..M`, a semantic packing target, not a mechanical lower quota. Validate actual provider task limits; unsuitable grouping returns to owners, never stretches shots or scene/episode budgets.

Write `story/episodes/{ep}/task-inputs/taskNN.json` with exactly `{shots,references}`. Filename-derived task_id is stable independently of first member. Members are ordered positive safe integers consecutive in source order. Derive timing from storyboard; keep no editable duration/offset fields or duplicate grouping index. Each task needs a full-group MP4, optional PNGs, actual editable sources and explicit use/placeholder limits. GIF is unsupported.

Use one coherent task reference clock for all member intervals, internal cuts, positions, trajectories and sound bridges. Static intervals may use static clips. Header identity assets form a first-use union before local media; sources do not upload. Both converter CLIs use `--json STORYBOARD TASK_ID EP`. Inspect task_id/shots/timeline and the actual package, and report continuity dependencies for fresh independent Reviewer acceptance. Partial selected-shot scope reports full membership and additional members rather than silently expanding authority. Assembly does not authorize tasks.json preparation or submission.

## Authority And Delivery

Reference `use` describes controls and placeholder limits. Supply the exact common single-line `视频风格` baseline to Storyboarder; converter emits it once at task level and removes only that parsed field from member blocks. Reconcile differing baselines with owners. Preserve source prose, dialogue, spaces and continuation lines. Only leading bracket cues rebase to task time; inline elapsed times explicitly remain local to each named shot. Group media and sound bridging follow those derived intervals. Asset prompts retain target appearance and actual bindings; internal handoff notes alone do not reach the model.

For engineering, main delegates repository code, host configuration and tests to engineering agents. In production, main is Director; Creator owns commissioned visual materials and fresh independent Reviewer contexts accept them.

An adequate production commission covers needed local reference work and same-scope revisions without extra permission handshakes. Diagnosis alone remains read-only; preserve explicit checkpoints, overwrite scope and limits. Installation/system changes require actual authority, never implied by Bash access. Reuse explicit installation authority already given for the current work; do not generalize it to future commissions.

Local animation/FFmpeg MP4 is reference media, NOT paid final video. Keep it under `references/`, separate from final `videos/taskNN.mp4` and task completion. Select it as a typed video reference in the task manifest, not card `images`. Assembly does not authorize submission or tasks.json preparation.

Return exact task IDs/membership, paths, uses, controls/placeholders, inspected outputs, sources, limits and affected reviews. Card integration keeps asset evidence; final task packages, internal cuts/sound bridges and relevant external boundaries require independent shot-input review with actual dependency fingerprints. Author self-inspection never issues pass. Missing independent context blocks acceptance.
