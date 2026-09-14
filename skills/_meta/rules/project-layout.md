# Story Project Layout

Paths below are relative to the story project root, not the plugin checkout. Choose locations by purpose so current materials are easy to find without filling the root with handoffs. Create only files needed for the authorized work; this is not a scaffold checklist or a filesystem migration request. Reuse existing current sources and explicit supplied paths.

## Current Sources

| Path | Purpose |
| --- | --- |
| `story/episodes/epNN/script.md`, `storyboard.md` | Canonical episode production text. |
| `story/episodes/epNN/outline.md` | Optional adopted episode planning. |
| Supplied novels, chapters or excerpts at their actual paths | Scriptwriter adaptation inputs with an explicit adopted scope. |
| `story/episodes/epNN/task-inputs/taskNN.json` | Canonical generation task manifest: draft `{shots,references}`, final `{shots,references,prompt}` with Creator-authored prompt. |
| `story/episodes/epNN/videos/` | Final video outputs at tool-defined paths. |
| `assets/<category>/<name>.md` | Shared cards; retain characters/items/locations/buildings categories. |
| `assets/images/<category>/<name>.png` | Shared identity images. |
| `references/` | Stable local reference media, editable sources and their actual dependencies. |
| `story/planning/plot-options.md` | Canonical current candidate set, updated in place within scope. |

Retain applicable `story/arc.md` and `story/outline.md` contracts. The latest accepted story may live at `story/planning/story.md` with explicitly linked adopted amendments; follow that complete set until actual consolidation is authorized. A newer filename or modification time does not establish adoption. Identify accepted material separately from unselected candidates without copying it into every handoff.

Final model-facing prose lives in the existing task manifest's `prompt`, not a separate prompt file or ledger. Draft manifests support materials preparation but not final review/readiness. The existing shot-input target fingerprint binds the final manifest including prompt; preparation copies its exact text into tool-owned `tasks.json` without moving the canonical source.

## Design And Decisions

Recommend one work-wide baseline at `references/design/art-direction.md`, owned by Creator and linked from relevant handoffs. It describes shared shape, material and rendering choices; episode-specific differences stay with their actual materials. Use it as a review extra when it informs judgment, and list it in `sources` only when it is an actual production dependency. Task-local sources must remain under `references/`; a style document does not replace editable scene files, scripts or required inputs. Keep this single source rather than mirroring it into `story/design/`.

Use `story/decisions/` when durable question/reply provenance is needed. Preserve the complete question plan, all applicable options/explanations, stable labels, branches, raw replies and conditions, plus the precise material/revision they concern. Record delegated choices as delegated, not user-selected. Before replacing candidates or a work file, preserve any content needed to understand an existing decision. These records explain decisions; actual approval/grants remain in their canonical stores under the governing authorization contract.

## Working Files

Explicit user visual acceptance has one tool-owned record at `story/decisions/epNN/taskNN.shot-input-visual-exception.json`, governed by [visual exception](shot-input-visual-exception.md). It binds the actual user decision source and current qualified independent review/inputs; it is neither a review record nor a submission grant. Only the explicit recorder creates it, with no overwrite or automatic renewal.

Use `story/work/epNN/<work-unit>/` for transient handoffs, job JSON and results; use `story/work/shared/<work-unit>/` for cross-episode work. Choose meaningful work-unit names and reuse the same current work file for revisions unless a distinct record must be preserved. Simple diagnostic or coordination tasks can return text without creating a file. Reference sources belong in `references/`, not in these transient directories; visual helper previews use their separately assigned temporary directory per [visual-context](visual-context.md).

Before dispatch, choose precise output paths and include them with the target, current source paths, scope and ownership in the handoff. Distinguish a transient result from the canonical deliverable; when only text is needed, say so. Parallel workers receive distinct output files, while successive edits to the same current file are coordinated by its owner.

The local environment report has one fixed project-relative path: `story/work/shared/environment/environment.md`. Authorized production initialization covers all currently supported local routes once under [Environment Check](../../creator-local-reference/tools.md#environment-check), recording actual pass/unavailable evidence in self-contained current Markdown. Keep commands, versions, backend/device, resolved paths, results and limitations here; probe code/logs/outputs stay in `/tmp/opencode`. Creator reads this shared file directly as a normal dependency. Director coordinates initialization/update writer ownership and stable reads; missing reports are completed once during initialization/recovery, and actual faults, known environment changes or uncovered capability needs receive targeted updates. Reuse without routine retests, TTL or version scans. Keep this report out of manifest.sources and default review semantic inputs; it is not a schema, gate, registry or per-task copy.

## Review Records

New review records use these paths relative to the project root:

| Path | Target |
| --- | --- |
| `reviews/epNN/script.md`, `reviews/epNN/storyboard.md` | Episode production text. |
| `reviews/epNN/assets/<category>/<name>.asset-prompt.md` | `assets/<category>/<name>.md`, authorized prompt review. |
| `reviews/epNN/assets/<category>/<name>.asset-visual.md` | `assets/<category>/<name>.md`, corresponding image review. |
| `reviews/epNN/task-inputs/taskNN.md` | One generation task input package. |
| `reviews/epNN/outline.md` | Optional adopted outline. |
| `reviews/story/arc.md` | Optional arc planning. |

Resolve the five runtime paths with `review-evidence.mjs path KIND EP TARGET`. Fresh independent Reviewers write distinct nonconflicting ready targets in parallel. Same ep/kind/target serialization protects output ownership; read/write and input dependencies also require ordering. Each completed round has scope=[target] and one result. Batches coordinate coverage and counts without a shared ledger or mandatory aggregation task. Planning reviews remain prose only. Missing or incomplete evidence affects its owning target. Follow [review-meta-rules](review-meta-rules.md) for unchanged evidence kinds, schemas, hashes and authorization boundaries.

## Navigation And Preservation

Keep supplied source material at its actual path. Adaptation writes the screenplay and preserves the source.

An optional `story/README.md` links to the actual current story and adopted amendments, episode materials, design baseline and relevant decisions/reviews. It is navigation, not a duplicate acceptance, grants or status ledger. Maintain links when an authorized change changes the current source; do not copy all source content into the index.

Use `story/archive/<scope>/` only for authorized copies of finished versions. Keep current sources authoritative and preserve needed decision provenance independently of optional archival copies. Do not archive active jobs or infer permission to consolidate, move or delete files from a layout cleanup request.

Tool-owned paths remain fixed: canonical config, episode `tasks.json`, receipts, pending records, grants, locks, inflight and monitor state stay where their tools read/write them. A transient job request in `story/work/` does not relocate its execution records. Apply these conventions to needed new work without universally migrating existing projects, refreshing acceptance evidence or rewriting authorization records.
