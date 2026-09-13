# Blender, 2D And Audiovisual Rehearsal Tools

Choose tools for the visual question, not a predefined production script. Examples are command shapes, not mandatory templates. Run from the story project root; verify parent directories before creating outputs. Keep production code and editable inputs under `references/`; environment probes belong under `/tmp/opencode`.

## Provider Authoring Materials

Once group/reference mapping is settled, use the selected provider's own material tool and documented authoring pack, together with canonical sources and actual refs, to write semantic `manifest.prompt` before independent review. Dreamina's command, pack and reference syntax are in [video.md](../creator-provider-dreamina/video.md#dreamina-authoring-materials). Generic `storyboard-to-prompt.sh/.mjs --json STORYBOARD TASK_ID EP` exposes the final manifest string unchanged; it does not generate prose. Material-tool output alone is not final readiness. See [shot inputs](../_meta/rules/shot-inputs.md) for the shared draft/final contract.

## Environment Check

At the Director-coordinated production start, establish the native OS/architecture, executable resolution and versions for Blender, `ffmpeg` and `ffprobe` using the host's native lookup (for example `command -v` on POSIX). Check only planned helper dependencies, such as the actual Python interpreter and Pillow import for image previews, selected drawing tools or audio helper requirements. Do not assume another machine's paths, versions or devices apply. Missing optional tools limit dependent work, not all craft; config-only calls do not initialize or render.

For the needed rendering path, run a tiny scene with the chosen engine/device under the actual intended headless/display environment. Keep probe code, logs and outputs in a scoped `/tmp/opencode` directory. Confirm a real output plus runtime backend/device evidence; executable presence, device enumeration or `nvidia-smi` alone is insufficient. CUDA compute availability does not establish a working graphics context for Workbench/Eevee, nor does graphics support prove Cycles GPU compute. Exercise only needed paths, not an exhaustive engine benchmark. For planned FFmpeg operations, verify the selected encoder/filter with a tiny output and inspect it with `ffprobe`; version/encoder listings alone are not execution proof.

Reuse valid current-host results from session/project handoffs. Recheck affected paths on tool resolution/version, display or device changes, restart uncertainty or failure; verify newly needed paths when selected. Fresh visual tasks and Reviewers do not each repeat setup. Return commands, resolved tools/versions, actual backend/device, output/log evidence and limits via the existing handoff, using an existing scoped work directory only if persistence is needed. No required machine manifest, ledger, schema or review kind. Never interrupt existing production for probes or auto-install dependencies; installation, driver, repository or system changes need separate explicit authorization.

For planned local animation, include a tiny native direct-MP4 animation in the selected rendering-path probe, not only a still. Prefer an appropriate GPU engine proven under the actual runtime environment; explain unavailable/unsuitable GPU paths and any tested CPU fallback. Confirm that the MP4 decodes and has the intended codec, dimensions, rate and duration. This proves tool operation, not production framing or motion. Do not hardcode a GPU model, OS or compute backend, or launch a full animation to discover whether the path works.

## Image Inspection

Every image read/operation uses a fresh task under the mandatory [visual context and preview rules](../_meta/rules/visual-context.md), including author iteration. Hand off text, file paths and fingerprints, not image-heavy task history. Python 3 with Pillow is required for the display helper; missing dependencies do not authorize installation or direct Read of originals.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/local-reference-TASK
```

Read only the returned JSON's `preview` path. Consult the shared rules for detail crops, EXIF-oriented source coordinates, optional `visual_inspection` evidence and the designated-temp-only reviewer write exception. Original renders remain the card/provider inputs and fingerprint targets; previews are not replacement production files. Animated GIF/multi-frame inputs require explicit sampled frames, each inspected via previews, with temporal limits disclosed; this helper does not validate motion.

## Blender

Camera design may be POV, OTS, external or an insert; follow commissioned Storyboarder intent and [camera-language knowledge](../storyboarder-storyboard/camera-language.md). For POV place the camera at a plausible eye/view position independently of the location BOX; hide its obstructing body interior, retaining real environment occlusion. Keep necessary hand/forearm or contact proxies visible when hiding the body would otherwise erase holding, support or action. POV alone does not require a full rig or facial animation; describe final anatomy and action in the prompt.

Use the verified Blender path/version and engine/device from the [environment check](#environment-check), supplementing only missing or invalidated evidence. If Workbench cannot create a context, diagnose the actual display/headless and graphics backend error, not just compute-device availability. Where Mesa supports it, a per-process `GALLIUM_DRIVER=llvmpipe` is an optional CPU fallback only after a successful tiny render; never globally export it or assume it applies to every host. Cycles GPU is an alternative when the purpose or verified host constraints warrant it: select a supported compute backend/device and prove its actual use with a tiny render. Do not assume it is faster or treat a silent CPU fallback as GPU proof.

For depth, perspective, spatial occlusion or moving-camera previs, prefer a native Blender scene. Agent-authored Python using `bpy` can create or load scenes, choose geometry/materials/lights/cameras, animate, save and render; do not default to a custom NumPy/Pillow triangle renderer or depth buffer for 3D. For example:

```bash
blender --background --python-exit-code 1 --python references/shot/scene.py
```

The script controls outputs; no plugin scene generator or geometry DSL is involved. Prefer a proven working GPU path appropriate to the question: Workbench for shape/layout, Eevee for needed lighting/material cues, or Cycles when its capabilities or verified host constraints warrant it. If GPU paths are unavailable or unsuitable, explain the evidence and tradeoff before using a tiny-tested CPU fallback (`scene.cycles.device = 'CPU'` for CPU Cycles). Do not automatically launch heavy CPU animation or substitute a custom Pillow renderer. Choose samples, resolution and denoising for the communicative detail; validate the short draft below before scaling up. Preview settings do not change commissioned final provider settings. Use the installed version's API/help for unfamiliar features.

Blender cameras look along local -Z with local Y up; `direction.to_track_quat('-Z', 'Y')` can aim one. Perspective communicates depth; orthographic views help compare layouts but do not prove the intended perspective shot works. Define a consistent scene scale and verify screen projection rather than translating world east directly into screen right.

For books/pages, screens, photos and controls, establish the usable face relative to the reader/operator or recipient before aiming the camera. Surface `look_at(camera)` is not a readability default: preserve actor use, then choose compatible side/high-angle, OTS, insert or POV framing, plausible tilt or an owner-coordinated cut. Camera tilt alone does not relocate it to eye position; ordinary POV cannot show its own face without a supported mirror/feed. Coarse eye/actor positions suffice; minimal limb/contact geometry is reserved for established holding/support/contact or specifically necessary action/framing evidence, even with the body visible. Apply ordinary-travel stability and exceptional-articulation limits below. Judge transparent/in-world displays, deliberate showing and levitation by intent, not an absolute same-side rule or dot-product gate.

For stills set the active camera, image format PNG and output path deliberately. Save an editable scene with `bpy.ops.wm.save_as_mainfile`; retain the script and actual external inputs as well. Pack needed resources or keep project-relative files in `references/` and declare them. Read scripts as text; inspect binary sources with appropriate tools when needed, without enabling untrusted embedded code. A script importing a missing mesh or texture is not a complete editable handoff.

For local video, choose frame rate/range from declared camera, whole-object trajectories and support transitions. Ordinary travel uses rigid BODYBOX translation/turning without hands or legs; necessary support limbs use a compatible body-relative stable pose, without gait, leg cycling or arm swing. Follow shared pose scope: operation prep/action/end is not universal rest/travel. Check entry/exit states when reusing scenes/motion, preserving deliberate continuity without automatic reset or visible limb popping; use composition/occlusion or source-owner coordination. Articulation needs a specific commissioned exceptional action and Creator's conscious choice. Inspect framing, scale, support and trajectory transitions. Default to native batch MP4, not per-frame scripts, PNG files or new Blender processes. Preserve editable sources.

Source prose supplies concrete action, grip/regrip, posture, effort and expression for model realization; coordinate readable framing with Storyboarder. Evaluate declared framing, layout, trajectories and necessary support. Missing fingers is not failure; missing support that contradicts action is. Use simple colors actually rendered by the engine, separating actor/important-prop values from neighbors/background, not hue alone. Keep role mapping stable across relevant shots; simple lighting preserves needed silhouettes, occlusion and contact without blown whites or crushed blacks. Check these cues in the short draft, respecting concealment/reveal timing rather than showing everything. Minimal support is authorized local craft, not a demand for photoreal textures, perfect contrast or full performance animation.

Before full expensive animation, render a representative short draft MP4 from the actual scene with low-cost settings. Cover risk-bearing phases present: approach, pickup/turn, use, lowering or reaction. For chosen special-action articulation, include intermediate motion and support transitions, not just endpoints or a readable middle pose. Collision/geometry checks aid diagnosis but cannot replace visual inspection of demonstrated posture/motion. Check decode, duration and render cost, then hand off to a fresh visual task for temporal inspection and needed helper-preview frames. Resolve misleading poses/support and framing/layout/trajectory conflicts before scaling up, under shared omission/repair rules. A tool probe or still does not replace this draft; preserve source timing and map samples to the canonical shot clock. Sampling does not mandate extra actions, fixed passes or a new gate.

### Animation Reuse And Contact

Before adapting an existing scene, inspect its evaluated baseline at relevant source times: active actions/NLA, F-curves and drivers, animated render visibility, material/node animation, color management (including gamma/exposure), constraints and parenting. Check actual FPS, frame origin/range and any strip or clip time mapping against the current shot/task clock. A new transform assignment may be overridden at evaluation. Change only conflicting channels in scope; preserve intentional keys, drivers, reveals and continuous actions rather than globally clearing animation.

During required contact, derive prop, hand and forearm placement from one consistent contact transform and body relationship. Preserve local grip offsets and orientation through turns; do not independently lerp their world positions and hope they stay attached. Make release/regrip an explicit source-timed change of contact, preserving the evaluated pose across parent/constraint changes. Check necessary reach from the actual shoulder/body to the contact point and visible support transitions; use minimal proxies, not a full rig or collision framework.

For changing orientation, choose rotation interpolation suited to the intended motion. With quaternions, keep adjacent equivalent orientations in the same hemisphere and use appropriate interpolation such as slerp; preserve intentional long turns with intermediate orientations rather than forcing every turn onto the shortest arc. Evaluate risky intermediate frames and subframes where interpolation, constraints or motion blur may expose flips, separation or overshoot. Endpoints alone are insufficient; this does not require every-frame inspection or image output.

### Direct MP4 Animation

Coarse geometry leaves source prose responsible for who does what, relevant facing/pose, screen/anatomical left-right, ownership, grip/contact and necessary initial-middle-end transitions, without an all-fields quota. Both video ref.use and Creator's final manifest.prompt declare camera/framing/layout/overall trajectory and timing control, not literal sliding, stiff pose, gait or proxy anatomy. Final prose realizes source-appropriate natural walking posture, weight transfer and steps, retaining necessary grip without added gestures. Strong models can mimic crude performance despite this wording; minimize unwanted media signals rather than promising they will be ignored.

Use the installed version's API; Blender 4.5 uses the following settings after scene/camera/keyframe setup. Set an authorized new output path, even output dimensions, the intended FPS and inclusive frame range explicitly; frame count is `frame_end - frame_start + 1` with `frame_step = 1`. Do not overwrite existing movies without scope to do so.

```python
scene = bpy.context.scene
scene.render.image_settings.file_format = 'FFMPEG'
scene.render.ffmpeg.format = 'MPEG4'
scene.render.ffmpeg.codec = 'H264'
scene.render.filepath = output_mp4
scene.frame_step = 1
bpy.ops.render.render(animation=True)
```

The native animation call renders the range in one batch. Direct MP4 still computes every frame; it avoids intermediate PNG encoding/files and repeated process setup, not the rendering cost or a promise of immediate speed. GPU rendering and hardware video encoding are separate capabilities; H264 output alone proves neither.

Render separate shot MP4s and join them with FFmpeg when useful; a monolithic scene is not required. Preserve current canonical shot durations, dialogue, cuts and the derived group clock without duplicated boundary frames or retiming. Interrupted MP4s may lack a finalized container and be unusable. Bounded shot/clip renders limit lost work; do not automatically switch back to image sequences. Image sequences are an explicit exception for a concrete user need, not the default inspection, recovery or performance workaround. Optional static asset PNGs remain a distinct valid output.

### Visibility Before Camera Search

When a required object or surface is missing, first verify that it actually renders at the relevant time: object/collection/view-layer inclusion, hide flags and their animation curves, evaluated geometry, scene units and dimensions, material opacity and engine settings. Distinguish viewport visibility from render visibility. Then diagnose occlusion, clipping and projection from the commissioned view. Do not search camera positions to compensate for hidden or wrongly scaled geometry; if the required actor view, framing and geometry cannot coexist, return the concrete conflict to the source owner through Director.

## 2D And 2.5D

Use available drawing/compositing tools, SVG, layered artwork or agent-written image code where they express the design clearly. Keep text editable and retain actual font files/inputs when needed and permitted. Rasterize to PNG for cards. A measured plan can establish adjacency; pair it with the actual camera view when occlusion matters. Layers/cards in depth can test parallax without modeling hidden surfaces; explain their limited side views and missing volume.

Across 2D/2.5D/3D local video, apply the same BODYBOX-only ordinary travel and body-relative stability rule above. Minimal hand/forearm or contact geometry is reserved for established support/holding/contact or specifically necessary action/framing evidence, including offscreen-body holding; it is not general permission to add limbs. Environment/prop geometry and static asset silhouette/topology/proportions retain their scope. Both use and final prompt explain control limits; source prose supplies action and actual assets supply identity.

### Film Text And Transition Guides

Use [shared transition/text craft](../_meta/rules/transition-craft.md) for source wording, ownership and reading windows. Optional editable SVG/layered artwork, verified font rendering and 2D/FFmpeg composition can guide a SUPER, full-screen card or transition image without a 3D scene. Retain actual source/font inputs; check glyph coverage, line breaks, margins, contrast and reveal timing in selected media. Declare intended typography/layout/timing in existing `use` and final prompt, distinct from BOX/debug controls. A clean full-group MP4 may include these designed film elements within canonical intervals; PNG guides only supplement it. Do not add assembly seconds or claim accurate model reproduction from a locally correct render.

Audience SUPERs/cards have a screen-space reading window, not an actor-facing use surface. Diegetic UI follows the event-state and actor-use rules below. Internal rehearsal captions are a separate convenience and cannot supply either design's missing evidence.

### UI And Event States

For audience SUPERs/cards use [film-text guides](#film-text-and-transition-guides); the actor-use requirements here concern diegetic surfaces.

Animate required screens/controls as explicit source-timed states: trigger → action feedback → consequence. Preserve required values, text and observable results, including completion, release and freeze/hold states where intended. A sine wave, modulo loop or generic “active” display cannot replace a causal transition or continue after its stop event. Periodic motion is appropriate only for an actually recurring source behavior. Use existing designed UI elements; missing story evidence goes to its owner rather than becoming an invented widget.

Pixel measurements establish sampled size/contrast or visibility; timestamp checks establish measured intervals. Neither alone proves readable meaning, causal completion or a coherent action. Inspect the relevant state transitions in the actual composite, preserving the operator/recipient relationship and reading window. Prompt wording cannot excuse contradictory displayed states.

## Fake Audio Timing

Use optional `scripts/previs-audio.py PLAN --duration N --output-dir DIR` for local timing rehearsal, not TTS. Creator supplies explicit decimal-second intervals from expert estimates of the original dialogue, listening and reactions. The helper renders stable distinguishable speaker tones in first-use order and a separate cue tone; labels do not select cue sounds. It does not infer meanings, speaking rates or canonical offsets. Keep PLAN and outputs in a scoped `references/` directory. These are rehearsal inputs, not another editable timing authority or required production schema.

Example PLAN (illustrative timings, not default pace):

```json
{
  "segments": [
    {"speaker": "A", "text": "I kept it. For you.", "spans": [[0.4, 1.6], [2.3, 3.4]]},
    {"speaker": "B", "text": "Wait.", "spans": [[3.1, 3.7]]}
  ],
  "cues": [{"label": "key revealed", "at": 1.7, "duration": 0.15}]
}
```

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/previs-audio.py" references/task01/rehearsal/plan.json --duration 6.0 --output-dir references/task01/rehearsal/audio
```

The gap in A's spans represents an estimated pause while the reveal is attended to; B overlaps A's ending only if the source interaction supports interruption. Time after speech may still carry listening/reaction. `text` retains the line as a label, not a source for automatic syllable timing; a cue marks an event, not its semantic success. Relate this local preview clock to current shots explicitly in the handoff; rebuild estimates after source changes, never copy them back as canonical offsets.

Outputs are `speaker-001.wav` onward in first-use order, `cues.wav` when cues exist, `mix.wav` and `summary.json`. All WAVs share the requested duration rounded to the nearest sample, mono 16-bit PCM at 16 kHz. Stdout returns `output_dir`, `files`, `duration` and `warnings`; the summary records speaker/frequency mapping, sample intervals and overlaps. Existing output names are not overwritten, so use a fresh directory for another trial. Confirm actual paths and timing before reporting results; missing helper means text estimates, not claimed audio. Optional internal muxing uses the actual mix path; disclose playback versus sampled-frame or estimate-only conclusions.

## Optional Caption Preview

For human viewing convenience, derive an internal review MP4 from an existing clean constant-frame-rate (CFR) animation MP4 and the same [fake-audio PLAN](#fake-audio-timing):

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/previs-preview.py" VIDEO PLAN --output NEW.mp4 [--timecode] [--audio WAV] [--font PATH]
```

The helper verifies the CFR grid using `ffprobe` frame timestamps/durations and stream duration, allowing at most one source timebase tick of quantization, not cumulative drift. It preserves the source's rational frame rate (including rates such as `30000/1001`). VFR or unverifiable timing is rejected: explicitly normalize a separate source to a chosen CFR animation MP4 before retrying; the helper does not automatically change the source rate. Frame inspection times out after 120 seconds; use a shorter native animation MP4 if it exceeds that limit.

Bracketed flags are optional. Keep two versions in scoped `references/`: the clean input stays unchanged; the new MP4 adds a black bottom band without cropping or scaling the picture (H.264 re-encoding is not lossless). No Blender re-render is needed. The helper creates only unique cue-band PNGs and a concat manifest in a temporary `/tmp/opencode/previs-preview-*` directory, then removes that directory; it does not emit a full-frame image sequence.

Each segment's whole `speaker: text` appears during every half-open `spans` interval, rounded to 16 kHz samples; there is no word timing. Concurrent distinct segments occupy separate lines in plan order, wrapping as needed; overlapping spans of the same segment display it once. Pauses have no dialogue text. `--timecode` adds elapsed `HH:MM:SS`, updated once per second, including pauses; it is not frame timecode. `cues` are validated but their labels are not captioned. All plan intervals must fit the video's duration.

Check the actual Python/Pillow, `ffmpeg`/`ffprobe`, `libx264` and a covering Chinese-capable font under the existing environment guidance; do not auto-install. `--font` accepts TTF/OTF/TTC; otherwise the helper tries Noto CJK, WenQuanYi and `fc-match` when available, checking Chinese and caption glyph coverage. Unicode format controls and variation selectors are accepted and retained in text context without requiring standalone glyphs; actual rendering depends on the font and Pillow, with no shaping guarantee. Ensure `/tmp/opencode` exists. The output parent must already exist and `--output` must name a new `.mp4`; existing files and symlinks are refused.

The first video stream must report a positive finite duration, even width/height and width >= 64. Square pixels are required (`1:1`, or missing/`N/A` SAR accepted); nonzero rotation modulo 360 in tags/side data is rejected. Normalize unsupported sources separately before use. The picture keeps its width/height above the added even-height band. By default the first source audio stream is retained as content, aligned to the video start and re-encoded to AAC; a silent source stays silent. `--audio WAV` replaces it with the supplied file's first audio stream starting at zero, for example the existing `mix.wav`; audio is padded/trimmed to video length. The helper does not generate fake audio or mix replacement with source audio.

Only the new MP4 persists. Stdout JSON contains exactly `output` (absolute path), `duration` (video-stream seconds), `width`, `picture_height`, `band_height`, `cue_images` (unique band PNG count) and `intervals` (timed interval count). Output height is `picture_height + band_height`. No subtitle sidecar, WAV or `summary.json` is written; those audio-helper outputs remain separate. Handled failures exit 1 with a `previs-preview:` stderr message.

Keep this captioned version internal and out of upload manifest media. Captions help the human user follow intended dialogue; they do not establish that the clean picture communicates the intended meaning or supply missing visual evidence. The overall task owner stays in pure-text coordination and does not read caption media. Optional visual inspection belongs to a fresh, properly scoped visual task using the shared preview helpers and necessary temporal evidence. Return paths, observations and limits as text; use the clean selected media for applicable acceptance. This convenience adds no independent review gate, required artifact or ledger.

## FFmpeg Previews

Preserve source cuts and editorial purpose. Apply the [grouped-task boundary preference](SKILL.md#grouped-task-references): strongly favor motivated, visibly distinct camera/view/scale between independent tasks to reduce near-identical mismatch visibility. Judge junctions by [source intent](../_meta/rules/shot-inputs.md#reference-authority). Preserve needed match compositions and essential uninterrupted contact/speech; explain choices in the existing handoff without new permission. No every-shot change, angle quota, continuity guarantee or excuse for source-conflicting identity/state. TASK is a generation unit, not a scene/act; motion may cross a hard cut without stopping or restarting. Preserve consecutive members, durations, model maximum and grants. Source redesign goes through Director/owners within the original budget; concatenation cannot silently change cuts or protected groups.

Blender animation uses its native FFmpeg movie output above. Use external FFmpeg for clip concatenation, needed transcoding, audio mixing/muxing and subsequent selective frame extraction, not Blender VSE merely to encode. Reuse verified `ffmpeg`/`ffprobe` and selected encoder/filter evidence from the [environment check](#environment-check); supplement only newly needed or invalidated paths. For compatible shot clips, an authorized new full-group output can use:

```bash
ffmpeg -n -f concat -safe 1 -i references/task01/clips.txt -c copy references/task01/preview.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration references/task01/preview.mp4
```

`clips.txt` lists relative clip paths in canonical order, for example `file 'shot01.mp4'`. Stream copy requires matching stream layouts, codec parameters and time bases; otherwise normalize with a verified encoder without altering current durations or cuts. Use even dimensions for yuv420p, padding rather than distorting/cropping important content. `-n` avoids accidental replacement; actual overwrite authority still binds. Probe and decode the assembled MP4, not only its components.

After the MP4 exists, extract only frames needed for a specific question in a fresh visual task's designated temporary directory, then run each through `review-image.py` and read only its returned preview. For example, after verifying the output directory:

```bash
ffmpeg -n -i references/task01/preview.mp4 -ss 1.2 -frames:v 1 /tmp/opencode/local-reference-TASK/at-1.2.png
```

Choose actual meaningful times, including needed motion transitions and both sides of cuts; 1.2 is illustrative. Record source MP4/fingerprint and sample times. Do not extract every frame or create a global frame-output tree. Inspect playback where supported; disclose sampled-only coverage and temporal limits. Few stills, endpoints, a process exit or ffprobe do not prove continuous motion; missing necessary temporal evidence remains unknown under existing review rules.

For segmented renders, overlays or replacement intervals, inspect the assembled full result as well as the changed segment. Sample just before, across and after each relevant join, including joins inside a source shot with no intended cut. Look for noise/denoising, lighting, color/gamma, motion/velocity and actual audio discontinuities; a clean patch or matching endpoint does not prove a seamless composite. Preserve intended cuts and sound bridges, and distinguish internal fake audio from selected media. Repair demonstrated discontinuities in the media rather than asking the final prompt to ignore them.

For task junctions, inspect selected clean MP4 tail/head windows together in one fresh scoped task, with final prompt intent and source/task clock mappings. Within the same continuous event, include enough action to judge necessary direction, possession/contact, progress, space and sound compatibility, not identical frames; endpoints alone can hide stops/restarts. For scene/act/time/place jumps, assess the intended causal, emotional, information, thematic contrast or parallel relation and viewer orientation. Preserve source-supported mystery, abruptness and hard cuts; do not force same-position, continuing action/sound, smoothing, immediate explanation or a bridge scene. Underlying identity/world facts remain source-consistent. Inspect necessary neighbors without rendering or authorizing them. Report evidence gaps and distinguish heard audio, an unassessed stream, planned bridges and fake timing. No fixed window, frame quota, required dissolve or final-video autocutting.

Internal production titles, debug labels, fake audio and timing guides belong in a separate rehearsal preview, not the uploaded reference. Clean means free of those internal annotations: source-intended film titles, SUPERs, cards, UI and transition imagery may remain under [film-text craft](../_meta/rules/transition-craft.md). Render/assemble from clips free of debug contamination; `-an` excludes audio but cannot remove burned-in labels. The optional bottom-caption preview remains internal and non-uploaded.

Each [task manifest](../_meta/rules/shot-inputs.md) still selects at least one full-group MP4 as `kind:local,media:video`, with actual sources and use. Derive its clock from current canonical member durations; align internal cuts, camera/BOX trajectories and intended sound bridges to those intervals. Static intervals may use static clips. PNG supplements static controls; GIF is unsupported.

Rehearsal PLAN/WAV/summary are not manifest media; include actual editable dependencies in sources and review inputs as applicable, without uploading sources. Reference media is not submission authority or task completion. Inspect meaningful internal cuts and external boundaries with disclosed viewing limits, not endpoints or ffprobe alone.
