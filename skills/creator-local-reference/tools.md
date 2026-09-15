# Lightweight Animatic And Audiovisual Rehearsal Tools

Choose tools for the visual question, not a predefined production script. Examples are command shapes, not mandatory templates. Run from the story project root; verify parent directories before creating outputs. Keep production code and editable inputs under `references/`; environment probes belong under `/tmp/opencode`.

Creator assembles a complete task timeline from suitable existing asset PNGs, layered images, 2D animation, necessary 3D or existing video clips, choosing per shot and reusing compatible materials. SVG is an optional preferred planar material; its tools create components, not the exclusive full-group route. No per-shot SVG requirement or tool-purity acceptance applies. Preserve source facts/timing/cuts and actual material use, then deliver complete clean and same-timeline caption review MP4s.

Keep material choice reasoning short in the existing handoff: identify reusable material, the missing control, and the simplest verified route that supplies it. Preserve fixed user choices and source boundaries. On repair, choose the expression again when useful; a static layer, 2D animation or local 3D replacement may resolve the conflict with less coupled work. Synchronize actual sources, selected media, use and prompt, with owner coordination for source redesign.

## Provider Authoring Materials

Once group/reference mapping is settled, use the selected provider's own material tool and documented authoring pack, together with canonical sources and actual refs, to write semantic `manifest.prompt` before independent review. Dreamina's command, pack and reference syntax are in [video.md](../creator-provider-dreamina/video.md#dreamina-authoring-materials). Generic `storyboard-to-prompt.sh/.mjs --json STORYBOARD TASK_ID EP` exposes the final manifest string unchanged; it does not generate prose. Material-tool output alone is not final readiness. See [shot inputs](../_meta/rules/shot-inputs.md) for the shared draft/final contract.

## Environment Check

At authorized production initialization, Director coordinates one Creator environment commission covering every currently supported local route below, including routes not yet selected for shots. Save one current Markdown capability report at project-relative `story/work/shared/environment/environment.md`. Establish the actual host OS/architecture, runtime/display context, resolved executables/libraries and versions. Give each route an evidenced pass or unavailable conclusion; coverage does not require every route to succeed or every GPU backend/filter combination to be tried. Missing tools affect only dependent work. Config-only calls stay read-only and do not initialize or render.

Keep probe code, logs and outputs in scoped `/tmp/opencode`. Exercise these supported routes with tiny outputs in the actual runtime environment:

- Python/Pillow: create a small image and run `review-image.py` to verify the helper preview output.
- SVG: resolve librsvg >= 2.46, Cairo, GLib and GObject; run `svg-animatic.py` on a tiny trusted source through its real rasterization/encoding path to a micro MP4.
- Blender: cover Workbench, Eevee and Cycles with suitable tiny scene outputs, including native MP4 animation. Distinguish graphics context/backend from compute device; executable presence, device lists or CUDA availability do not prove rendering. Test appropriate available GPU paths and a useful CPU fallback when needed; record unavailable engines and reasons. No exhaustive device/backend matrix is required.
- FFmpeg/ffprobe: verify small composition/concat, encoding, decoding, selective frame extraction and audio mix/mux outputs. Run `previs-preview.py --timecode` with a tiny PLAN and actual CJK-capable font to verify caption rendering and complete preview output.
- `previs-audio.py`: run a tiny explicit speaker/cue PLAN and verify the generated WAV/mix and summary.

Make the fixed report self-contained: retain runnable commands and relevant probe setup, resolved tool/library/helper/font paths and versions, actual backend/device, output paths and measured results, failure diagnostics and limits. Summarize decisive evidence in the report so temporary logs are not its only explanation. A missing dependency supports unavailable, not an unrun pass; retain covered routes even when they cannot execute. This is a current Markdown capability report, not a schema, gate or registry. Keep it out of `manifest.sources` and default review semantic inputs; tasks read the same file rather than copying reports.

Creator reads the fixed report as a normal stable read dependency and selects materials from its verified capabilities. Director coordinates only initialization/update ownership and reader/writer stability, without relaying the report or its path for every task. If missing, coordinate one initialization/recovery commission; children do not each run full checks. Reuse directly across tasks and episodes, with no routine retest, TTL or version scan. Only an actual fault, known environment change or newly needed capability without supporting evidence triggers a coordinated targeted update; preserve unaffected conclusions. A report from another host does not establish this host's capabilities.

Verify micro MP4 decoding, codec, dimensions, frame rate and duration; distinguish GPU rendering from hardware encoding. Probes prove operation, not production framing/motion. Use actual-scene short drafts for costly or unresolved motion work. Never interrupt production, auto-install, change drivers/system settings or probe accounts/paid providers as part of this check; such changes require their own authority.

## Saved Spec And Selected Media Check

Read the canonical `SVD_CONFIG` episode section and saved `epNN 本地参考宽度`, `epNN 本地参考高度`, `epNN 本地参考fps` before formal source setup/export. Follow [spec ownership and selection](SKILL.md#saved-episode-media-specification): final-video ratio/resolution by default, explicit user local override first, one source-compatible CFR fps per episode. Record the actual basis, not example defaults. Missing spec is bounded config-owner work, separate from the shared environment report; it adds no initialization probe or historical migration.

Creator checks reusable media before deciding which local exports/conversions need repair. Drafts may use lower resolution; selected formal clean media uses saved dimensions/fps with the canonical clock and intended camera/ratio intact. Verify actual pixels and frame timing rather than relabeling metadata.

Before delivery, explicitly select one complete clean MP4 declared as local video in the task manifest and run:

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/local-reference-media-check.mjs" EP TASK_ID --video PATH
```

Run from the story project root with the actual config path, task ID and selected path. The check compares this media's real dimensions/CFR/duration with the saved episode spec and canonical task clock. Supplementary short videos need not all have full-group duration. Return actual diagnostics; this tool is not an automatic gate or semantic pass. Reviewer captures config and selected media before its own check within the existing shot-input round. Verify caption picture width/height, fps and duration match clean; total height is picture height plus band. Config changes follow scoped evidence compatibility, not blind hash refresh.

The CLI accepts only `EP TASK_ID --video PATH` and resolves PATH from the story project root. It requires a final manifest and verifies that PATH is one of its declared local videos. Stdout reports `ep`, `task_id`, `config`, `video`, `expected`, `actual` and `errors`, with `shots`/`inputPath` once resolved. Expected includes saved width/height/fps and canonical duration; actual includes measured width/height/fps, frames, duration, CFR, square-pixel and rotation facts when measurable. Exit 1 reports failure; unavailable measurements remain null rather than fabricated. The checker diagnoses selected clean only; caption picture/band and semantic inspection remain the existing delivery/review responsibilities.

`local-reference-spec.mjs` exports `readLocalReferenceSpec(ep, configPath?)`, returning `{config, expected:{width,height,fps}}`. Width/height must be positive even integer pixels; the media layer additionally requires width >= 64. Fps accepts positive integer, decimal or fraction input, reduces it to an exact rational string, and has no default. Choose fps so canonical task duration × fps is an integer frame count matching the selected clean. The inherited CFR check inspects decoded frame timestamps/durations and stream duration; its 120-second probe execution timeout is not a video-duration cap. Probe/timing failure leaves `actual:null` with diagnostics.

## Image Inspection

Every image read/operation uses a fresh task under the mandatory [visual context and preview rules](../_meta/rules/visual-context.md), including author iteration. Hand off text, file paths and fingerprints, not image-heavy task history. Python 3 with Pillow is required for the display helper; missing dependencies do not authorize installation or direct Read of originals.

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/review-image.py" "SOURCE" --output-dir /tmp/opencode/local-reference-TASK
```

Read only the returned JSON's `preview` path. Consult the shared rules for detail crops, EXIF-oriented source coordinates, optional `visual_inspection` evidence and the designated-temp-only reviewer write exception. Original renders remain the card/provider inputs and fingerprint targets; previews are not replacement production files. Animated GIF/multi-frame inputs require explicit sampled frames, each inspected via previews, with temporal limits disclosed; this helper does not validate motion.

## Blender

Camera design may be POV, OTS, external or an insert; follow commissioned Storyboarder intent and [camera-language knowledge](../storyboarder-storyboard/camera-language.md). For POV place the camera at a plausible eye/view position independently of the location BOX; hide its obstructing body interior, retaining real environment occlusion. Keep necessary hand/forearm or contact proxies visible when hiding the body would otherwise erase holding, support or action. POV alone does not require a full rig or facial animation; describe final anatomy and action in the prompt.

Read the fixed report's verified Blender path/version and engine/device; route missing or fault-invalidated evidence through the coordinated [targeted update](#environment-check). Diagnose Workbench context failures from actual graphics/display errors, separately from compute availability. Where Mesa supports it, per-process `GALLIUM_DRIVER=llvmpipe` is an optional CPU fallback with tiny-render evidence; never globally export it. Select Cycles GPU when purpose and verified host capabilities warrant it, using the recorded supported compute backend/device. A newly needed path requires a targeted probe, while an already verified path is reused directly. Silent CPU fallback does not prove GPU use or speed.

Reuse suitable existing materials first. Add minimal native Blender/3D when necessary complex rotation, camera tracking, depth occlusion or contact remains unresolved by those materials and lightweight 2D. Preserve source intent; tool convenience does not authorize camera/action redesign. Agent-authored `bpy` can create/load, animate, save and render the needed component; do not build a custom NumPy/Pillow triangle renderer or depth buffer for 3D. For example:

```bash
blender --background --python-exit-code 1 --python references/shot/scene.py
```

The script controls outputs; no plugin scene generator or geometry DSL is involved. Bounded scene-specific SVG camera/perspective projection with explicit layer reuse is valid; disclose its actual geometry/occlusion scope. SVG is optional, and minimal Blender remains available for unresolved complex spatial needs. For Blender prefer a proven appropriate GPU path: Workbench for shape/layout, Eevee for lighting/material cues, or Cycles when warranted. If unavailable/unsuitable, explain evidence and tradeoffs before a tiny-tested CPU fallback (`scene.cycles.device = 'CPU'`). Do not automatically launch heavy CPU animation or expand bounded projection into a general triangle renderer, depth buffer or arbitrary-occlusion framework to bypass tool failure. Choose samples/resolution/denoising for communicative detail and check early before scaling up. Preview settings do not change final provider settings; consult the installed API/help.

Blender cameras look along local -Z with local Y up; `direction.to_track_quat('-Z', 'Y')` can aim one. Perspective communicates depth; orthographic views help compare layouts but do not prove the intended perspective shot works. Define a consistent scene scale and verify screen projection rather than translating world east directly into screen right.

For books/pages, screens, photos and controls, establish the usable face relative to the reader/operator or recipient before aiming the camera. Surface `look_at(camera)` is not a readability default: preserve actor use, then choose compatible side/high-angle, OTS, insert or POV framing, plausible tilt or an owner-coordinated cut. Camera tilt alone does not relocate it to eye position; ordinary POV cannot show its own face without a supported mirror/feed. Coarse eye/actor positions suffice; minimal limb/contact geometry is reserved for established holding/support/contact or specifically necessary action/framing evidence, even with the body visible. Apply ordinary-travel stability and exceptional-articulation limits below. Judge transparent/in-world displays, deliberate showing and levitation by intent, not an absolute same-side rule or dot-product gate.

For stills set the active camera, image format PNG and output path deliberately. Save an editable scene with `bpy.ops.wm.save_as_mainfile`; retain the script and actual external inputs as well. Pack needed resources or keep project-relative files in `references/` and declare them. Read scripts as text; inspect binary sources with appropriate tools when needed, without enabling untrusted embedded code. A script importing a missing mesh or texture is not a complete editable handoff.

For local video, use saved episode CFR fps and derive frame range from canonical timing and intended camera/trajectory/support changes. Ordinary travel uses rigid BODYBOX translation/turning without hands or legs; necessary support limbs keep a compatible body-relative pose without gait or arm swing. Operation prep/action/end is not universal rest/travel. Reuse preserves deliberate entry/exit continuity without automatic reset or visible limb popping; use composition/occlusion or source-owner coordination. Articulation needs a specifically commissioned exceptional action and Creator's conscious choice. Inspect framing, scale, support and trajectory transitions. Use native batch MP4 rather than per-frame scripts, PNG files or Blender processes; preserve editable sources.

Source prose supplies concrete action, grip/regrip, posture, effort and expression for model realization; coordinate readable framing with Storyboarder. Evaluate declared framing, layout, trajectories and necessary support. Missing fingers is not failure; missing support that contradicts action is. Use simple colors actually rendered by the engine, separating actor/important-prop values from neighbors/background, not hue alone. Keep role mapping stable across relevant shots; simple lighting preserves needed silhouettes, occlusion and contact without blown whites or crushed blacks. Check these cues in the selected early pictures/motion drafts, respecting concealment/reveal timing rather than showing everything. Minimal support is authorized local craft, not a demand for photoreal textures, perfect contrast or full performance animation.

Check necessary compositions/poses early before full expensive export. Creator chooses the useful sequence of key-picture checks and short motion drafts; use a low-cost draft where rotation, interpolation or contact needs temporal evidence. Cover the relevant initial/intermediate/end changes and support transitions, not endpoints alone. Collision/geometry checks assist diagnosis, not visual proof. Inspect through fresh tasks and helper previews, resolve misleading media, and preserve source timing/sample mappings. This is author iteration, not an extra required review round, artifact, gate or permission checkpoint; a still or tool probe cannot prove necessary motion. Final delivery and selected-media review still use the complete task MP4.

### Animation Reuse And Contact

Before adapting an existing scene, inspect its evaluated baseline at relevant source times: active actions/NLA, F-curves and drivers, animated render visibility, material/node animation, color management (including gamma/exposure), constraints and parenting. Check actual FPS, frame origin/range and any strip or clip time mapping against the current shot/task clock. A new transform assignment may be overridden at evaluation. Change only conflicting channels in scope; preserve intentional keys, drivers, reveals and continuous actions rather than globally clearing animation.

During required contact, derive prop, hand and forearm placement from one consistent contact transform and body relationship. Preserve local grip offsets and orientation through turns; do not independently lerp their world positions and hope they stay attached. Make release/regrip an explicit source-timed change of contact, preserving the evaluated pose across parent/constraint changes. Check necessary reach from the actual shoulder/body to the contact point and visible support transitions; use minimal proxies, not a full rig or collision framework.

For changing orientation, choose rotation interpolation suited to the intended motion. With quaternions, keep adjacent equivalent orientations in the same hemisphere and use appropriate interpolation such as slerp; preserve intentional long turns with intermediate orientations rather than forcing every turn onto the shortest arc. Evaluate risky intermediate frames and subframes where interpolation, constraints or motion blur may expose flips, separation or overshoot. Endpoints alone are insufficient; this does not require every-frame inspection or image output.

### Direct MP4 Animation

Coarse geometry leaves source prose responsible for who does what, facing/pose, screen/anatomical left-right, ownership, grip/contact and necessary initial-middle-end transitions, without an all-fields quota. Actual video ref.use and Creator's final manifest.prompt declare composition/position/beat/cut/necessary trajectory controls and their non-imitation scope. Final prose positively describes source-appropriate natural action, including walking posture, weight transfer and steps when relevant. Holds, rigid translation or fixed proxy poses need no extra animation when that division is clear and source facts remain compatible. Do not trigger rework from hypothetical imitation or claim guaranteed prevention; repair only concrete source conflicts or semantically established necessary evidence gaps.

Use the installed version's API; Blender 4.5 uses the following settings after scene/camera/keyframe setup. Set an authorized new output path, saved episode width/height/fps and canonical inclusive frame range explicitly; account for render percentage and fps base so actual formal output matches the saved spec. Frame count is `frame_end - frame_start + 1` with `frame_step = 1`. Lower-resolution drafts remain separate. Do not overwrite existing movies without scope to do so.

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

### Optional SVG Component Renderer

Use `scripts/svg-animatic.py` only for chosen SVG-authored portions (or a suitable whole-task example), not as the sole mixed-media assembly route. From the repository root, the interface is:

```bash
python3 scripts/svg-animatic.py SOURCE.py --duration DURATION --fps "$LOCAL_FPS" --width "$LOCAL_WIDTH" --height "$LOCAL_HEIGHT" --output ABS.mp4 [--overwrite]
```

For formal production, populate LOCAL_WIDTH/LOCAL_HEIGHT/LOCAL_FPS from the saved episode-qualified config keys above, and DURATION from the canonical source interval. Source layout uses these actual dimensions, not copied example 640×360 values. Resolve the tool under `${CLAUDE_PLUGIN_ROOT}/scripts/`; keep trusted SOURCE and editable dependencies under the story project's `references/`. Read SOURCE before execution: it runs once with caller privileges, not in a sandbox. It defines `frame(t, width, height) -> str`, returning nonempty static SVG. Each call gets exact `Fraction` time `n / fps`; compute motion/state in Python, not SMIL, JavaScript or CSS animation. The working directory is retained; use source-relative paths deliberately and self-contained SVG (embed images; no relative SVG base URI).

The optional renderer needs Python 3, system librsvg >= 2.46 with Cairo/GLib/GObject via stdlib `ctypes`, and FFmpeg with `libx264`; it does not use CairoSVG or require Pillow. Read the fixed environment report for this initialization-tested route; actual faults or uncovered capability needs follow the coordinated targeted-update rule. Frames pipe to one FFmpeg process without per-frame SVG/PNG files. Output is silent H.264/yuv420p; retain required audio separately during mixed assembly.

All five CLI values are required. Duration/fps accept positive decimals or fractions; their product must be an integer, dimensions positive even integers. Derive clip timing/cuts from source and choose a compatible frame grid; off-grid changes first appear at the next frame, with no added endpoint frame. The output parent must exist. Existing output fails unless authorized `--overwrite` atomically replaces it after encoding; stdout reports output, frames, exact duration/fps strings and dimensions. The renderer neither reads nor writes task manifests. Keep actual editable/imported sources in existing `sources`; no renderer settings or parallel timing schema belong in the manifest.

See [the synthetic example](../../examples/svg-animatic/README.md) for `source.py`, `review-plan.json`, the two clean/review commands and an existing-FFmpeg mixed-source template. Example seconds/fonts are not production defaults. Assemble all selected components with [FFmpeg](#ffmpeg-previews) into the complete clean task MP4, then derive the complete [caption review MP4](#caption-review-mp4); clip-local `t=0` never resets task-global subtitle windows.

### Planar Craft And Assembly

Separate spatial construction from time assembly. For fixed composition, produce one editable SVG/PNG or render one Blender frame, then use FFmpeg timed hold and UI/visibility layers for the existing interval. Reuse the same spatial material while changing only source-timed state layers. Use suitable animation for required camera movement, overall trajectories, changing contact or reveals; choose minimal 3D where the relationship needs it. A hold serves declared static controls, not proof of necessary motion. Preserve canonical shot/clock boundaries and assemble the complete clean MP4 before deriving the complete caption review MP4.

For planar components, consider editable SVG key compositions/poses alongside existing asset PNGs, layered artwork and limited 2D animation. Choose suitable materials per shot and reuse backgrounds, actors/props and clips; revise affected objects or intervals without coupling every shot to one scene. Preserve source framing, direction, relative scale, ownership and contact/reveal order. Use translation, limited rotation, scale or layer visibility where they express the intended control; flat scaling is not proof of a depth-changing camera move. Compose with other needed media rather than forcing an all-SVG timeline.

Use key states, holds, rigid translation and limited animation to communicate the commissioned controls on the task clock. These abstractions are acceptable when actual use/final prompt distinguish them from natural final action; no gait, full limbs, detailed rigs or facial performance is required. Check necessary contact ownership, occlusion/reveal order and key action timing. A source-conflicting fact needs media repair; missing necessary evidence is a semantic question, not an automatic penalty for static frames, discrete poses or planar motion. Final prose cannot reverse contradictory reference facts.

Check necessary pictures early and use short temporal drafts for unresolved motion before full export, in Creator's chosen order. Export one complete MP4 covering all current consecutive task shots at unchanged source durations, dialogue timing and cuts. Mixed materials and per-shot clips must join into that full-group deliverable; separate PNGs never replace it. Retain actual editable/imported dependencies as `sources` under `references/`, including SVG, drawing/animation scripts or fonts when used, not uploaded media. Use confirmed tool interfaces only; these craft rules prescribe no new parser or scene schema.

Use available drawing/compositing tools and retain editable text plus actual permitted font inputs. Rasterize SVG to PNG for cards or static supplements. A measured plan can establish adjacency; pair it with the actual camera view when occlusion matters. Layers/cards in depth can test parallax without modeling hidden surfaces; explain limited side views and missing volume. Escalate to the minimal Blender/hybrid path above when 2D cannot express the required relationship correctly.

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

## Caption Review MP4

Author `segments` with `speaker`, verbatim source `text` and explicit `spans: [[start, end], ...]` in seconds on the complete task clock. Cover all source dialogue and narration in their corresponding windows; do not paraphrase, omit offscreen speech or fill silent intervals with text. Preserve source-specified timing and cross-cut continuation/overlap without restarting a line at each cut. Where exact delivery windows are not specified, use source-compatible Creator estimates within existing shot/task intervals and disclose them as rehearsal estimates, not measured speech or new canonical timing.

The helper displays each segment's whole text, not word-level progression. Use source-supported utterance units; preserve every original word and sequence if dividing a long passage into readable units. Keep source pauses in spans rather than padding the task. Reconcile PLAN with every current member shot after changes and derive the review video from the matching clean output. Deliver both complete MP4 paths and PLAN via the existing handoff.

Lightweight animatic/mixed-reference delivery includes a complete clean task MP4 and a complete caption review MP4 derived from that exact clean constant-frame-rate (CFR) video, regardless of the materials used. Use the existing [PLAN format](#fake-audio-timing) directly; running the audio helper or generating TTS/tones is unnecessary. Export the caption version with elapsed timecode:

```bash
python3 "${CLAUDE_PLUGIN_ROOT}/scripts/previs-preview.py" VIDEO PLAN --output NEW.mp4 --timecode [--audio WAV] [--font PATH]
```

The helper verifies the CFR grid using `ffprobe` frame timestamps/durations and stream duration, allowing at most one source timebase tick of quantization, not cumulative drift. It preserves the source's rational frame rate (including `30000/1001`) and frame count. Verify caption picture width/height, duration, frame rate and cut positions against clean; do not retime the source for subtitles. VFR/unverifiable timing is rejected; the frame probe has a 120-second execution timeout, not a video-duration cap. Report limitations to Director/main; a shortened preview cannot fulfill complete-task delivery. The helper does not automatically normalize or change source rate.

Bracketed flags are optional. Keep two versions in scoped `references/`: the clean input stays unchanged; the new MP4 adds a black bottom band without cropping or scaling the picture (H.264 re-encoding is not lossless). No Blender re-render is needed. The helper creates only unique cue-band PNGs and a concat manifest in a temporary `/tmp/opencode/previs-preview-*` directory, then removes that directory; it does not emit a full-frame image sequence.

Each segment's whole `speaker: text` appears during every half-open `spans` interval, rounded to 16 kHz samples; there is no word timing. Concurrent distinct segments occupy separate lines in plan order, wrapping as needed; overlapping spans of the same segment display it once. Pauses have no dialogue text. `--timecode` adds elapsed `HH:MM:SS`, updated once per second, including pauses; it is not frame timecode. `cues` are validated but their labels are not captioned. All plan intervals must fit the video's duration.

The complete review MP4 must mark every actual internal cut with its task-global time using existing display-only PLAN `segments`, a clearly internal speaker label and source-derived spans. Write the actual cut time in marker text (for example `02.000s`); PLAN windows accept decimal seconds. The helper does not detect cuts automatically. A single-shot task without internal cuts has no cut markers; report that fact in the handoff rather than inventing cuts. The built-in `--timecode` remains whole-second HH:MM:SS, not frame/millisecond timecode. Keep markers distinct from dialogue/narration and out of fake-audio speech, clean media, uploads and final prompt. Preserve source timing; this delivery requirement adds no schema or review gate. Tool limitations go to Director/main.

Use the fixed report's verified Python/Pillow, `ffmpeg`/`ffprobe`, `libx264` and CJK-capable font; coordinate targeted updates for actual faults or uncovered needs. `--font` accepts TTF/OTF/TTC; otherwise the helper tries Noto CJK, WenQuanYi and `fc-match` when available, checking Chinese and caption glyph coverage. Unicode format controls and variation selectors are retained without requiring standalone glyphs; rendering depends on the font and Pillow, with no shaping guarantee. Ensure `/tmp/opencode` exists. The output parent must exist and `--output` must name a new `.mp4`; existing files and symlinks are refused.

The first video stream must report a positive finite duration, even width/height and width >= 64. Square pixels are required (`1:1`, or missing/`N/A` SAR accepted); nonzero rotation modulo 360 in tags/side data is rejected. Normalize unsupported sources separately before use. The picture keeps its width/height above the added even-height band. By default the first source audio stream is retained as content, aligned to the video start and re-encoded to AAC; a silent source stays silent. `--audio WAV` replaces it with the supplied file's first audio stream starting at zero, for example the existing `mix.wav`; audio is padded/trimmed to video length. The helper does not generate fake audio or mix replacement with source audio.

Only the new MP4 persists. Stdout JSON contains exactly `output` (absolute path), `duration` (video-stream seconds), `width`, `picture_height`, `band_height`, `cue_images` (unique band PNG count) and `intervals` (timed interval count). Output height is `picture_height + band_height`. No subtitle sidecar, WAV or `summary.json` is written; those audio-helper outputs remain separate. Handled failures exit 1 with a `previs-preview:` stderr message.

Keep the captioned version internal and out of upload manifest media; retain source-intended film text in clean. The complete caption MP4 is an actual animatic/mixed-reference deliverable for human timing review, not merely an optional suggestion. Captions do not prove clean-picture meaning or supply missing visual evidence. The overall task owner stays pure-text and does not read caption media; any visual inspection uses fresh scoped tasks, shared preview helpers and necessary temporal evidence. Return paths, observations and limits as text; acceptance still uses selected clean media and final prompt. Add no independent gate, mandatory extra review round or ledger.

## Episode Caption Review MP4

Director commissions one Creator after the current episode's complete materials and existing independent reviews are ready and dependencies stable. Deliver all task clean/caption videos as before, plus `references/epNN/episode-previs/review.mp4`. This is internal local-reference assembly within existing production authority, once per completed episode in a series, not all-series or generated-video editing. Partial scope stays partial. It adds no permission handshake, formal review kind, gate or writes to original reviews, manifests or grants.

Use the [Node entry](../../scripts/episode-previs.mjs); it resolves canonical task inputs and invokes the internal [Python renderer](../../scripts/episode-previs.py). The public CLI is:

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/episode-previs.mjs" EP --parts PARTS.json --output OUTPUT.mp4 [--font FONT]
```

`EP` resolves `story/episodes/EP/storyboard.md` and its canonical final manifests. CLI file paths and PARTS `video`/`plan` values resolve from the story project working directory, not the PARTS file's directory or plugin root; absolute paths are accepted. Use project-root-relative reference paths consistently with manifest declarations. `${CLAUDE_PLUGIN_ROOT}` locates executable code only. Create the authorized output parent and ensure `/tmp/opencode` exists before invoking; the renderer requires both. Only `--parts`, `--output` and optional `--font` are accepted: there is no `--overwrite` flag, and existing outputs (including symlinks) are refused.

Run from the story project root with the handed-off canonical `SVD_CONFIG`. Use `story/work/epNN/episode-previs/parts.json` for PARTS and the formal reference path above for OUTPUT. PARTS is an array of `{video,plan}`, one entry per group in canonical source-task order. Creator explicitly selects one complete clean MP4 declared in each current manifest and the corresponding actual PLAN path. Never discover PLAN by guessing a JSON in `sources` or by filename. The mapping is only invocation input, not a ledger, new manifest field or second grouping/timing authority.

Each PLAN is exactly `{"segments":[...]}`: existing `speaker`, verbatim source `text` and all corresponding `spans`, with no `cues` or other top-level keys and no old task-clock/cut labels. When originals include internal display segments or cues, Creator semantically prepares assembly-only PLANs under `references/epNN/episode-previs/` and preserves originals. Keep dialogue words and windows intact, including utterances that mention times or cuts; regex stripping is not semantic cleanup.

The tool rebases every span using cumulative canonical member-shot durations. For each source shot it adds `speaker: "SHOT"`, text `N [STARTs-ENDs]`, displayed throughout that shot's half-open `[start,end)` interval on the episode clock. These range labels cover all shot starts/ends, including task joins; there is no separate automatic cut-prose parser or endpoint title card. `previs-preview.py --timecode` draws elapsed `HH:MM:SS` from zero, updated once per second, not frame timecode. Offsets never accumulate rounded container durations. Creator handles real cuts inside source shots and extra annotation text semantically; preserve source timing and disclose rehearsal estimates.

Input PLAN spans stay task-local for the tool's single rebase. If Creator includes a necessary within-shot cut or extra display annotation, its text names the correct episode-global time while its spans use the corresponding task-local window; do not pre-offset spans and shift them twice. Preserve source-intended time words in dialogue as spoken, not as labels to rebase.

Concatenate the selected clean videos first, then apply the rebased captions/timecode to the complete clean assembly. Joining already burned-in caption videos would retain task-clock resets and is not this delivery. All original task clean + caption outputs and PLANs remain deliverables. Source-intended film text remains in clean; internal annotations and episode review media remain outside uploads.

Every PARTS clean video must match the saved episode width/height/fps, with verified CFR, square pixels and actual duration matching its canonical group. The tool consumes the same saved spec as the selected-media check; automatic maximum-canvas padding does not mask mismatched parts. Creator repairs incompatible exports/conversions in scope before assembly, preserving camera/framing, ratio and source clocks, and reports unresolved limits. Preserve audio where present; when only some parts have audio, fill the others with equal-duration silence. When all parts lack audio, keep the output without an audio track. No TTS or seamless independently generated J/L audio is promised.

Default to a new output. For a formal update, produce and verify a new candidate, then safely replace the formal file only within Director's existing authorized write scope and stable dependencies. A failed tool call or partial MP4 does not establish normal completion. Return current actual output path, canonical total and measured full-video duration, ordered task/shot membership, clock/cut coverage and audio/compatibility/inspection limits; do not copy old logs as current evidence. Probe/decode the actual complete output; any visual inspection follows fresh scoped tasks and helper thumbnails. Technical checks and a caption preview are not independent pass or a new acceptance stage.

Successful stdout JSON contains `output`, `ep`, `config`, `expected`, `tasks`, `shots`, `duration`, `fps`, `audio`, `dimensions` and `mapping`. `config` identifies the consumed config; `expected` is saved width/height/fps. Output is absolute; tasks/shots follow source order, duration is canonical seconds, fps a rational string and audio a boolean. Dimensions contains `width`, `picture_height`, `band_height`, `height`. Each mapping entry includes part/task identity, shots, absolute video/plan paths, canonical start/end/duration, episode-global shot timeline, input dimensions and audio presence. No padding fields apply. Treat stdout as invocation evidence, not a ledger or visual pass.

Inputs must match saved rational CFR, with an integral canonical-duration frame count that matches exactly. Shared preview checks also require even dimensions, width >= 64, square pixels and no nonzero rotation. The picture canvas is the saved width/height; total caption height adds the band. Verify actual clean/caption picture dimensions, fps and full-episode duration. Present first audio streams are aligned to video start and converted to 48 kHz stereo/AAC, padded/trimmed to canonical part duration; missing audio gets matching silence only when another part has audio. The tool checks clean and caption episode clocks before publishing. A nonzero exit reports `episode-previs:` diagnostics; temporary concat/PLAN/caption files are not formal deliverables.

## FFmpeg Previews

Preserve source cuts and editorial purpose. Apply the [grouped-task boundary preference](SKILL.md#grouped-task-references): strongly favor motivated, visibly distinct camera/view/scale between independent tasks to reduce near-identical mismatch visibility. Judge junctions by [source intent](../_meta/rules/shot-inputs.md#reference-authority). Preserve needed match compositions and essential uninterrupted contact/speech; explain choices in the existing handoff without new permission. No every-shot change, angle quota, continuity guarantee or excuse for source-conflicting identity/state. TASK is a generation unit, not a scene/act; motion may cross a hard cut without stopping or restarting. Preserve consecutive members, durations, model maximum and grants. Source redesign goes through Director/owners within the original budget; concatenation cannot silently change cuts or protected groups.

Blender animation uses its native FFmpeg movie output above. Use external FFmpeg for clip concatenation, needed transcoding, audio mixing/muxing and subsequent selective frame extraction, not Blender VSE merely to encode. Read the fixed report's verified `ffmpeg`/`ffprobe` and encoder/filter evidence; coordinate [targeted updates](#environment-check) only for actual faults, known changes or uncovered capability needs. For compatible shot clips, an authorized new full-group output can use:

```bash
ffmpeg -n -f concat -safe 1 -i references/task01/clips.txt -c copy references/task01/preview.mp4
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate -show_entries format=duration references/task01/preview.mp4
```

`clips.txt` lists relative clip paths in canonical order, for example `file 'shot01.mp4'`. Stream copy requires matching layouts, codec parameters and time bases. Otherwise use scoped re-export/conversion with a verified encoder, preserving camera/framing, ratio, durations and cuts. Formal clean output matches saved episode dimensions/fps; choose compatible source composition instead of automatic padding that conceals a wrong canvas. `-n` avoids accidental replacement; actual overwrite authority still binds. Probe and decode the assembled MP4, not only its components.

After the MP4 exists, extract only frames needed for a specific question in a fresh visual task's designated temporary directory, then run each through `review-image.py` and read only its returned preview. For example, after verifying the output directory:

```bash
ffmpeg -n -i references/task01/preview.mp4 -ss 1.2 -frames:v 1 /tmp/opencode/local-reference-TASK/at-1.2.png
```

Choose actual meaningful times, including needed motion transitions and both sides of cuts; 1.2 is illustrative. Record source MP4/fingerprint and sample times. Do not extract every frame or create a global frame-output tree. Inspect playback where supported; disclose sampled-only coverage and temporal limits. Few stills, endpoints, a process exit or ffprobe do not prove continuous motion; missing necessary temporal evidence remains unknown under existing review rules.

For segmented renders, overlays or replacement intervals, inspect the assembled full result as well as the changed segment. Sample just before, across and after each relevant join, including joins inside a source shot with no intended cut. Look for noise/denoising, lighting, color/gamma, motion/velocity and actual audio discontinuities; a clean patch or matching endpoint does not prove a seamless composite. Preserve intended cuts and sound bridges, and distinguish internal fake audio from selected media. Repair demonstrated discontinuities in the media rather than asking the final prompt to ignore them.

For task junctions, inspect selected clean MP4 tail/head windows together in one fresh scoped task, with final prompt intent and source/task clock mappings. Within the same continuous event, include enough action to judge necessary direction, possession/contact, progress, space and sound compatibility, not identical frames; endpoints alone can hide stops/restarts. For scene/act/time/place jumps, assess the intended causal, emotional, information, thematic contrast or parallel relation and viewer orientation. Preserve source-supported mystery, abruptness and hard cuts; do not force same-position, continuing action/sound, smoothing, immediate explanation or a bridge scene. Underlying identity/world facts remain source-consistent. Inspect necessary neighbors without rendering or authorizing them. Report evidence gaps and distinguish heard audio, an unassessed stream, planned bridges and fake timing. No fixed window, frame quota, required dissolve or final-video autocutting.

Internal production titles, debug labels, fake audio and timing guides belong in a separate rehearsal preview, not the uploaded reference. Clean means free of those internal annotations: source-intended film titles, SUPERs, cards, UI and transition imagery may remain under [film-text craft](../_meta/rules/transition-craft.md). Render/assemble from clips free of debug contamination; `-an` excludes audio but cannot remove burned-in labels. The required complete bottom-caption review MP4 remains internal and non-uploaded, regardless of the clean video's material mix.

Each [task manifest](../_meta/rules/shot-inputs.md) still selects at least one full-group MP4 as `kind:local,media:video`, with actual sources and use. Derive its clock from current canonical member durations; align internal cuts, camera/BOX trajectories and intended sound bridges to those intervals. Static intervals may use static clips. PNG supplements static controls; GIF is unsupported.

Rehearsal PLAN/WAV/summary are not manifest media; include actual editable dependencies in sources and review inputs as applicable, without uploading sources. Reference media is not submission authority or task completion. Inspect meaningful internal cuts and external boundaries with disclosed viewing limits, not endpoints or ffprobe alone.
