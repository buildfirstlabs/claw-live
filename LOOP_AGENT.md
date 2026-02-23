# LOOP_AGENT

Minimal cycle algorithm for resilient loop execution.

## Cycle
1. Validate required files: `tasks.md`, `context.md`, `loop_state.json`, `LOOP_AGENT.md`.
2. Pick next actionable task: first `todo` item not blocked.
3. Execute one atomic step only.
4. Write result to `loop_state.json` with:
   - outcome (`success`/`failure`)
   - summary
   - proof (required; at least one artifact)
   - timestamp
5. Update task status in `tasks.md`.
6. Retry logic:
   - On failure: increment `consecutive_failures`.
   - On success: reset `consecutive_failures` to `0`.
7. Escalate when `consecutive_failures >= max_consecutive_failures_before_escalation`.

## Proof requirement
Every run must include proof (e.g., command output, test line, diff excerpt, deploy log reference). Runs without proof are invalid and must be treated as failures.

## Default escalation rule
Escalate after **3 consecutive failed cycles** for the same workflow.

_Last reviewed in cycle: 2026-02-23T09:45:53Z._
