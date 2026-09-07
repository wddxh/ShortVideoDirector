---
name: creator-provider-dreamina
description: Use when Creator needs current Dreamina image/video capabilities, configuration diagnosis, or authorized generation and recovery.
user-invocable: false
agent: creator
allowed-tools: Read, Write, Edit, Glob, Bash, Skill
model: sonnet
---

# Dreamina Provider Knowledge

Consume the current commission: outcome, materials, canonical targets, operation, fixed settings and explicit grants. Loading this skill neither changes role nor authorizes submission.

Actual user generation requests establish the target operation without a second permission handshake. Short/series commissions include needed new asset/sheet images, never video submission. A later manual generate-video request is persisted by its entry as the actual initial grant before Creator submits. Diagnosis/config-only/retrieval requests do not imply generation; check/auto only consume registered grants. Scope, fixed settings, overwrite, snapshots, pending/inflight and explicit retry limits still apply.

Read `${CLAUDE_PLUGIN_ROOT}/skills/_meta/rules/user-decision-relay.md` for intake and decisions. Read-only capability discovery may precede intake; creating asset designs or prompts requires relevant known needs or explicit role/scope/constraints delegation, never silence. Missing needs return for clarification, not invented chat previews. Use selected models/parameters without budget, credit/balance, affordability or cheapest-option prerequisites or savings-driven downgrades. User-supplied limits remain binding; report actual account/provider failures. Pause only affected work; submission/overwrite/retry/inflight protections remain intact.

If the commission supplies config_path, validate that exact path with `review-evidence.mjs config-path "{config_path}"` rather than falling back to the subprocess environment. Conflicting explicit config selections need clarification. Forward its canonical result as SVD_CONFIG on each config-dependent command and to delegated tasks. Retrieval-only needs neither config nor this validation.

- [capabilities.md](capabilities.md): live discovery, configuration and scoped resolution.
- [image.md](image.md): image execution, dependencies and pending recovery.
- [video.md](video.md): persisted video submission and retrieval contracts.

Read only the relevant guidance. Retrieval does not require fresh generation capability discovery. New paid or destructive operations require current capabilities, actual authorization and current scoped production evidence.
