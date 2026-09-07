# Video Submission And Retrieval

Before config reads or preparation, obtain canonical project-relative config_path with `node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" config-path`. In-project absolute/./ paths normalize; external config is unsupported before related side effects. Pass the same path explicitly as SVD_CONFIG on every profile/capture/submission/evidence command and through relay; fingerprints and config/approval writes use it too. Pure recorded-job retrieval bypasses config validation entirely.

New submissions/retries belong to an actual Creator task, not a checker loading this skill. Consume canonical episode/shots, task paths and real grants from the commission. Do not refresh prompt/images/duration/submission or create grants. `pending` and `failed` alone authorize nothing.

Current explicit `视频提供方: none` disables new submissions/retries but not retrieval. Report the block without changing the stored tuple; changed config cannot silently switch an existing task's provider or settings.

Before any preparation writes, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/video-task-inputs.mjs" profile TASKS` with the actual `SVD_CONFIG` (or config.md). It is read-only even when TASKS does not exist. Nonzero blocks preparation. JSON `{mode,profile,source}` distinguishes inherited series `tasks`, first-choice `config` (null fields require existing explicit delegation), and short `episode` (profile=null). Resolve only first-choice fields during authorized preparation, then use `capture TASKS SHOT PROVIDER MODEL RATIO RESOLUTION`. Capture returns a snapshot to persist as submission, not a write. Retries and untouched pending use saved settings and ordered image identities, never re-resolve/capture or guess defaults.

Before each paid attempt, validate the saved tuple, operation, duration and references against fresh capability knowledge. Unsupported or unwired providers block without substitution. Check real initial/retry grants and their semantic constraints with `video-task-inputs.mjs initial/retry TASKS SHOT EP`; verify input identity with `verify TASKS SHOT`, and run `detect-legacy-kf.sh EP STORYBOARD TASKS`. Current scoped material review, converter equality and canonical output remain required. Capability checks never replace these gates.

```bash
SVD_CONFIG="{config_path}" bash "${CLAUDE_PLUGIN_ROOT}/scripts/video-gen-dreamina.sh" "{prompt}" "{output}" "{images}" "{duration}" "{submission.ratio}" "{submission.model}" "{submission.resolution}"
```

Exactly seven arguments; images remain one ordered CSV. The wrapper supplies provider `dreamina` to reserve and forwards resolution. Never call raw generation CLI or silently change approved shots/settings.

The model's context is exactly the saved request text plus supplied images. The converter prefixes real reference bindings and sheet interpretation, then preserves the complete current shot: heading, all seven fields including duration, voice text, every prose/timecode and custom local text. Only source asset Markdown links change to `[name:{图片N}]`. Header `出场人物`/`引用资产` declarations define the uploaded set: current sheet first, then assets deduplicated in declaration order. Prose links use the same declared-path slots; undeclared explicit asset links fail before output, never guessed from nouns.

Sheet labels locate reference panels, while the video depicts their full-frame scene content. The shot ends at the next ATX heading, standalone `---`, line-start HTML comment or EOF. Authors keep scene budgets and trailing production notes outside those boundaries; the converter does not strip text within the shot or reconstruct selected fields. Semantic gaps return to the author/reviewer, not a provider-side rewrite. Current converter equality blocks stale field-selected or unbound-link tasks; authorized preparation belongs to the entry, with submitted/done/inflight records protected.

## Series And Episode Profiles

Series shares provider/model/ratio/resolution across every episode. All canonical episode tasks participate, including prepared pending, submitted/done/failed, inflight, and the selected task's own snapshot. Inherit any consistent existing profile even with no previous episode tasks. Never reselect a sole pending snapshot. Historical incomplete/conflicting tuples block preparation and paid attempts, not retrieval. Only untouched pending without submission/submit_id/inflight is ignored. Fixed actual config must match inheritance; provider=none blocks new work. No snapshots means actual fixed config plus explicit video delegation, not defaults. Duration, content, references and grants are never inherited.

Serialize series profile checks, preparation writes and submissions across episodes. The existing episode locks are not a global transaction; do not claim atomic cross-episode updates.

For short mode, resolve one common `resolution + ratio` for the entire episode, not per-shot quality. Read all participating submissions, including shots outside the requested subset. Before capture, an unsupported NEW choice in explicitly delegated fields may be resolved by Creator within the existing scope and common output constraints, without reasking. Fixed values and persisted profiles cannot be substituted: incompatibility stops affected preparation/submission and escalates only when owner judgment cannot resolve it within authority. Only short allows different provider/model with the common output; no per-shot downgrade.

Capture and gate/reserve recheck the series four-tuple or short episode output profile under the local episode lock. Rejection leaves records and retry counts unchanged and makes no provider call. Only in short mode may authorized pending preparation replace its own profile without conflict with other tasks. Protected tasks cannot be rewritten. Unknown historical ratio/resolution blocks new generation in short too; retrieval remains available.

Matching flags ensure the requested resolution tier and ratio, not exact pixel geometry or subjective clarity. No per-shot quality settings, automatic conversion/transcoding, codec policy or AI quality review is added.

## Reservation And Outcome

Revalidate grants internally without asking again for each permitted attempt. Repeated original-input retries may use a still-valid ongoing grant; initial-only grants do not authorize retries or changed inputs. New blockers go first to current records/config and the commissioning Director/owner for an in-authority resolution. Only a real missing authority, unresolved consequential conflict or user checkpoint requires a decision packet; keep stored-input, inflight and separate video-entry boundaries.

Use the saved settings without financial-budget, credit/balance or cheapest-option preflight and without savings-driven downgrades. Honor actual user-supplied limits and report real account/provider failures. Grant constraints need no cost field; this does not waive initial/retry authorization, scope or inflight protection. New creative inputs return to Director for adequate intake and scoped authorization, not provider-side invention.

Read `initial_authorization` and `retry_authorization` from each task, preserving the actual request and constraints. The entry records the user's manual generate-video request as the initial decision for resolved shots; Creator consumes it without another permission question. A bare path, review pass or short/series request is not a video grant. Check/auto only continue registered grants; initial intent never implies unlimited retries. Keep this persisted gate rather than bypassing it because the request was explicit.

The wrapper alone reserves inflight and settles submission outcomes atomically. Preserve grants and attempts; initial submission consumes no retry attempt. Re-read results, do not write a duplicate status update. Submitted/done and any inflight are protected. A submit lock blocks preparation/submission; never clear it or an intent merely because it is old.

`SUBMITTED id` means persisted acceptance, not download. `FAIL submission_gate` made no provider call. `FAIL submission_unknown` or `FAIL settlement_unknown` retains intent for human reconciliation, not automatic retry. Concurrency failures stop further batch submission; untouched pending retain their inputs and initial authorization, not failed status. Return actual submitted/failed/skipped targets, raw errors and unresolved intents to the commissioning checker or entry.

## Retrieval Knowledge

Pure query/download stays in the checker and needs no generation capability, credit or current-review gate. Route using the recorded provider. A provider-less historical Dreamina job may use this retrieval-only compatibility path; an unknown explicit provider must not silently route here.

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/video-check-dreamina.sh" "{submit_id}" "{recorded_output}"
```

`success`/0 means this id downloaded; `querying`/1 is normal waiting; `fail:reason`/0 is terminal generation failure; `error:reason`/2 is a retrieval error retaining submitted/id. Before checker writeback re-read and confirm the id is unchanged. Existing MP4 alone cannot prove this task succeeded. Failed download retries the same id, never a paid regeneration. Missing settings do not block retrieval or justify fabricating a snapshot.
