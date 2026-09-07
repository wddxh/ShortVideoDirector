---
name: creator-local-reference
description: Use when Creator needs editable local stills, BOX motion references and per-shot typed input assembly.
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

Use the least elaborate medium that communicates the actual need, not automatically the cheapest or most complex. Match user-fixed style and settings; local work does not silently replace a selected provider or its required production outputs.

Local VIDEO defaults to rigid, static-shape BOX proxies for people and similar actors. Static means no deformation or performance; each box may translate/rotate as a whole to convey trajectory. Do not build poses, limbs, fingers, faces or texture identity. Only an explicit different commission changes this scope, not action complexity or a reviewer's request for contact proof. Concrete action, posture and expression belong entirely in the actual prompt for the model to realize.

Retain environment/prop geometry useful for camera/layout. Static asset shape references can control silhouette, topology and proportions. Describe final appearance through the work-level art baseline and actual asset identities; boxes supply only their declared spatial and motion controls.

## Direct Tool Work

Before every image read or operation, follow [visual context and preview rules](../_meta/rules/visual-context.md): a fresh task, minimal necessary images, thumbnail-first, and text/file handoff rather than resuming an image-heavy task. This includes rendering, author inspection and each revision; request Director/main-agent relay when Task is unavailable. Never Read an original image directly.

Consult [Blender, 2D and FFmpeg knowledge](tools.md) as needed. Write arbitrary task-specific `bpy` or other drawing scripts in the STORY PROJECT's `references/`, not the plugin repository. Keep editable `.blend`, scripts, layered/vector originals and actual texture/font/import inputs needed to reproduce or modify the result. Inspect existing scripts before executing them. Use small manual Write/Edit/apply_patch operations (at most 2000 characters each); rendered binaries come from the tools.

Render, inspect the PNG through the shared preview procedure in a fresh task, and hand off findings for any needed edit/render or further inspection in new tasks. A successful process exit is not visual success. For local video, check only framing, scale, positioning/layout, whole-object trajectories and camera controls. Missing hands, anatomical occlusion, contact or regrip proof is not failure. Static shape references retain their own commissioned geometry checks. Retain editable sources; do not impose a universal scene recipe or iteration count.

Explain which details are controlled (for example door adjacency and camera height) and which are placeholders (for example unmodeled faces or neutral block materials). Say how each reference should influence the final image; a blockout is not an approved character redesign. For card integration use the optional [local reference contract](../_meta/rules/local-reference.md).

## Explicit Shot References

Read [shot-inputs.md](../_meta/rules/shot-inputs.md) for the input contract. Within commissioned assembly scope, write one `story/episodes/{ep}/shot-inputs/shotNN.json` whose only top-level key is `references`. Each shot requires MP4 for camera/layout/whole-object trajectories and timing; optional PNG supplements static shape/layout. Retain actual editable sources and describe each reference's use and placeholder limits. GIF is unsupported.

Every shot requires at least one local MP4, including static camera/layout shots that can use a static clip. Header identity assets precede manifest media; sources do not upload. Resolve with converter `--json`, inspect the package and report paths and actual continuity dependencies for fresh independent Director review. Resolution does not authorize rewriting the shot, preparing tasks or submitting video.

## Authority And Delivery

Reference `use` describes only controls and placeholder limits. Creator supplies the work-wide art baseline to Storyboarder, who writes it once in each source shot's `视频风格`; detailed action, expression and sound remain in audiovisual prose. The converter adds bindings and the full shot, not an injected style field. Asset image prompts contain target appearance and actual reference bindings. Internal handoff notes alone do not reach the model.

Main/general engineering owns repository code, host configuration and tests; Creator owns commissioned visual materials, and independent Director contexts review them.

An adequate production commission covers needed local reference work and same-scope revisions without extra permission handshakes. Diagnosis alone remains read-only; preserve explicit checkpoints, overwrite scope and limits. Installation/system changes require actual authority, never implied by Bash access. Reuse explicit installation authority already given for the current work; do not generalize it to future commissions.

Local animation/FFmpeg MP4 is reference media, NOT paid final video. Keep it under `references/`, never as `videos/shotNN.mp4` or task completion. Select it explicitly as a typed video reference in the shot manifest, not in card `images`. This assembly does not authorize submission or tasks.json preparation.

Return exact paths, uses, controlled/placeholder details, inspected outputs, sources, limitations and affected reviews. Card integration keeps asset evidence; final shot packages and relevant boundary pairs require independent shot-input review. Author self-inspection never issues pass. Missing independent context blocks acceptance.
