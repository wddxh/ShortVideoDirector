# Generation Task Input Contract

Run from the story project root with canonical `SVD_CONFIG` for config-dependent operations. Preparation and every paid attempt, including retries, use typed references with at least one local MP4.

## Manifest

Creator groups consecutive photographic shots after design, preserving their positive integer durations, dialogue and cuts. Use verified model maximum M to aim for `ceil(0.7*M)..M` per generation task, as semantic packing guidance rather than a mechanical lower quota. Validate actual task-level provider limits. Unsuitable groups return to owners; grouping does not reauthor shots or extend scene/episode budgets.

Each group has `story/episodes/{ep}/task-inputs/taskNN.json`, with exactly `shots` and `references`. The filename supplies stable `task_id` (for example `task01`), independent of its first shot. `shots` contains ordered positive safe integers consecutive in source order. Each task requires at least one local MP4 representing the full group timeline; optional PNGs supplement it. Static camera/layout intervals can use static clips.

```json
{"shots":[1,2],"references":[{"kind":"local","media":"video","path":"references/task01/motion.mp4","use":"Control camera, framing, layout, positions and whole-box trajectories on the task timeline, including the internal cut","sources":["references/task01/scene.blend"]}]}
```

Every entry has exactly `kind`, `media`, `path`, `use`, `sources`. `kind` is `local`; pairs are `image` + lowercase `.png` or `video` + lowercase `.mp4`. `use` is nonblank. `sources` is a nonempty array of actual editable inputs under `references/`; it is fingerprinted, not uploaded. Header asset declarations stay in storyboard; settings, duration and prompt remain outside the manifest.

Media paths are unique canonical project-relative files under `references/`: no absolute, empty/dot/dot-dot segments, backslashes or control characters; realpath stays within the permitted root and files are nonempty. GIF is unsupported. File checks do not prove decoding, playback, source completeness or semantic quality.

## Reference Authority

Assets primarily provide identity/appearance, style, image quality and materials. Local MP4 may supply perspective, spatial occlusion, camera, framing, scale, layout, positions and timed whole-object translation/rotation; asset stills need not duplicate those shot-specific controls. Local MP4 uses rigid, static-shape BOX proxies for people/similar actors. Detailed action, posture and expression belong in the full shot prompt for the model to realize. Boxes need no anatomy or performance; useful environment/prop geometry and static asset shape PNGs retain their declared scope. Preserve plot-critical identifiable features/actions and explicit user requirements across these roles.

Creator hands one work-wide art baseline to Storyboarder for each source shot's single-line `视频风格`. The resolver emits the exact identical parsed field once at task level and removes only that field from member blocks. Different baselines block assembly for owner reconciliation; local variations belong in shot prose. Preserve all other fields, exact dialogue, spaces and continuation lines, with declared asset bindings. Reference `use` states controls and placeholder limits.

Derive task intervals from unchanged shot durations. Rebase only leading structural `[0s-2.5s]` cues by each shot's start offset, validating `0 <= start < end <= shot duration`; legitimate overlap is allowed. Inline numbers, duration phrases and speech stay unchanged. Explicitly state in the final prompt that bracketed cues use task time and inline elapsed times remain local to the named shot. Creator aligns media, internal cuts and sound bridging to this coherent task reference clock; converter performs no model-driven rewriting.

## Resolve And Submit

For speech across an internal photographic cut, keep the full utterance once in its starting shot and describe its continuation/end in the following shot. Keep each leading cue within that shot's bounds; assess the entire actual speaking interval on the derived task clock. See [audiovisual craft](audiovisual-craft.md) for the source-text example and cross-task audio boundary.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-to-prompt.sh" --json "story/episodes/ep01/storyboard.md" task01 ep01
```

Both `.sh` and `.mjs` forms take `--json STORYBOARD TASK_ID EP`; EP must match the canonical storyboard path. Result: `{task_id,shots,timeline:[{shot,start,end}],prompt,duration,references,assetCards,sources,inputPath}`. Timeline and duration are derived; keep no editable offsets/durations or duplicate grouping index. Ordered uploads are `{media,path}`: union of header identity images in first-use order, then manifest media in declaration order. Image/video slots count separately. Each member's explicit links must be declared in its OWN header; another member cannot legalize them. Upload originals, not sources or previews.

Keep `tasks.json` an array, unique by `task_id`, with full `shots` membership and unchanged `prompt,duration,references` alongside actual state. Output is `videos/taskNN.mp4`. Grants are `{decision,episode,task_id,shots,constraints}` plus actual optional retry counters. Before reserve/payment, current manifest membership must equal record and grant. Wrong identity, membership/input drift or partial scope makes zero calls and changes no counters. Resolver metadata is not provider flags.

```bash
SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/video-gen-dreamina.sh" --references-json "{prompt}" "{output}" "{references JSON array}" "{duration}" "{ratio}" "{model}" "{resolution}"
```

Seven positional arguments after the flag. Forward ordered references as `--image PATH` / `--video PATH`, subject to actual provider support. `video-task-inputs.mjs capture TASKS TASK_ID PROVIDER MODEL RATIO RESOLUTION` returns `{provider,model,ratio,resolution,references:[{media,path,sha256}]}`; save this real object as `submission`. Capture does not submit. Verify checks ordered media identity; gate/reserve also compare current prompt/duration/references, settings, grants and scoped evidence. Sources are bound by review inputs.

Preserve pending/receipt, grants, attempts, locks, inflight and protected submitted/done records. Retries use the stored current-contract package, never silently resolve or capture replacement inputs.

## Recorded-Task Retrieval

Retrieve submitted tasks by recorded ID/provider, preserving records, grants and media. A submitted task without a verifiable ID requires human_needed, not another paid call. Untouched pending tasks may continue under their initial grant and validated inputs; failed tasks require a retry grant. Retrieval bypasses generation configuration and readiness gates.

## Readiness And Review

Independent shot-input review focuses on actual prompt/media integration, necessary boundaries and changed details. Use current storyboard judgment unless a concrete conflict requires reopening it. Each target Reviewer writes its own canonical file directly; serialize only rechecks of the same ep/kind/target. Partial-inspection delegates return raw findings to the assigned independent target owner, with no mandatory aggregator. For changed bookkeeping/sources with unchanged rendered media, assess scoped compatibility against the prior basis and actual changes before issuing current evidence; never blindly refresh hashes. Every new image operation still requires a fresh task and thumbnails.

Use `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" EP [SHOT...]` for structure and `review-evidence.mjs check EP [SHOT...]` for evidence. Whole readiness requires source `1..N`, each shot assigned once, tasks sorted by first member. Scoped sources may have gaps; requested shots must exist and select whole groups. Report unassigned requested shots and partial groups with full membership and concrete additional members, never silently expand authorization.

Evidence kinds are `script`, `storyboard`, `asset-prompt`, `asset-visual`, `shot-input`. Final readiness requires script/storyboard, asset-visual and shot-input; new image production separately requires current asset-prompt. Full-episode scope includes script inventory assets; selected shots include declared header assets with inventory membership checked.

Validate declared group overlaps and missing source members globally; scoped work does not require unselected media or a complete episode plan. Interface/schema errors go to main/general engineering, not creative workarounds.

Every task manifest targets independent `reviewer-review-shot-inputs` in `reviews/{ep}/task-inputs/taskNN.md`, resolved by `review-evidence.mjs path shot-input EP TARGET`. Keep kind `shot-input`, scope=[manifest] and one result per completed round. Inputs include manifest/config/script/storyboard, uploaded originals, sources and actual asset-visual dependencies, not a whole-plan hash. Review final integration/deltas, task clock, internal cuts, sound bridges and necessary external boundaries. Select actual adjacent, nonadjacent and cross-episode pairs; fingerprint actual dependencies as `{path,sha256}`. Compare prompts and MP4 positions, trajectories, key states, axis and identity. Use fresh visual tasks, helper thumbnails and minimal pairs; disclose temporal coverage. Missing, malformed or incomplete evidence leaves only its owning target unknown. Mechanical coverage is not exhaustive continuity; retain five review kinds.

Check/query/monitor count generation tasks. `human_needed` entries are `{ep,task_id,shots,reason}`, one per episode/task with full membership. Monitor scope remains `epNN/all`; config context and Creator relay remain explicit.
