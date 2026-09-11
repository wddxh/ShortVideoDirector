# Generation Task Input Contract

Run from the story project root with canonical `SVD_CONFIG` for config-dependent operations. Preparation and every paid attempt, including retries, use typed references with at least one local MP4.

## Manifest

Creator groups consecutive photographic shots after design, preserving their current canonical positive integer durations, dialogue and cuts. Use verified model maximum M to aim for `ceil(0.7*M)..M` per generation task, as semantic packing guidance rather than a mechanical lower quota. Validate actual task-level provider limits. Unsuitable groups return to owners for redesign under the [original user episode budget](../../director-orchestrate/SKILL.md#集总时长责任), then synchronize script/storyboard and affected downstream inputs. Grouping itself does not reauthor or stretch shots; the confirmed +/-10% is usable creative scope, not a ratcheting tolerance on each revision.

When choosing independent generation TASK boundaries, prefer existing motivated cuts with a distinct camera position, viewpoint or scale when suitable. This can make near-identical independently generated mismatches less conspicuous; it does not guarantee continuity. Similar consecutive compositions may stay in one group where appropriate. Not every photographic cut starts a task, and no angle threshold applies; preserve purposeful repeated compositions, consecutive membership, current durations, actual provider maximum and grants. This preference never authorizes silent regrouping of protected tasks or source cut changes; needed redesign goes through Director and the source owner within the original budget before downstream updates.

Each group has `story/episodes/{ep}/task-inputs/taskNN.json`: a draft has exactly `{shots,references}`, and the final manifest has exactly `{shots,references,prompt}` with a nonblank string `prompt` authored by Creator. Drafts support materials preparation only, not final review or readiness. The filename supplies stable `task_id` (for example `task01`), independent of its first shot. `shots` contains ordered positive safe integers consecutive in source order. Each task requires at least one local MP4 representing the full group timeline; optional PNGs supplement it. Static camera/layout intervals can use static clips. Draft example:

```json
{"shots":[1,2],"references":[{"kind":"local","media":"video","path":"references/task01/motion.mp4","use":"Control camera, framing, layout, positions and whole-box trajectories on the task timeline, including the internal cut","sources":["references/task01/scene.blend"]}]}
```

Every reference entry has exactly `kind`, `media`, `path`, `use`, `sources`. `kind` is `local`; pairs are `image` + lowercase `.png` or `video` + lowercase `.mp4`. `use` is nonblank. `sources` is a nonempty array of actual editable inputs under `references/`; it is fingerprinted, not uploaded. Header asset declarations stay in storyboard; settings and derived duration remain outside the manifest. The final prompt lives in `manifest.prompt`, with no separate final-prompt file or ledger.

Media paths are unique canonical project-relative files under `references/`: no absolute, empty/dot/dot-dot segments, backslashes or control characters; realpath stays within the permitted root and files are nonempty. GIF is unsupported. File checks do not prove decoding, playback, source completeness or semantic quality.

Keep published JSON syntactically valid after every edit, including each operation under the 2000-character writing limit. Add complete entries or replace an entire string with correct JSON escaping; never split a published `prompt` string across unfinished patches. If a complete value cannot fit, assemble the complete document in an unpublished temporary file with bounded edits, parse it and verify the intended draft/final shape, then atomically replace the authorized target on the same filesystem. Preserve the current published file until that replacement; this needs no generic publishing framework or new status field.

## Reference Authority

Apply the full [reference/proxy authority rules](visual-prompt-craft-common.md#粗模控制与外观依据分离) to detailed source shot prose, actual media, every video ref.use and Creator-authored final manifest.prompt. Keep declared controls distinct from final appearance/performance; resolve misleading media before handoff.

Preserve [beat meaning](audiovisual-craft.md) through prompt/media integration: initial state, necessary evidence, ordering/credible overlap and attention. Optional local rehearsal may use rough BOX and fake audio timing; it changes no manifest, full-group MP4 or review contract. Internal annotations, timers and fake audio stay in separate previews, out of uploads by default. Clean selected media and final prompt must carry necessary controls without those aids; sources remain fingerprinted, not uploaded.

Creator hands one work-wide art baseline to Storyboarder for each source shot's single-line `视频风格`, and expresses it once in the final prompt. Different baselines return to owners for reconciliation; local variations belong in shot prose. Preserve complete source facts and exact dialogue. Reference `use` states controls and placeholder limits. The selected provider's material tool documents its own extraction, binding and authoring-pack syntax.

Derive task intervals from unchanged shot durations. Creator interprets source-local cues and elapsed times in context, preserving legitimate overlap and exact dialogue, and writes unambiguous task-time prose aligned with media, internal cuts and sound bridging. Source headers and local shot IDs remain internal, not model-facing timing instructions. Provider material tooling owns any syntax-specific binding and cue rebasing.

Creator applies [source trigger-to-response and task-time integration](audiovisual-craft.md#从触发到人物反应) and [global mappings plus inline use](visual-prompt-craft-common.md#全局映射与实际使用处的引用) throughout the final prompt. Reviewer checks whole-prompt binding consistency and [spatial/temporal support for reactions](../../reviewer-review-shot-inputs/SKILL.md#temporal-judgment) within existing integration review.

## Resolve And Submit

After reference video and group mapping are settled, Creator reads the selected provider's reference syntax and the materials pack, then authors the complete semantic final prompt in the manifest. Carry the common style once, narrative/action detail, exact dialogue wording, cuts, duration and audio intent. Bind actual reference tokens and explain color/BOX/body/limb/contact proxies as intended final identities, anatomy, pose and action. Remove internal task/shot IDs, source headings, paths and reviewer/production metadata. Cinematic language such as “wide shot” remains valid; no generic scanner bans the word “shot”. Missing source facts return to their owner rather than becoming invented `use` facts.

Promote a chosen candidate into the current manifest before final handoff: reconcile every selected media path, reference order/binding, `use`, editable `sources` and the complete `prompt` with the actual rendered result and current source timings. Include actual frame/clip clock mappings and joins in that check, not just nominal total duration. Retire stale candidate references within the authorized package; preserve protected submitted records and their inputs. Candidate render or inspection success does not make the current manifest ready, and an unselected candidate's evidence does not cover selected media. Use the existing draft/final forms and review inputs, without a candidate-status manifest or ledger.

Creator self-checks the actual final `--json` output, then commissions a fresh independent shot-input Reviewer for source fidelity, completeness and integration. Creator authorship supplies the prompt, not acceptance: trust it for submission only as part of the exact selected, independently reviewed package, including its actual media and source dependencies. Later prompt, selection or timing changes require current evidence under the existing scoped review rules. Submission forwards the reviewed prompt exactly, without rewriting or appending bindings.

For speech across an internal photographic cut, keep the full utterance once in its starting shot and describe its continuation/end in the following shot. Keep each leading cue within that shot's bounds; assess the entire actual speaking interval on the derived task clock. See [audiovisual craft](audiovisual-craft.md) for the source-text example and cross-task audio boundary.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-to-prompt.sh" --json "story/episodes/ep01/storyboard.md" task01 ep01
```

For authoring, use the selected provider's own material tool and documented pack/reference syntax (Dreamina: [video.md](../../creator-provider-dreamina/video.md#dreamina-authoring-materials)). It may accept a draft; successful material resolution is not final readiness. Creator reads sources, provider materials and actual refs before writing semantic `manifest.prompt`. Each future provider implements its own tool without a registry, framework or manifest-schema change. Shared assembly supplies token-free internal data, not a public universal adapter.

The generic converter's `.sh` and `.mjs` take `--json STORYBOARD TASK_ID EP`; EP must match the canonical storyboard path. They expose the finalized package without generating prompt text. Authoring-pack shape, token counting, binding and syntax-specific rebasing belong to the selected provider, not this converter.

Final `--json` requires a nonblank string `manifest.prompt` and returns `{task_id,shots,timeline:[{shot,start,end}],prompt,duration,references,assetCards,sources,inputPath}` with that exact string, without rewriting. Timeline and duration are derived; keep no editable offsets/durations or duplicate grouping index. Ordered uploads are `{media,path}`: header identity images in first-use order, then manifest media in declaration order. Reference syntax and numbering follow the selected provider's contract. Each member's explicit links must be declared in its OWN header; another member cannot legalize them. Upload originals, not sources or previews.

Keep `tasks.json` an array, unique by `task_id`, with full `shots` membership and unchanged `prompt,duration,references` alongside actual state. Store the exact final `manifest.prompt`; gate/reserve equality compares against that final manifest, not source-generated text. Output is `videos/taskNN.mp4`. Grants are `{decision,episode,task_id,shots,constraints}` plus actual optional retry counters. Before reserve/payment, current manifest membership must equal record and grant. Wrong identity, membership/input drift or partial scope makes zero calls and changes no counters. Resolver metadata is not provider flags.

```bash
SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/video-gen-dreamina.sh" --references-json "{prompt}" "{output}" "{references JSON array}" "{duration}" "{ratio}" "{model}" "{resolution}"
```

Seven positional arguments after the flag. Forward ordered references as `--image PATH` / `--video PATH`, subject to actual provider support. `video-task-inputs.mjs capture TASKS TASK_ID PROVIDER MODEL RATIO RESOLUTION` returns `{provider,model,ratio,resolution,references:[{media,path,sha256}]}`; save this real object as `submission`. Capture does not submit. Verify checks ordered media identity; gate/reserve also compare current prompt/duration/references, settings, grants and scoped evidence. Sources are bound by review inputs.

Preserve pending/receipt, grants, attempts, locks, inflight and protected submitted/done records. Retries use the stored current-contract package, never silently resolve or capture replacement inputs.

## Recorded-Task Retrieval

Retrieve submitted tasks by recorded ID/provider, preserving records, grants and media. A submitted task without a verifiable ID requires human_needed, not another paid call. Untouched pending tasks may continue under their initial grant and validated inputs; failed tasks require a retry grant. Retrieval bypasses generation configuration and readiness gates.

## Readiness And Review

Task-video integration follows the [pure-text owner and fresh visual handoffs](../../reviewer-review-shot-inputs/SKILL.md#text-owner-and-bounded-visual-handoffs): the independent owner starts before reading final prompt/timeline/manifest/source texts, plans coherent visual windows before viewing, and keeps the sole canonical round. All viewing goes to fresh scoped Reviewer helpers; the owner never loads images/contact sheets or receives image attachments. Helpers return text facts, times/frames, source paths, preview mappings and limits, not target pass or competing rounds. The owner independently judges integration/coverage and dispatches fresh bounded checks for necessary gaps; sampling is not full-motion proof. Single-asset visual leaves retain their bounded direct-view review.

The existing shot-input target fingerprint binds the complete final manifest including `prompt`. A two-key draft fails final review/readiness even when its materials resolve successfully. Use the existing five kinds and gates; no new review kind, prompt file, ledger or migration is needed.

Independent shot-input review focuses on actual prompt/media integration, necessary boundaries and changed details. Use current storyboard judgment unless a concrete conflict requires reopening it. Each target Reviewer writes its own canonical file directly. Serialize the same ep/kind/target for output ownership and order read/write and input dependencies; distinct nonconflicting ready targets run in parallel. Partial-inspection delegates return raw findings to the assigned independent target owner; no additional cross-target aggregation stage is required. For changed bookkeeping/sources with unchanged rendered media, assess scoped compatibility against the prior basis and actual changes before issuing current evidence; never blindly refresh hashes. Every new image operation still requires a fresh task and thumbnails.

Use `SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/check-shot-inputs.mjs" EP [SHOT...]` for structure and `review-evidence.mjs check EP [SHOT...]` for evidence. Whole readiness requires source `1..N`, each shot assigned once, tasks sorted by first member. Scoped sources may have gaps; requested shots must exist and select whole groups. Report unassigned requested shots and partial groups with full membership and concrete additional members, never silently expand authorization.

Evidence kinds are `script`, `storyboard`, `asset-prompt`, `asset-visual`, `shot-input`. Final readiness requires script/storyboard, asset-visual and shot-input; new image production separately requires current asset-prompt. Full-episode scope includes script inventory assets; selected shots include declared header assets with inventory membership checked.

Validate declared group overlaps and missing source members globally; scoped work does not require unselected media or a complete episode plan. Interface/schema errors go to main/general engineering, not creative workarounds.

Every task manifest targets independent `reviewer-review-shot-inputs` in `reviews/{ep}/task-inputs/taskNN.md`, resolved by `review-evidence.mjs path shot-input EP TARGET`. Keep kind `shot-input`, scope=[manifest] and one result per completed round. Inputs include manifest/config/script/storyboard, uploaded originals, sources and actual asset-visual dependencies, not a whole-plan hash. Review final integration/deltas, task clock, internal cuts, sound bridges and necessary external boundaries. Select actual adjacent, nonadjacent and cross-episode pairs; fingerprint actual dependencies as `{path,sha256}`. Compare prompts and MP4 positions, trajectories, key states, axis and identity. Use fresh visual tasks, helper thumbnails and minimal pairs; disclose temporal coverage. Missing, malformed or incomplete evidence leaves only its owning target unknown. Mechanical coverage is not exhaustive continuity; retain five review kinds.

Check/query/monitor count generation tasks. `human_needed` entries are `{ep,task_id,shots,reason}`, one per episode/task with full membership. Monitor scope remains `epNN/all`; config context and Creator relay remain explicit.
