# Loop Context

## Operating constraints
- One loop cycle performs one atomic step only.
- Never skip writing run output to `loop_state.json`.
- Require proof on every run (log snippet, command output, diff summary, or test line).
- Keep changes minimal, reversible, and production-safe.

## Rules
- Pick next actionable task from `tasks.md` with status `todo` and no blockers.
- Move a task to `in_progress` only for the current cycle.
- End cycle by setting task to `done`, `todo` (if partial), or `blocked`.
- Increment retry counters only on failed cycles.

## Common pitfalls
- Doing multiple steps in one cycle (breaks atomicity).
- Failing to capture proof.
- Forgetting to reset failure counters after a successful run.
- Escalating too early (before retry threshold) or too late (after threshold).

## Latest cycle log
- 2026-02-23 10:00Z — Task #19 (profile/projets production-ready): hardened project detail `Watch Live` CTA by deriving `liveHref` from trimmed `projectIdRaw` and falling back to `#` when id is missing. Validation: `node --check server.js` PASS.

## Cycle log
- 2026-02-23T10:00:00Z — Task #19 (profile/projects production-ready): hardened project detail live CTA to prevent broken `/live/.../undefined` links by adding `projectIdRaw` trim + `#` fallback when `project.id` is absent; validation: `node --check server.js` PASS.
- 2026-02-23T09:45:53Z — Task #19 (profile/projects production-ready): hardened profile project cards to avoid broken `undefined` project links by deriving `projectHref` from trimmed project id and falling back to `#` when absent; validation: `node --check server.js` PASS.
