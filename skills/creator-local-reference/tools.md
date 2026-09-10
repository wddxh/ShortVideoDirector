# Blender, 2D And Audiovisual Rehearsal Tools

Choose tools for the visual question, not a predefined production script. Examples are command shapes, not mandatory templates. Run from the story project root; verify parent directories before creating outputs. Keep production code and editable inputs under `references/`; environment probes belong under `/tmp/opencode`.

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

For books/pages, screens, photos and controls, establish the usable face relative to the reader/operator or recipient before aiming the camera. Surface `look_at(camera)` is not a readability default: preserve actor use, then choose compatible side/high-angle, OTS, insert or POV framing, plausible tilt or an owner-coordinated cut. Camera tilt alone does not relocate it to eye position; ordinary POV cannot show its own face without a supported mirror/feed. Coarse eye/actor positions plus necessary operation/support proxies suffice without full rigs. Include minimal limb/contact geometry when holding or action would otherwise be unreadable or falsely floating, even with the body visible. Judge transparent/in-world displays, deliberate showing and levitation by intent, not an absolute same-side rule or dot-product gate.

For stills set the active camera, image format PNG and output path deliberately. Save an editable scene with `bpy.ops.wm.save_as_mainfile`; retain the script and actual external inputs as well. Pack needed resources or keep project-relative files in `references/` and declare them. Read scripts as text; inspect binary sources with appropriate tools when needed, without enabling untrusted embedded code. A script importing a missing mesh or texture is not a complete editable handoff.

For local video, choose frame rate/range from declared camera, whole-object trajectories and necessary support transitions. Default to rigid BOX actors; keyframe camera/whole-box transforms and minimal support proxies as needed, not a full rig or facial performance. Inspect relevant framing, scale, position, support and trajectory transitions, not only endpoints. Default to native batch animation directly into MP4, not per-frame scripts, PNG files or new Blender processes. Preserve editable sources; a movie alone cannot explain or edit its construction.

Source prose supplies concrete action, grip/regrip, posture, effort and expression for model realization; coordinate readable framing with Storyboarder. Evaluate declared framing, layout, trajectories and necessary support. Missing fingers is not failure; missing support that contradicts action is. Use simple colors actually rendered by the engine, separating actor/important-prop values from neighbors/background, not hue alone. Keep role mapping stable across relevant shots; simple lighting preserves needed silhouettes, occlusion and contact without blown whites or crushed blacks. Check these cues in the short draft, respecting concealment/reveal timing rather than showing everything. Minimal support is authorized local craft, not a demand for photoreal textures, perfect contrast or full performance animation.

Before a full expensive animation, render a small representative short draft MP4 from the actual scene, using low-cost preview settings and relevant camera/BOX movements or transitions. Select risk-bearing phases of the actual action: approach, pickup/turn, reading/use, lowering and reaction where present. Check important intermediate actor/surface/camera relations, not just readable middle poses or endpoints; these are sampling choices, not required extra actions or a fixed four-pass workflow. Check decode, duration and measured render cost, then hand it to a fresh visual task for meaningful temporal inspection and a few needed extracted frames through the preview helper. Resolve framing, scale, layout or trajectory problems before scaling up. A startup tool probe or a single still does not replace this draft; retain source timing, and map any sampled interval to its canonical shot clock. This is craft iteration, not a new schema or acceptance gate.

### Direct MP4 Animation

Coarse geometry leaves source prose responsible for who does what, relevant body/head/prop facing and pose, screen/anatomical left-right, ownership, grip/contact and necessary initial-middle-end transitions. Detail follows the action, not an all-fields quota. The final prompt interprets actual limb/support proxies as final anatomy and action; `use` describes proxy control rather than final style.

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

## 2D And 2.5D

Use available drawing/compositing tools, SVG, layered artwork or agent-written image code where they express the design clearly. Keep text editable and retain actual font files/inputs when needed and permitted. Rasterize to PNG for cards. A measured plan can establish adjacency; pair it with the actual camera view when occlusion matters. Layers/cards in depth can test parallax without modeling hidden surfaces; explain their limited side views and missing volume.

In local video, use BOX actors with minimal hand/forearm, relevant limb or contact proxies wherever needed to make support/action readable, across 2D/2.5D/3D techniques. Environment and props retain useful geometry; static asset shapes retain their declared silhouette, topology and proportions. `use` declares proxy controls, not final style. Source prose and the final prompt explain actor ownership, final anatomy/pose, grip orientation and action; actual assets supply identity.

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

## FFmpeg Previews

Assembly preserves photographic cuts. When planning independent TASK boundaries, prefer existing motivated camera/view/scale changes where apt; similar consecutive shots may stay grouped to reduce visible independent-generation mismatch. This is no continuity guarantee, every-cut rule or angle threshold. Keep purposeful repeated compositions, consecutive members, durations, provider maximum and grants. Source redesign belongs to Director-coordinated owners within the original budget; concatenation does not authorize silent cut changes or regrouping protected tasks.

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

Titles, fake audio and timing guides belong in a separate internal rehearsal preview by default, not the uploaded reference. Render or assemble the clean full-group MP4 from unannotated clips; `-an` can exclude audio but cannot remove burned-in labels.

Each [task manifest](../_meta/rules/shot-inputs.md) still selects at least one full-group MP4 as `kind:local,media:video`, with actual sources and use. Derive its clock from current canonical member durations; align internal cuts, camera/BOX trajectories and intended sound bridges to those intervals. Static intervals may use static clips. PNG supplements static controls; GIF is unsupported.

Rehearsal PLAN/WAV/summary are not manifest media; include actual editable dependencies in sources and review inputs as applicable, without uploading sources. Reference media is not submission authority or task completion. Inspect meaningful internal cuts and external boundaries with disclosed viewing limits, not endpoints or ffprobe alone.
