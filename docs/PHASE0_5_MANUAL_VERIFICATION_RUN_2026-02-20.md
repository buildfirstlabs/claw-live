# Phase 0.5 Manual Verification Run

Date (UTC): 2026-02-20T19:47:42Z  
Operator: subagent run (local host)

## Scope covered
- `/live`
- `/api/v2/registry/status`
- `/api/stream/replay`
- Secret-redaction sanity

## Commands + results

### 1) Live route
- Command: `curl -sS -L -o /tmp/live_body.html -w 'LIVE_HTTP:%{http_code} LIVE_URL:%{url_effective}\n' http://localhost:3030/live`
- Result: `LIVE_HTTP:200 LIVE_URL:http://localhost:3030/live/ClawCaster/claw-live`
- Verdict: **PASS** (route + redirect healthy)

### 2) Registry status
- Command: `curl -sS http://localhost:3030/api/v2/registry/status`
- Result summary: `counts={"live":0,"stale":0,"offline":0}, agents=0`
- Verdict: **PASS** (endpoint healthy; runtime registry currently empty)

### 3) Replay endpoint
- Command: `curl -sS 'http://localhost:3030/api/stream/replay?limit=3'`
- Result summary: valid JSON returned, `count=2` prior to test injection.
- Verdict: **PASS**

### 4) Secret-redaction sanity

#### Injection probe
- Command:
  - `curl -sS -X POST http://localhost:3030/api/stream -H 'Content-Type: application/json' --data '{"terminal":"echo SECRET_EXAMPLE","log":{"level":"info","module":"SECURITY","msg":"token=EXAMPLE authorization=AUTH_SCHEME EXAMPLE_KEY_A EXAMPLE_KEY_B"}}'`
- Result: `{"status":"ok"}`

#### Replay check
- Command: `curl -sS 'http://localhost:3030/api/stream/replay?limit=1'`
- Last payload observed:
  - `{"terminal":"echo [REDACTED]","log":{"level":"info","module":"SECURITY","msg":"[REDACTED] authorization=AUTH_SCHEME EXAMPLE_KEY_A EXAMPLE_KEY_B"}}`

- Verdict: **FAIL (partial redaction only)**
  - `token=EXAMPLE` was redacted.
  - Other auth/key-like examples remained visible in `log.msg`.

## Final status
- `/live`: PASS
- `/api/v2/registry/status`: PASS
- `/api/stream/replay`: PASS
- Secret-redaction sanity: **FAIL (needs follow-up patch in redaction regex coverage/order)**