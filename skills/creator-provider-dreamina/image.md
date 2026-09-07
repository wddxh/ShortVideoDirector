# Image Execution And Recovery

Resolve canonical source/output scope before writes/payment. Paths identify targets, not overwrite permission. Separate retrieval, missing-output generation and authorized replacement. None disables new submission only. Basic/derived asset production obeys creator-generate-images evidence gates; diagnosis is not payment authority.

## Pending First

Read `assets/images/pending.json` and match only commissioned asset/card paths, retaining recorded `submit_id`, source and `output_path`. A missing current card or changed config/review does not block retrieval. Only retrieval-only commissions return on empty matches. For new-generation commissions, no matching pending means continue to config, evidence and authorization checks below, not skip generation. Route existing jobs by recorded provider; absent provider in historical Dreamina-only records permits Dreamina retrieval only, while unknown explicit provider blocks without modifying the record.

Query `dreamina query_result --submit_id="{id}" --download_dir="{download_dir}"`. On success move that job's `{id}_image_1.png` to its recorded output; confirm actual download/move before settlement. On terminal fail retain the raw reason. Querying, CLI errors and failed downloads/moves retain pending for the same id, never paid replacement. Choose bounded polling appropriate to the commission, report still-pending work rather than invent a universal creative retry budget.

When a `.generation.json` receipt is present, run `node "${CLAUDE_PLUGIN_ROOT}/scripts/image-generation-record.mjs" settle "{output}" done "{id}"` after download, or `failed` for terminal failure, before removing pending. Settlement uses its saved tuple; retrieval preserves config/card settings. Failed settlement retains pending. Records without receipts are retrieved by actual ID/output without fabricating metadata.
Remove a terminal record with `node "${CLAUDE_PLUGIN_ROOT}/scripts/image-pending-state.mjs" remove "{output}" "{id}"` only after the above result handling; the ID guard preserves another job at that output. Retrieval-only returns immediately, regardless of terminal outcome: no force, coordinator resume or missing-output generation. Nonterminal pending blocks another submit to that output.

### Receipt-Only Recovery

The wrapper saves a usable returned ID as `received` and indexes pending before downloading success or handling querying/unknown responses. Successful download settles `done` with the output hash before removing matching pending; querying settles `pending`, unknown status or failed download/missing URL settles `unknown` while retaining pending. A confirmed terminal provider failure settles `failed` with its ID, then removes only matching output/ID pending, including entries registered before the separate query. Failed settlement or query errors retain pending; no replacement is submitted by terminal cleanup.

Persistence failures return `FAIL`/1 with `submit_id=...` for explicit recovery, never `OK` or `PENDING` readiness. Receipt/index failure stops further query/download; a later settlement failure leaves pending unresolved even if a PNG exists. Missing IDs stay `unknown`, block ordinary resubmission, and cannot use known-ID receipt recovery; only the bounded exception below applies. If even the receipt write failed, retain the reported ID and reconcile the exact output/source manually; the helper does not invent missing receipt data.

Both text2image and image2image submit with `--poll=0`. A returned ID without status is saved in receipt and pending before one separate `query_result --submit_id="{id}"`; immediate success may download, querying returns `PENDING`/2. Query ret 1015/nonzero, unknown status and download errors retain the same ID, never enter missing-ID retry. A submit response already containing success/querying uses that result after persistence without another query.

### Missing-ID Exception

Only when submission returned no usable ID, or an interrupted `prepared` attempt has no recoverable ID, may the owner explicitly use `--retry-missing-id`. Each invocation permits one additional submit, never a loop; at most two additional missing-ID attempts (three total for the original unknown submission). The receipt persists `missing_id_retries` before each retry and retains raw `missing_id_responses`; restarts, force and ordinary reprepare do not reset them. Exhaustion stops without provider calls. Remote duplicates are possible and must be reported.

Before opting in, inspect scoped pending, receipt, adjacent receipt `.tmp` files and local logs/download evidence for a usable ID. If known, retrieve that exact job, do not replace it. The flag confirms no active owner, especially for old `prepared` receipts; it never clears claims/locks. The wrapper blocks local output or unresolved temporary ID evidence, requiring scoped reconciliation. Do not delete active claims/locks or erase evidence/counts. User one-attempt means no extra invocation; a two-attempt limit permits only one opt-in. This narrow uncertainty budget is separate from quality repairs, which still have no default round cap.

If pending indexing failed, inspect only the commissioned output's adjacent `.generation.json`. After confirming no active owner and reconciling any stale output claim/pending lock, restore the recorded job with:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/image-pending-state.mjs" recover "{source}" "{output}"
```

This local action performs no provider calls. It requires an exact source/output match and a known `submit_id` in a `received`, `pending` or `unknown` receipt. It preserves the receipt and saved settings, takes the output claim and pending mutex, and rejects conflicting pending identity/settings. Success is `PENDING id source output`/0; failure is exit 2. Then retrieve that exact ID using Pending First. Do not prepare, guess account jobs, use current config/card settings, or generate a replacement to repair indexing. A corrupt index requires scoped reconciliation first; never reset unrelated pending entries.

## New Images

Creator makes local references with suitable Blender/2D tools in the story project's `references/`, retaining editable sources and inspecting renders within the commission. Provider wrappers and evidence checks govern paid output, recovery and acceptance; local craft does not bypass those safeguards.

The actual image request, including needed asset images in short/series, authorizes that operation and same-scope recoverable retries, necessary repair/regeneration and fresh review, with no default attempt/round cap. No extra approval handshake; honor explicit counts, scope, checkpoints and financial limits. This never authorizes video submission or changes video grants/counts.

Check the actual request and constraints at each stage. Requesting one image is not an explicit one-attempt limit; a path, diagnosis or retrieval-only request grants no new submission. Diagnosed necessary target replacement within production authority satisfies the replacement/force requirement below without another question; unrelated outputs remain protected and ordinary existing PNGs still skip. Current prompt/visual reviews remain independent gates coordinated by Director. Missing evidence returns for review and authorized repair, not generic user approval.

Diagnose failures and lack of progress, not endless blind attempts. Unsupported parameters, account/quota failures and other nonrecoverable blockers stop affected work. Alternatives require both fixed-config compatibility and actual delegated authority; otherwise report the blocker. Preserve pending/unknown results and recover or verify the existing id before any new submission. Polling timeout is not generation failure; retrieval-only never continues into generation.

Use chosen models/parameters without mandatory budget, credit/balance or affordability checks and without savings-driven downgrades. User-supplied limits still bind; report actual account/provider failures. Grants need scope and actual constraints, not a financial field. New designs/prompts require adequate intake or explicit scoped Creator delegation; read-only diagnosis/retrieval does not authorize them.

After pending recovery, normalize config through `review-evidence.mjs config-path` before config reads/writes or evidence. Use canonical config_path in fingerprints, explicit SVD_CONFIG and commissions; reject external config before side effects. Asset production uses fixed/delegated images settings. None disables new submission, not retrieval; pure recovery bypasses config gates.

Validate resolved settings against current operation help and authorization before destructive work. Use `asset-to-image-path.sh` for output identity. Standard cards use text2image without refs, image2image with refs; derived cards still require their base images. Preserve every ordered reference; missing dependencies block, not fallback. Ordinary batches go through the runner below, not shell-parallel raw CLI or wrapper calls. The single-output boundary remains:

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/image-gen-dreamina.sh" "{prompt}" "{output}" "{ratio}" "{resolution}" "{model}" "{refs_csv}" "{source_card}"
```

All seven positions are required, including the empty reference slot. Only scoped replacement adds `--force`; never pre-delete outputs. Under its output claim the wrapper checks pending/receipt state, then non-force completed outputs return `SKIP output`/0 without new provenance. A failed receipt is not a completed skip. New submissions prepare/settle receipts and upsert pending with provider/model/ratio/resolution; callers do not duplicate writes. `PENDING id`/2 means retrieve, not resubmit; unknown/persistence failures require reconciliation.

For assets supply reviewed `## 图像生成提示` and ordered refs; the wrapper is not a prompt extractor or semantic validator. Base prompts describe complete targets; derived prompts bind the base and state the current target. Apply positive, concrete visual craft, without provider-side summaries or edits. Missing declared references return to the owner, not a text-only fallback.

Asset wrapper/runner accept `--retry-missing-id` / `{retryMissingId:true}` only for owner-checked asset targets under the bounded exception. It grants no force and changes no arguments/settings/refs. Honor stricter user counts; pure retrieval commissions grant no extra paid call.

## Ready-Job Batches

For optional `## 本地制作参考`, follow [the shared contract](../_meta/rules/local-reference.md). Run `node "${CLAUDE_PLUGIN_ROOT}/scripts/local-reference.mjs" parse|ready CARD` with one action. Basic refs keep required asset images first, then every declared local PNG once in declaration order as the exact suffix. The reviewed basic prompt must bind those actual inputs and include the narrative's control/placeholder intent; the wrapper does not append it. Sources are actual editable projects/scripts/inputs, not uploaded images. The runner/wrapper validate local readiness/order; same-entity mapping remains Creator's responsibility.

Prompt review covers only authorized new/regenerate targets, reading declared local PNGs/sources rather than future output PNGs. Reused inventory is reference input, not a prompt-review target. Missing local inputs block submission. MP4 belongs in the [shot manifest](../_meta/rules/shot-inputs.md), not image refs or completed-video records. Sources do not upload. Image acceptance does not prove motion or replace shot-input/boundary review.

For a standard card's optional basic-info `同实体参考`, Creator maps every declared canonical direct card link through `asset-to-image-path.sh`, in declaration order, into `job.images`. Bind those inputs in the self-contained target prompt. Do not recursively upload refs of refs, silently empty a missing reference, or add generation/force targets to obtain it. Authorized in-batch prerequisites wait; missing/unready external prerequisites block. Whole/part/views remain standard cards in their own names/directories, not state derivatives. Existing derivative base-image rules remain intact.

This is an LLM mapping contract, not a new production parser. The runner enforces dependencies and forwarding of actual images, not same-entity semantics or declaration-to-images completeness. Receipts lack a reference list: their settings/status/output hash do not prove which original reference images were submitted.

From the project root use `node "${CLAUDE_PLUGIN_ROOT}/scripts/generate-images-dreamina.mjs" [--force] [--retry-missing-id] [--concurrency N] JOBS.json`. The manifest is a nonempty array of the existing request inputs, not a new task/grant schema:

```json
[{"source":"assets/items/lamp.md","output":"assets/images/items/lamp.png","prompt":"<current reviewed image prompt>","images":[],"settings":{"provider":"dreamina","model":"<resolved model>","ratio":"9:16","resolution":"<resolved resolution>"}}]
```

Use authorized asset cards/settings and current prompt evidence without provider-side rewrites. Images are actual ordered paths, not cards/placeholders. References to another job's output define dependencies; external refs must be usable. Add no unrelated prerequisites or whole-stage barriers. Current evidence gates apply before dependent submission.

Default local concurrency is 5, not an account quota or cross-process semaphore. Creator sets --concurrency from current limits/user constraints without repeated questions. Independent jobs overlap; actual asset-reference dependencies wait for completed/skipped prerequisites, including fresh forced outputs.

Identical jobs deduplicate by resolved output; conflicting requests for one output fail preflight. Pending on any target or reference blocks the entire submitted batch before payment, reporting recorded IDs. Missing external refs, cycles, claims and unresolved receipts block rather than use an old PNG. `--force` applies to every supplied job: keep only explicitly authorized replacement targets in that invocation; never add unapproved prerequisites merely to regenerate them.

The first observed failure/pending stops new admissions, not already active jobs. Drain all active work and preserve every success, pending ID, raw failure and unstarted target; do not abort siblings or launch another batch to bypass the stop. Diagnose/recover before authorized continuation. The scheduler neither retries nor imposes a quality-attempt cap; repair/review decisions remain with the responsible roles.

Pending `upsert`/`remove` use `image-pending-state.mjs` with a short read-modify-write mutex and atomic rename. Do not manually rewrite pending.json. Each output has a `.png.claim` directory: conflicts fail rather than queue a duplicate submit; claims never auto-expire. Interrupted owners, stale claims/locks and prepared/unknown receipts need manual reconciliation of owner/ID/output before retry, not age-based deletion. Reference state is rechecked at submission.

Produce only basic/derived asset images. Other recorded image jobs remain retrieval-only under Pending First by their exact ID/provider/output; preserve materials and receipts without automatic migration, cleanup or paid continuation. Missing current cards/reviews do not prevent recorded-ID retrieval.

## Results

Report the whole commissioned group after draining, not just the last worker or an early failing prefix. Keep unchanged accepted evidence and all outstanding review targets; neither an empty success set nor a skipped PNG clears them. Actual updates may invalidate affected evidence and need independent review.

`runImages(jobs,{force,concurrency})` returns `{status,generated,skipped,outcomes}` with per-job `done|skipped|failed|pending|blocked`. CLI prints `OK generated N skipped M` on success; otherwise `FAILED source output`, `PENDING id source output`, `BLOCKED source output` and raw errors. Exit 1 means failure, 2 pending. Errors have no per-success summary: compare starting state with PNGs/receipts/pending after draining, retaining IDs. Nonzero does not mean zero successes; do not parse nonexistent JSON stdout.

Return generated, skipped, failed, pending and blocked counts with raw errors and provenance limits. Stable actual-success sets are `successful asset paths: {paths...} | none` and `successful shots: shotNN ... | none`. Include only this operation's actual new/downloaded outputs in the requested scope, not historical skips or still-pending work. These sets feed visual review but never replace outstanding review scope or claim acceptance. Force failure after deletion leaves the targeted output missing/dirty; preflight rejection or an unstarted job preserves its old output. Report the actual state.
