# Shot Input Contract

Run from the story project root with canonical `SVD_CONFIG` for config-dependent operations. Preparation and every paid attempt, including retries, use typed references with at least one local MP4.

## Manifest

Each actual shot has `story/episodes/{ep}/shot-inputs/shotNN.json`. The only top-level key is `references`. Each shot requires at least one local MP4; optional PNGs supplement it. A static camera/layout can render a static clip over the intended duration.

```json
{"references":[{"kind":"local","media":"video","path":"references/shot/motion.mp4","use":"Control camera, framing, layout, positions and whole-box trajectories with timing","sources":["references/shot/scene.blend"]}]}
```

Every entry has exactly `kind`, `media`, `path`, `use`, `sources`. `kind` is `local`; pairs are `image` + lowercase `.png` or `video` + lowercase `.mp4`. `use` is nonblank. `sources` is a nonempty array of actual editable inputs under `references/`; it is fingerprinted, not uploaded. Header asset declarations stay in storyboard; settings, duration and prompt remain outside the manifest.

Media paths are unique canonical project-relative files under `references/`: no absolute, empty/dot/dot-dot segments, backslashes or control characters; realpath stays within the permitted root and files are nonempty. GIF is unsupported. File checks do not prove decoding, playback, source completeness or semantic quality.

## Reference Authority

Assets provide identities and appearance. Local MP4 uses rigid, static-shape BOX proxies for people/similar actors, controlling camera, framing, scale, layout, positions and whole-object translation/rotation with timing. Detailed action, posture and expression belong in the full shot prompt for the model to realize. Boxes need no anatomy or performance; useful environment/prop geometry and static asset shape PNGs retain their declared scope.

Creator maintains one work-wide art baseline and hands it to Storyboarder for each source shot's `视频风格`. Each resolved request expresses that baseline once. Audiovisual prose contains the complete local action, expression, camera, space and sound. Reference `use` states only controls and placeholder limits. The resolver preserves the whole shot; it does not inject style or deduplicate prose.

## Resolve And Submit

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-to-prompt.sh" --json "story/episodes/ep01/storyboard.md" 1
```

The `.mjs` form takes `--json STORYBOARD SHOT EP`. Result: `{prompt,duration,references,assetCards,sources,inputPath}`. Ordered upload references are `{media,path}`: deduplicated header identity images first, then manifest media in declaration order. Image/video slots count separately. Bind declared links; undeclared links fail. Upload originals, not sources or helper previews.

Persist `prompt,duration,references` unchanged alongside actual task state and grants. Resolver metadata is for review/preparation, not provider flags.

```bash
SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/video-gen-dreamina.sh" --references-json "{prompt}" "{output}" "{references JSON array}" "{duration}" "{ratio}" "{model}" "{resolution}"
```

Seven positional arguments after the flag. Forward ordered references as `--image PATH` / `--video PATH`, subject to actual provider support. `video-task-inputs.mjs capture TASKS SHOT PROVIDER MODEL RATIO RESOLUTION` returns `{provider,model,ratio,resolution,references:[{media,path,sha256}]}`; save this real object as `submission`. Capture does not submit. Verify checks ordered media identity; gate/reserve also compare current prompt/duration/references, settings, grants and scoped evidence. Sources are bound by review inputs.

Preserve pending/receipt, grants, attempts, locks, inflight and protected submitted/done records. Retries use the stored current-contract package, never silently resolve or capture replacement inputs.

## Recorded-Task Retrieval

Retrieve submitted tasks by recorded ID/provider, preserving records, grants and media. A submitted task without a verifiable ID requires human_needed, not another paid call. Untouched pending tasks may continue under their initial grant and validated inputs; failed tasks require a retry grant. Retrieval bypasses generation configuration and readiness gates.

## Readiness And Review

Independent shot-input review focuses on actual prompt/media integration, necessary boundaries and changed details. Use current storyboard judgment unless a concrete conflict requires reopening it. A singleton writes its assigned round directly; the coordinator serializes writes to each review file. Only actually separate reviewer results need an independent aggregator. For changed bookkeeping/sources with unchanged rendered media, assess scoped compatibility against the prior basis and actual changes before issuing current evidence; never blindly refresh hashes. Every new image operation still requires a fresh task and thumbnails.

Use `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" EP [SHOT...]` for structural readiness and `review-evidence.mjs check EP [SHOT...]` for evidence. Whole-episode numbering is ordered, unique and contiguous `1..N`; selected-shot checks allow gaps, retain increasing unique source numbering and require every requested shot to exist. Interface errors are engineering blockers.

Evidence kinds are `script`, `storyboard`, `asset-prompt`, `asset-visual`, `shot-input`. Final readiness requires script/storyboard, asset-visual and shot-input; new image production separately requires current asset-prompt. Full-episode scope includes script inventory assets; selected shots include declared header assets with inventory membership checked.

Every manifest targets independent `director-review-shot-inputs` in `.review-shot-inputs.md`. Inputs include manifest/config/script/storyboard, uploaded originals, sources and asset-visual dependencies. Reviewer selects necessary story boundary pairs, including actual adjacent, nonadjacent and cross-episode dependencies, and records real inputs in existing `{path,sha256}` fingerprints. Compare prompts and MP4 positions, trajectories, key states, axis and identity. Use fresh visual tasks, helper thumbnails and minimal pairs; disclose temporal coverage. Missing necessary evidence is unknown. Mechanical coverage does not certify exhaustive continuity. No new schema, review kind or automatic recursive re-render.
