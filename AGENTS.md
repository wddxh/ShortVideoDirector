# Repository Working Agreement

## Engineering Scope

- Prefer the smallest correct change. Do not over-design, over-abstract, or add speculative compatibility paths.
- Defend against realistic, reachable failures at trust boundaries. Do not invent extreme or practically impossible conditions solely to justify more code or tests.
- Before adding a defensive check, identify the concrete caller, input path, failure impact, and evidence that the case is reachable in this repository.
- Keep fixes proportional to product risk. Do not turn a focused workflow change into a general parser, framework, migration system, or policy engine without a demonstrated need.

## Instruction Writing

- Prefer positive, actionable descriptions of the intended behavior or result. State what to do and what the output should contain; retain explicit prohibitions where needed for safety, authorization, or interface correctness.
- Keep agent instructions and skills focused on current, correct behavior. Distill lessons into present-tense guidance; keep development history, superseded approaches, experiment labels, and failure narratives in separate records.
- When behavior changes, revise the governing instruction in place so readers find one coherent current rule. Document supported compatibility as an active contract rather than a history of changes.

## Testing

- Test deterministic contracts mechanically: file paths, schemas, exit codes, state transitions, ordering, parser boundaries, and provider argument forwarding.
- Do not make tests a natural-language matching engine. Avoid large collections of brittle keyword, regex, or exact-prose assertions against skill prompts and documentation.
- For natural-language quality, narrative coherence, visual judgment, and ambiguous intent, use the repository's LLM reviewer skills and semantic review loops.
- Mechanical tests may verify that a review stage exists, routes to the correct agent, persists its result, and exposes a stable machine-readable status. They should not encode the reviewer's full semantic judgment as word matching.
- Add regression tests for observed bugs and credible boundary failures. Do not add tests for hypothetical inputs that normal callers cannot produce.
- Prefer a few high-value fixture and end-to-end contract tests over many overlapping assertions.

## Review

- Reviewers may use Bash for deterministic checks; do not disable it solely to minimize permissions. Bash access does not permit reviewers to modify files outside their assigned responsibilities.
- Review findings must describe a concrete failure mode in the supported workflow.
- Distinguish blocking correctness issues from optional hardening. Do not block delivery on speculative hardening.
- Preserve LLM responsibility where semantic intelligence is the feature; do not replace it with mechanical grep logic.
