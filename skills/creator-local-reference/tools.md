# Blender, 2D And Audiovisual Rehearsal Tools

Choose tools for the visual question, not a predefined production script. Examples are command shapes, not mandatory templates. Run from the story project root; verify parent directories before creating outputs. Keep production code and editable inputs under `references/`; environment probes belong under `/tmp/opencode`.

## Environment Check

At the Director-coordinated production start, establish the native OS/architecture, executable resolution and versions for Blender, `ffmpeg` and `ffprobe` using the host's native lookup (for example `command -v` on POSIX). Check only planned helper dependencies, such as the actual Python interpreter and Pillow import for image previews, selected drawing tools or audio helper requirements. Do not assume another machine's paths, versions or devices apply. Missing optional tools limit dependent work, not all craft; config-only calls do not initialize or render.

For the needed rendering path, run a tiny scene with the chosen engine/device under the actual intended headless/display environment. Keep probe code, logs and outputs in a scoped `/tmp/opencode` directory. Confirm a real output plus runtime backend/device evidence; executable presence, device enumeration or `nvidia-smi` alone is insufficient. CUDA compute availability does not establish a working graphics context for Workbench/Eevee, nor does graphics support prove Cycles GPU compute. Exercise only needed paths, not an exhaustive engine benchmark. For planned FFmpeg operations, verify the selected encoder/filter with a tiny output and inspect it with `ffprobe`; version/encoder listings alone are not execution proof.

Reuse valid current-host results from session/project handoffs. Recheck affected paths on tool resolution/version, display or device changes, restart uncertainty or failure; verify newly needed paths when selected. Fresh visual tasks and Reviewers do not each repeat setup. Return commands, resolved tools/versions, actual backend/device, output/log evidence and limits via the existing handoff, using an existing scoped work directory only if persistence is needed. No required machine manifest, ledger, schema or review kind. Never interrupt existing production for probes or auto-install dependencies; installation, driver, repository or system changes need separate explicit authorization.

## Image Inspection

Every image read/operation uses a fresh task under the mandatory [visual context and preview rules](../_meta/rules/visual-context.md), including author iteration. Hand off text, file paths and fingerprints, not image-heavy task history. Python 3 with Pillow is required for the display helper; missing dependencies do not authorize installation or direct Read of originals.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/local-reference-TASK
```

Read only the returned JSON's `preview` path. Consult the shared rules for detail crops, EXIF-oriented source coordinates, optional `visual_inspection` evidence and the designated-temp-only reviewer write exception. Original renders remain the card/provider inputs and fingerprint targets; previews are not replacement production files. Animated GIF/multi-frame inputs require explicit sampled frames, each inspected via previews, with temporal limits disclosed; this helper does not validate motion.

## Blender

Camera design may be subjective POV, over-the-shoulder, external or an insert; do not default to an external third-person view. Follow the commissioned Storyboarder intent and [camera-language knowledge](../storyboarder-storyboard/camera-language.md). For POV place the camera at the observer's plausible eye/view position, independently of the rigid location BOX; hide that proxy from its own view rather than rendering its interior as an obstruction. Preserve real environment occlusion. Do not build hands or facial animation to establish POV: leave room in framing and describe final action in the prompt.

Use the verified Blender path/version and engine/device from the [environment check](#environment-check), supplementing only missing or invalidated evidence. If Workbench cannot create a context, diagnose the actual display/headless and graphics backend error, not just compute-device availability. Where Mesa supports it, a per-process `GALLIUM_DRIVER=llvmpipe` is an optional CPU fallback only after a successful tiny render; never globally export it or assume it applies to every host. Cycles GPU is an alternative when the purpose or verified host constraints warrant it: select a supported compute backend/device and prove its actual use with a tiny render. Do not assume it is faster or treat a silent CPU fallback as GPU proof.

For depth, perspective, spatial occlusion or moving-camera previs, prefer a native Blender scene. Agent-authored Python using `bpy` can create or load scenes, choose geometry/materials/lights/cameras, animate, save and render; do not default to a custom NumPy/Pillow triangle renderer or depth buffer for 3D. For example:

```bash
blender --background --python-exit-code 1 --python references/shot/scene.py
```

The script controls outputs; no plugin scene generator or geometry DSL is involved. Prefer Workbench for shape/layout or Eevee for needed lighting/material cues when supported and sufficient; use Cycles when the question requires its rendering capabilities or the verified host constraints justify it. For CPU Cycles set `scene.cycles.device = 'CPU'`. Choose samples, resolution and denoising for the communicative detail, checking actual results; do not change the commissioned final provider settings to match preview settings. Use the installed version's API/help for unfamiliar features.

Blender cameras look along local -Z with local Y up; `direction.to_track_quat('-Z', 'Y')` can aim one. Perspective communicates depth; orthographic views help compare layouts but do not prove the intended perspective shot works. Define a consistent scene scale and verify screen projection rather than translating world east directly into screen right.

For stills set the active camera, image format PNG and output path deliberately. Save an editable scene with `bpy.ops.wm.save_as_mainfile`; retain the script and actual external inputs as well. Pack needed resources or keep project-relative files in `references/` and declare them. Read scripts as text; inspect binary sources with appropriate tools when needed, without enabling untrusted embedded code. A script importing a missing mesh or texture is not a complete editable handoff.

For local video, choose frame rate/range from the declared camera and whole-object trajectories. People and similar actors default to rigid, static-shape BOX proxies; static permits whole-box translation/rotation, not deformation or performance. Keyframe those transforms and the camera, not poses, limbs, fingers or faces. Inspect relevant framing, scale, position and trajectory transitions, not only endpoints. Render PNG sequences for inspectable frames and reversible encoding. Preserve editable sources; a movie alone cannot explain or edit its construction.

Concrete action, grip/regrip, posture, effort and expression belong in the source shot for model realization. A readable close-up remains camera language compatible with a box proxy; coordinate framing with Storyboarder. Evaluate the proxy for declared framing, layout and whole-object trajectories. Only an explicit different commission changes the default video scope.

## 2D And 2.5D

Use available drawing/compositing tools, SVG, layered artwork or agent-written image code where they express the design clearly. Keep text editable and retain actual font files/inputs when needed and permitted. Rasterize to PNG for cards. A measured plan can establish adjacency; pair it with the actual camera view when occlusion matters. Layers/cards in depth can test parallax without modeling hidden surfaces; explain their limited side views and missing volume.

In local video, represent people/similar actors as boxes regardless of 2D/2.5D/3D technique. Environment and props retain geometry needed to read camera/layout. Static asset shape references retain useful silhouette, topology and proportions. Mark placeholder appearance and its limited control; the source shot and actual identity references supply final appearance.

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

Default to FFmpeg for encoding, frame extraction and audio mixing/muxing; when FFmpeg is available, do not route these operations through Blender VSE as a workaround. A different tool needs a concrete task or capability reason. Reuse verified `ffmpeg`/`ffprobe` versions and selected encoder/filter evidence from the [environment check](#environment-check); supplement only newly needed or invalidated paths. Encode an inspected sequence at its intended rate; for an authorized new preview path, a typical command is:

```bash
ffmpeg -n -framerate 24 -i references/shot/frame-%04d.png -c:v libx264 -pix_fmt yuv420p references/shot/preview.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration references/shot/preview.mp4
```

24 is illustrative, not a project default. Use even dimensions for yuv420p, pad rather than distort/crop important content, and confirm available codecs before choosing flags. `-n` avoids accidental replacement; revise an existing output only within actual overwrite authority. Inspect playback where supported and sample PNGs at meaningful times; state if only sampled frames were viewed and timing could not be judged. Never infer visual success from ffprobe.

Titles, fake audio and timing guides belong in a separate internal rehearsal preview by default, not the uploaded reference. Encode the clean full-group MP4 from unannotated frames; `-an` can exclude audio but cannot remove burned-in labels. Each [task manifest](../_meta/rules/shot-inputs.md) still selects at least one full-group MP4 as `kind:local,media:video`, with actual sources and use. Derive its clock from current canonical member durations; align internal cuts, camera/BOX trajectories and intended sound bridges to those intervals. Static intervals may use static clips. PNG supplements static controls; GIF is unsupported. Rehearsal PLAN/WAV/summary are not manifest media; include actual editable dependencies in sources and review inputs as applicable, without uploading sources. Reference media is not submission authority or task completion. Inspect meaningful internal cuts and external boundaries with disclosed viewing limits, not endpoints or ffprobe alone.
