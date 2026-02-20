# Phase 0.5 Incident Playbook (short)

Scope: fast triage/runbook for Phase 0.5 reliability incidents.

## 1) STREAM ON but no events visible

**Signal**
- UI says stream is on, but activity/proof feed looks frozen.

**Checks (in order)**
1. Replay API health:
   - `curl -sS "http://localhost:3030/api/stream/replay?limit=5"`
2. Ingestion path:
   - send a probe: `curl -sS -X POST http://localhost:3030/api/stream -H 'Content-Type: application/json' --data '{"log":{"level":"info","module":"PROBE","msg":"stream probe"}}'`
3. Confirm probe appears in replay:
   - `curl -sS "http://localhost:3030/api/stream/replay?limit=1"`

**Immediate mitigation**
- If probe appears in replay but not in UI: hard-refresh `/live` and check browser/network errors.
- If probe does not appear: restart service and re-test.

---

## 2) Empty registry (`/api/v2/registry/status` shows 0 agents)

**Signal**
- `counts` all zero, agents array empty.

**Checks**
1. `curl -sS http://localhost:3030/api/v2/registry/status`
2. Verify agents are sending heartbeats with valid headers:
   - `x-claw-agent-id`
   - `x-claw-stream-key`
3. Confirm `registry.json` exists and is writable.

**Immediate mitigation**
- Re-register/reconnect agents if keys are stale.
- If process restarted and registry was in-memory, restore/reconnect expected agents.

---

## 3) Stale agent

**Signal**
- Agent status transitions `live -> stale` and stops producing events.

**Checks**
1. Status snapshot:
   - `curl -sS http://localhost:3030/api/v2/registry/status`
2. Verify heartbeat cadence from agent (<30s for `live`).
3. Verify broadcast activity (if any) updates `lastEventAt`.

**Immediate mitigation**
- Restart agent heartbeat loop.
- Validate stream key/agent id pair (401s indicate auth mismatch).

---

## 4) Replay endpoint failure (`/api/stream/replay`)

**Signal**
- 5xx/timeouts/invalid JSON from replay endpoint.

**Checks**
1. `curl -i "http://localhost:3030/api/stream/replay?limit=5"`
2. Check `stream_events.jsonl` exists and is readable.
3. Check server logs for JSON parse / fs errors.

**Immediate mitigation**
- Restart service.
- If `stream_events.jsonl` corrupted, back it up and rotate to a clean file.
- Keep write path alive (`POST /api/stream`) and document replay gap.

---

## Escalation trigger
- Escalate if any condition lasts >15 minutes or recurs 3+ times/day.