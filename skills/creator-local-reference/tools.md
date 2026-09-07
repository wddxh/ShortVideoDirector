# Blender, 2D And FFmpeg Knowledge

Choose tools for the visual question, not a predefined production script. Examples are command shapes, not mandatory templates. Run from the story project root; verify parent directories before creating outputs. Keep task-specific code and editable inputs under `references/`.

## Image Inspection

Every image read/operation uses a fresh task under the mandatory [visual context and preview rules](../_meta/rules/visual-context.md), including author iteration. Hand off text, file paths and fingerprints, not image-heavy task history. Python 3 with Pillow is required for the display helper; missing dependencies do not authorize installation or direct Read of originals.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/local-reference-TASK
```

Read only the returned JSON's `preview` path. Consult the shared rules for detail crops, EXIF-oriented source coordinates, optional `visual_inspection` evidence and the designated-temp-only reviewer write exception. Original renders remain the card/provider inputs and fingerprint targets; previews are not replacement production files. Animated GIF/multi-frame inputs require explicit sampled frames, each inspected via previews, with temporal limits disclosed; this helper does not validate motion.

## Blender

Camera design may be subjective POV, over-the-shoulder, external or an insert; do not default to an external third-person view. Follow the commissioned Storyboarder intent and [camera-language knowledge](../storyboarder-storyboard/camera-language.md). For POV place the camera at the observer's plausible eye/view position, independently of the rigid location BOX; hide that proxy from its own view rather than rendering its interior as an obstruction. Preserve real environment occlusion. Do not build hands or facial animation to establish POV: leave room in framing and describe final action in the prompt.

Discover the available executable with `command -v blender` and its version with `blender --version` before use. Check headless rendering support on the current host; do not assume GPU availability or silently install missing tools.

An agent-authored script can create or load a scene, use arbitrary `bpy` APIs, choose geometry/materials/lights/cameras, animate, save and render. For example:

```bash
blender --background --python-exit-code 1 --python references/shot/scene.py
```

The script controls outputs; no plugin scene generator or geometry DSL is involved. For predictable CPU headless work select Cycles and `scene.cycles.device = 'CPU'`. Choose samples, resolution and denoising for the communicative detail, checking actual results; do not change the commissioned final provider settings to match preview settings. Use the installed version's API/help for unfamiliar features.

Blender cameras look along local -Z with local Y up; `direction.to_track_quat('-Z', 'Y')` can aim one. Perspective communicates depth; orthographic views help compare layouts but do not prove the intended perspective shot works. Define a consistent scene scale and verify screen projection rather than translating world east directly into screen right.

For stills set the active camera, image format PNG and output path deliberately. Save an editable scene with `bpy.ops.wm.save_as_mainfile`; retain the script and actual external inputs as well. Pack needed resources or keep project-relative files in `references/` and declare them. Read scripts as text; inspect binary sources with appropriate tools when needed, without enabling untrusted embedded code. A script importing a missing mesh or texture is not a complete editable handoff.

For local video, choose frame rate/range from the declared camera and whole-object trajectories. People and similar actors default to rigid, static-shape BOX proxies; static permits whole-box translation/rotation, not deformation or performance. Keyframe those transforms and the camera, not poses, limbs, fingers or faces. Inspect relevant framing, scale, position and trajectory transitions, not only endpoints. Render PNG sequences for inspectable frames and reversible encoding. Preserve editable sources; a movie alone cannot explain or edit its construction.

Concrete action, grip/regrip, posture, effort and expression belong in the source shot for model realization. A readable close-up remains camera language compatible with a box proxy; coordinate framing with Storyboarder. Evaluate the proxy for declared framing, layout and whole-object trajectories. Only an explicit different commission changes the default video scope.

## 2D And 2.5D

Use available drawing/compositing tools, SVG, layered artwork or agent-written image code where they express the design clearly. Keep text editable and retain actual font files/inputs when needed and permitted. Rasterize to PNG for cards. A measured plan can establish adjacency; pair it with the actual camera view when occlusion matters. Layers/cards in depth can test parallax without modeling hidden surfaces; explain their limited side views and missing volume.

In local video, represent people/similar actors as boxes regardless of 2D/2.5D/3D technique. Environment and props retain geometry needed to read camera/layout. Static asset shape references retain useful silhouette, topology and proportions. Mark placeholder appearance and its limited control; the source shot and actual identity references supply final appearance.

## FFmpeg Previews

Check installed `ffmpeg`/`ffprobe` versions and available encoders. Encode an inspected sequence at its intended rate; for an authorized new preview path, a typical command is:

```bash
ffmpeg -n -framerate 24 -i references/shot/frame-%04d.png -c:v libx264 -pix_fmt yuv420p references/shot/preview.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration references/shot/preview.mp4
```

24 is illustrative, not a project default. Use even dimensions for yuv420p, pad rather than distort/crop important content, and confirm available codecs before choosing flags. `-n` avoids accidental replacement; revise an existing output only within actual overwrite authority. Inspect playback where supported and sample PNGs at meaningful times; state if only sampled frames were viewed and timing could not be judged. Never infer visual success from ffprobe.

Titles, rough sound or timing guides are optional communication aids within scope, not automatic final editing. Each [shot manifest](../_meta/rules/shot-inputs.md) explicitly selects at least one MP4 as `kind:local,media:video`, with actual sources and use. It remains reference material, not submission authority or task completion. PNG supplements static controls, MP4 supplies temporal controls; GIF is unsupported. Review timing with disclosed viewing limits, not endpoints or ffprobe alone.
