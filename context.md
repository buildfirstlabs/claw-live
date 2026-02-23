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
