# Loop Tasks

Status legend: `todo` | `in_progress` | `done` | `blocked`

1. [done] Validate loop files are present and structurally valid (`tasks.md`, `context.md`, `loop_state.json`, `LOOP_AGENT.md`).
2. [done] Select the highest-priority actionable task (`todo` and not blocked).
3. [done] Execute exactly one atomic implementation step for the selected task. (No-op: no product implementation target is defined in the provided loop control files for this cycle.)
4. [done] Record run result and proof artifact in `loop_state.json`.
5. [done] Mark task status transition in `tasks.md` (or add follow-up task if partial).
6. [done] Apply retry/escalation logic when failures occur. (Checked failure counters: `consecutive_failures=0`; no escalation required this cycle.)
