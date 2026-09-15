# Video Submission And Retrieval

Before config reads or preparation, obtain canonical project-relative config_path with `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`. In-project absolute/./ paths normalize; external config is unsupported before related side effects. Pass the same path explicitly as SVD_CONFIG on every profile/capture/submission/evidence command and through relay; fingerprints and config/approval writes use it too. Pure recorded-job retrieval bypasses config validation entirely.

New submissions/retries belong to an actual Creator task, not a checker loading this skill. Consume canonical episode/task_id/full shots, task paths and real grants. Preserve membership, prompt/references/duration/submission and grants; `pending` and `failed` alone authorize nothing. Records are an array unique by task_id; output is `videos/taskNN.mp4`. Grants bind `{decision,episode,task_id,shots,constraints}` plus actual optional retry counters.

Current explicit `视频提供方: none` disables new submissions/retries but not retrieval. Report the block without changing the stored tuple; changed config cannot silently switch an existing task's provider or settings.

Before preparation writes, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/video-task-inputs.mjs" profile TASKS` with canonical SVD_CONFIG. It is read-only even when TASKS is absent. Nonzero blocks preparation. `{mode,profile,source}` distinguishes series `tasks` inheritance, first-choice `config` (null fields require delegation), and short `episode` (profile=null). Resolve authorized first-choice fields, then capture returns the snapshot to persist. Retries and untouched pending use saved settings and ordered media identities, without re-resolving/capturing or guessing defaults.

Each paid attempt requires typed references and at least one full-group local MP4. Validate saved settings, operation, task duration and references against actual capabilities. Check grants with `video-task-inputs.mjs initial/retry TASKS TASK_ID EP`, media with `verify TASKS TASK_ID`, and structure with `check-shot-inputs.mjs EP SHOT...` for all members, using the same SVD_CONFIG. Require scoped evidence, converter equality and canonical output. Current manifest membership must equal record/grant; wrong identity, membership/input drift or partial scope makes zero calls and changes no counters. Report full group/additional members, never silently expand selection.

```bash
SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/video-gen-dreamina.sh" --references-json "{prompt}" "{output}" "{references JSON array}" "{duration}" "{submission.ratio}" "{submission.model}" "{submission.resolution}"
```

Exactly seven positional arguments follow `--references-json`; references is one JSON array of `{media,path}`. Forward ordered PNG/MP4, dreamina to reserve and actual resolution; sources do not upload. Read [shot inputs](../_meta/rules/shot-inputs.md). Retrieve submitted tasks by recorded ID/provider. Use the guarded wrapper with approved inputs/settings.

Creator groups consecutive photographic shots after design, preserving durations, dialogue and cuts. With verified model maximum M, aim for `ceil(0.7*M)..M` per task as semantic packing guidance, not a lower quota. Provider limits, including the hard maximum, apply to tasks, not photographic-shot minimums. Do not extend shot/scene/episode runtime during assembly or submission. Unsuitable groups return through Director to owners, who may revise canonical script/storyboard within the original confirmed episode budget, including net growth, then synchronize affected downstream inputs and obtain current relevant reviews before returning to preparation. This does not expand the original bound, actual grants or protected-record permissions.

The model sees final prompt and uploads. Draft manifests are exactly `{shots,references}`; finals exactly `{shots,references,prompt}` in `task-inputs/taskNN.json`. After reference video/group mapping, Creator reads canonical sources, Dreamina materials below and actual refs, then authors complete task-time `manifest.prompt` before review. Preserve narrative/action, exact dialogue/film words, cuts, duration and audio; map actual BOX/color/body/limb proxies to final identity/anatomy/action. Remove only non-film source headings, internal IDs/paths and reviewer metadata; retain intentional screen titles. Missing facts return to owners; sources do not upload. Self-check actual final `--json STORYBOARD TASK_ID EP`, then obtain fresh shot-input review of fidelity, completeness and integration. Drafts cannot pass final review/readiness.

The source shot ends at the next ATX heading, standalone `---`, line-start HTML comment or EOF. Authors keep scene budgets and production notes outside those boundaries; materials preserve internal text and headers, extract common style and rebase leading cues. Creator interprets local time in the final task clock without changing facts or dialogue. Final `--json` requires a nonblank string and returns manifest.prompt exactly. Entry preparation stores that string in tasks.json; gate/reserve compare final-manifest prompt/duration/references, not source-generated text. Submitted/done/inflight and submission snapshots stay protected.

For each task, Creator applies [independent semantic authorship](../_meta/rules/visual-prompt-craft-common.md#每任务独立语义写作) to actual shots, refs, events, dialogue and clock, personally writing the complete prompt and every locally applicable `ref.use`. Synchronize uses with prompt revisions. Express the shared baseline; meaningful closing global restatement and accurate common facts across tasks are valid. Materials still extract identical source style once. A formula may organize writing, but COMMON finished headers/footers, script fill/template slots and indiscriminate conditional rules cannot replace semantic authorship. Scripts may extract/present, number, protect/validate, batch-serialize independently authored complete drafts and read exact text; they do not compose task semantics.

## Dreamina Authoring Materials

Apply the [official guide scope](../_meta/rules/visual-prompt-craft-common.md#官方指南适用范围): recommendations 1–4/7 and only transitions from 5 take precedence within scope; 6 and extend operations are excluded. Under [task prompt organization](../_meta/rules/visual-prompt-craft-video.md#任务提示组织), introduce actual numbered materials/purposes, give a one-sentence overview of this task's subjects, setting, core event, genre/style and designed special camera movement, then unfold its task-time story. Pair physical action with source-supported key emotion, subtext or intent, preserving exact dialogue, film words, cuts and audio. Non-character passages describe visual change and narrative purpose. An optional closing passage may restate necessary global style/identity/constraints without globalizing local action. The formula sets no fixed headings, length or detail quota.

For chosen transitions, write A end state -> trigger -> process -> B start state using actual views/subjects, with necessary direction, scale, timing and sound. Hard cuts switch instantly; sequential fade-black/appearance and overlapping cross-dissolve have distinct clocks. Keep the selected source transition and its budget; concrete conflicts go to owners, not arbitrary replacement or added seconds. Preserve valid abruptness and source-supported sound relations without promising seamless independently generated audio.

Apply [transition and film-text craft](../_meta/rules/transition-craft.md): source-intended UI, SUPERs/cards and transition images are valid clean-reference content; internal debug titles and rehearsal captions are not. Optional local text guides use the existing media and binding contract. Judge current model/operation support concretely rather than banning text based on a weak-model assumption. Correct source/local typography and accepted inputs do not guarantee generated wording, glyphs or timing; disclose supported postproduction needs without claiming completion or extra authority.

Run the provider-owned read-only tool from the story project root:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/storyboard-materials-dreamina.mjs" STORYBOARD TASK_ID EP
```

Exactly three positional arguments, with no mode flags. EP matches the canonical storyboard path; TASK_ID comes from the manifest filename. The module exports `resolveDreaminaMaterials`. Draft and final manifests both resolve to a JSON authoring pack, never a generated or accepted final prompt:

```text
{task_id,shots,timeline:[{shot,start,end}],duration,references,assetCards,sources,inputPath,
 materials:{style,shotBlocks:[{shot,block}],referenceSlots}}
```

The pack has no `prompt`. Common fields describe resolved membership, derived time, ordered uploads and source dependencies. Dreamina owns `materials` and its syntax: identity slots are `{media,path,slot,name,markdown}`; local slots are `{media,path,slot,use}`. `slot` is the actual Dreamina token. Bound source links use `[name:{图片N}]` (or the corresponding media token); for example `[阿明](assets/characters/阿明.md)` becomes `[阿明:{图片1}]`. `materials.style` retains the full single-line `- 视频风格：...` field, with its declared links bound before extraction. These internal source forms assist Creator's semantic authoring, not automatic final-prompt concatenation. This authoring pack is not a universal provider adapter or a new manifest schema.

Any shared assembler supplies token-free internal source/reference data only. Dreamina's resolver owns reference counting, source-link binding and cue rebasing for its materials. A future provider implements its own material tool and documents its own pack/syntax without a registry, framework or shared manifest-schema change.

## Video Reference Bindings

Dreamina's current interface convention, empirically confirmed by the user, uses exact `{图片1}` / `{视频1}` tokens with ASCII braces, not `@图片1` / `@视频1`. CLI help does not specify token parsing; this is a user-confirmed interface contract, not a claim about public documentation.

Dreamina's material tool assigns `{图片N}` / `{视频N}` from ordered resolved `references`, with independent 1-based counters for images and videos. Header identity images remain first in first-use order, followed by local media in manifest order. Local PNGs continue the image counter; MP4s use the video counter. Thus `[identity PNG, local MP4, local PNG]` binds `{图片1}`, `{视频1}`, `{图片2}` respectively, not a shared media index or local-only numbering. Each binding carries its actual identity or declared control/use; filenames and vague attachment descriptions do not replace tokens.

Materials expose the actual ordered slots and bound source links. Creator uses them to author these Dreamina tokens in manifest.prompt, including identity and declared local controls; this is not a claim of provider-neutral syntax support. Review the complete final prompt and bindings before preparation. Final converter output passes the manifest string unchanged; no slot guesses, renumbering or submission-time additions. Corrections belong to Creator's final prompt or the relevant source owner and current review. The target manifest fingerprint binds final text; preserve runner/wrapper passthrough.

Dreamina materials extract the identical parsed single-line `视频风格` into `materials.style`, removing only that field from members; differing baselines return to owners. `shotBlocks` retain source headers, all other fields, exact dialogue, spaces, continuation lines and prose. Bind each source link only through its own shot header declarations. Rebase only leading structural bracket cues such as `[0s-2.5s]` by the derived shot start, validating `0 <= start < end <= shot duration` and allowing legitimate overlap. Inline numbers, duration phrases and speech remain unchanged; Creator interprets their shot-local meaning in final task-time prose.

### Inline Use In Task-Time Prose

In both `ref.use` and final prompt, map each actual token/purpose and video-local interval to its task-use interval and adopted dimensions. Declare a same-clock full-group mapping directly; static images have applicable task intervals, not playback clocks. Local action references govern only their stated phases, not a full-task loop. Use actual `{图片N}` / `{视频N}` slots when authoring; official guide notation is not a script replacement rule or submission-time rewrite.

Assign authority by actual purpose, not all-video BOX assumptions. Coarse white models can supply a dynamic skeleton for trajectories, camera, staging, lighting and cuts; prefer limbless/wingless BODYBOX for ordinary movement and map proxy colors/shapes to assets. With necessary limb/wing references, final prose gives the relevant complete action sequence and phase roles, without a local detailed rig. Suitable detailed models may supply existing structure/materials or only spatial relationships without copied action. Write each entry's actual adopted controls and local limits; remove internal trajectory lines, coordinates, camera cones and debug labels from uploads while retaining intended film text. See [proxy authority](../_meta/rules/visual-prompt-craft-common.md#粗模控制与外观依据分离).

Apply the full [global mappings and inline use rules](../_meta/rules/visual-prompt-craft-common.md#全局映射与实际使用处的引用) with `{图片N}` / `{视频N}` in task-time prose, following [source performance integration](../_meta/rules/audiovisual-craft.md#从触发到人物反应) and [reference/proxy authority](../_meta/rules/visual-prompt-craft-common.md#粗模控制与外观依据分离).

Illustrative excerpt only, not a complete production prompt: assume actual image slots 1/2 are 阿岚/小舟 and video slot 1 contains a five-second cyan/orange BODYBOX staging reference with a cut at second 3. The source already establishes an indoor meeting, the quoted line and response. Production uses its own full source facts, style, sound, times and references:

```text
本任务0–5秒，阿岚的身份外观用{图片1}，小舟用{图片2}；{视频1}的0–5秒对应本任务0–5秒，青色代理对应阿岚、橙色代理对应小舟，仅采用相机、布局、整体轨迹与切点，人物表演按下文。
室内会面中，阿岚给出承诺，小舟得到期待的回应，带着欣喜靠近阿岚。
[0s-3s] 按{视频1}此段固定双人中景，阿岚在画面左侧、小舟在右侧。阿岚{图片1}对小舟{图片2}说：“我答应你。”小舟听到“答应”后，注意留在阿岚身上，原先等待确认的态度转为欣喜，笑出来。
[3s-5s] 按{视频1}在3秒切到小舟的中近景并保持该段前移轨迹。小舟{图片2}带着刚获回应的欣喜向画外左侧的阿岚{图片1}靠近；小舟迈步时重心随步伐前移，笑意延续，依照文字表演而非复制盒体滑移。
```

The excerpt demonstrates interval/dimension mapping, story intent and binding through a cut, not required smiling, approach, face coverage or added contact. It is not a reusable COMMON passage; Creator independently authors each task's complete prompt and uses. Source owners determine facts and camera design; absent support returns to them rather than being supplied by the example.

## Series And Episode Profiles

Capture returns `{provider,model,ratio,resolution,references:[{media,path,sha256}]}` as submission. Verify checks ordered media identity; gate/reserve compare current prompt/duration/references and script/storyboard/asset-visual/shot-input evidence. Final readiness excludes asset-prompt; authorized new/regenerated images separately require it. Retry preserves these fields; submitted/done records remain protected.

Series shares provider/model/ratio/resolution across every episode. All canonical episode tasks participate, including prepared pending, submitted/done/failed, inflight, and the selected task's own snapshot. Inherit any consistent existing profile even with no previous episode tasks. Never reselect a sole pending snapshot. Historical incomplete/conflicting tuples block preparation and paid attempts, not retrieval. Only untouched pending without submission/submit_id/inflight is ignored. Fixed actual config must match inheritance; provider=none blocks new work. No snapshots means actual fixed config plus explicit video delegation, not defaults. Duration, content, references and grants are never inherited.

Serialize series profile checks, preparation writes and submissions across episodes. The existing episode locks are not a global transaction; do not claim atomic cross-episode updates.

For short mode, resolve one common `resolution + ratio` for all episode generation tasks. Read all submissions, including tasks outside the requested subset. Before capture, Creator may resolve unsupported NEW choices in explicitly delegated fields within scope and common output constraints without reasking. Fixed values and persisted profiles remain binding; incompatibility stops affected preparation/submission and escalates only when owner judgment cannot resolve it within authority. Only short allows different provider/model between generation tasks with the common output; no per-shot downgrade.

Capture and gate/reserve recheck the series four-tuple or short episode output profile under the local episode lock. Rejection leaves records and retry counts unchanged and makes no provider call. Only in short mode may authorized pending preparation replace its own profile without conflict with other tasks. Protected tasks cannot be rewritten. Unknown historical ratio/resolution blocks new generation in short too; retrieval remains available.

Matching flags ensure the requested resolution tier and ratio, not exact pixel geometry or subjective clarity. No per-shot quality settings, automatic conversion/transcoding, codec policy or AI quality review is added.

## Reservation And Outcome

Revalidate grants internally without asking again for each permitted attempt. Repeated original-input retries may use a still-valid ongoing grant; initial-only grants do not authorize retries or changed inputs. New blockers go first to current records/config and the commissioning Director/owner for an in-authority resolution. Only a real missing authority, unresolved consequential conflict or user checkpoint requires a decision packet; keep stored-input, inflight and separate video-entry boundaries.

Use the saved settings without financial-budget, credit/balance or cheapest-option preflight and without savings-driven downgrades. Honor actual user-supplied limits and report real account/provider failures. Grant constraints need no cost field; this does not waive initial/retry authorization, scope or inflight protection. New creative inputs return to Director for adequate intake and scoped authorization, not provider-side invention.

Read `initial_authorization` and `retry_authorization` from each task, preserving the actual request and constraints. The entry records the user's manual generate-video request as the initial decision for resolved shots; Creator consumes it without another permission question. A bare path, review pass or short/series request is not a video grant. Check/auto only continue registered grants; initial intent never implies unlimited retries. Keep this persisted gate rather than bypassing it because the request was explicit.

The wrapper alone reserves inflight and settles submission outcomes atomically. Preserve grants and attempts; initial submission consumes no retry attempt. Re-read results, do not write a duplicate status update. Submitted/done and any inflight are protected. A submit lock blocks preparation/submission; never clear it or an intent merely because it is old.

`SUBMITTED id` means persisted acceptance, not download. `FAIL submission_gate` made no provider call. `FAIL submission_unknown` or `FAIL settlement_unknown` retains intent for human reconciliation, not automatic retry. Concurrency failures stop further batch submission; untouched pending retain their inputs and initial authorization, not failed status. Return actual submitted/failed/skipped targets, raw errors and unresolved intents to the commissioning checker or entry.

## Retrieval Knowledge

Pure query/download stays in the checker and needs no generation capability, credit, current materials or review gate. Route using recorded ID/provider. Missing or unknown provider requires human_needed, preserving the record without guessing. Counts are generation tasks; human_needed is `{ep,task_id,shots,reason}` with full membership.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/video-check-dreamina.sh" "{submit_id}" "{recorded_output}"
```

`success`/0 means this id downloaded; `querying`/1 is normal waiting; `fail:reason`/0 is terminal generation failure; `error:reason`/2 is a retrieval error retaining submitted/id. Before checker writeback re-read and confirm the id is unchanged. Existing MP4 alone cannot prove this task succeeded. Failed download retries the same id, never a paid regeneration. Missing settings do not block retrieval or justify fabricating a snapshot.
