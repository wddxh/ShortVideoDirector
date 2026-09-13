# Explicit user visual acceptance

## Commands and durable binding

Run from the production project root with the actual resolved config explicitly set:

```bash
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/shot-input-visual-exception.mjs" record EP TASK_ID /tmp/opencode/WORK/request.json
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/shot-input-visual-exception.mjs" check EP TASK_ID
SVD_CONFIG="{config_path}" node "${CLAUDE_PLUGIN_ROOT}/scripts/review-evidence.mjs" check EP SHOT...
```

`record` exclusively creates `story/decisions/EP/TASK_ID.shot-input-visual-exception.json`; existing files are never overwritten or renewed. It binds version/type/actor, real project root, canonical config, episode/task/target/full shots, decision/constraints/source SHA, latest qualified review path/round/SHA, all its inputs (required + actual extras), timestamp and `grants_submission:false`. No production review or tasks.json is written. Aliased receipt/source/config paths are rejected.

`check` returns `{valid,path,...}` and exit 0 only for a current valid receipt. Missing files, any bound byte change, project/config/identity mismatch, new/incomplete review or lost qualification invalidate it. Reordering JSON object keys alone is harmless. No automatic recapture, fallback to old rounds or renewal. This first interface offers no replacement command; later acceptance requires separately authorized handling preserving provenance.

Ready retains `shot-input-review:unknown` and adds `shot-input-acceptance:user_visual_exception:TARGET:RECEIPT`. Exit 0 still requires all other checks. Check-target/checkCoverage remain independent-status interfaces. Initial/retry grants, failed/inflight/submitted/done protection, task snapshots and provider submission are unchanged.

This is an explicit, single-task user decision, not independent visual evidence or a generation grant. It applies only to missing **within-task visual evidence**. Definite conflicts, necessary external boundaries, source fidelity, token/reference binding, audio/timeline integration and all other gates remain required. Never infer eligibility by parsing prose blockers.

## Independent qualification

A fresh independent shot-input text owner uses normal start/add-input/finish, captures current materials before reading and assesses source/prompt/reference integration. Resolve necessary external boundaries through independent evidence, including scoped compatibility where justified. Explain the actual boundary pairs, basis and limits; record their necessary inputs. No boundary work is waived by this exception.

Only when all non-visual work and necessary external boundaries pass, with no definite conflict and solely unobserved within-task visual evidence remaining, author:

```json
{"result":{"status":"unknown","blockers":["Specific remaining within-task visual evidence gap"],"visual_exception_qualification":{"non_visual":"pass","external_boundaries":"pass","remaining":"task_visual_evidence_only","visual_blockers":["Specific remaining within-task visual evidence gap"]}}}
```

The qualification has exactly these four keys. `visual_blockers` must exactly equal the entire nonempty `blockers` string array, in order. This is the Reviewer's explicit classification of every blocker, not a new pass status.

`non_visual` covers source fidelity/completeness, provider token identities/use, final prompt and ordered references, timing/cuts/audio and text integration. `external_boundaries` certifies all necessary external pairs have evidence; explain when none are needed. Known visual failures are needs_revision and ineligible.

Other kinds/statuses, incomplete qualification, extra qualification keys or uncovered blockers are rejected. Any capture/discovery error or drift removes qualification at finish and keeps unknown. Old rounds are preserved. Director never writes qualification on behalf of a Reviewer.

## Director recording

After the qualified independent round finishes and all dependencies stabilize, preserve the actual user quote and its scope in `story/decisions/`. Prepare a request JSON in a designated `/tmp/opencode/<work>/` directory, with exactly:

```json
{"decision":"Verbatim user decision","source":"story/decisions/user-decision.md","shots":[1,2],"constraints":["Actual user conditions"]}
```

`shots` is the complete ordered manifest group; the numbers above are illustrative. `source` must contain the exact decision quote and its real user attribution/context. Constraints are actual conditions, not invented permission; an empty array is allowed. Director assesses the quote's meaning and whether these exact inputs are the accepted version. The tool verifies identity, not human authorship or semantic consent. Do not claim the user personally verified SHA values. A real message/session reference can be preserved in the source when available, never invented.
