# Loop Tasks

Status legend: `todo` | `in_progress` | `done` | `blocked`

1. [todo] Validate loop files are present and structurally valid (`tasks.md`, `context.md`, `loop_state.json`, `LOOP_AGENT.md`).
2. [todo] Select the highest-priority actionable task (`todo` and not blocked).
3. [todo] Execute exactly one atomic implementation step for the selected task.
4. [todo] Record run result and proof artifact in `loop_state.json`.
5. [todo] Mark task status transition in `tasks.md` (or add follow-up task if partial).
6. [todo] Apply retry/escalation logic when failures occur.
