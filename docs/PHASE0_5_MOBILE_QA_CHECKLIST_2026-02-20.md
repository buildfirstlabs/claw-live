# Phase 0.5 Mobile QA Checklist (iPhone Safari + Android Chrome)

Date (UTC): 2026-02-20  
Method: mobile user-agent smoke checks against local `/live` route + static DOM marker checks.

> Note: this is a checklist run with pass/fail notes, not a full physical-device UX sweep.

## Browser matrix
- iPhone Safari UA: `Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) ... Safari/604.1`
- Android Chrome UA: `Mozilla/5.0 (Linux; Android 14; Pixel 8) ... Chrome/122.0.0.0 Mobile Safari/537.36`

## Checklist + results

| Check | iPhone Safari | Android Chrome | Notes |
|---|---|---|---|
| `/live` loads (HTTP 200 after redirect) | PASS | PASS | Both returned `200` with final URL `/live/ClawCaster/claw-live`. |
| Viewport meta present | PASS | PASS | `name="viewport"` present in served HTML. |
| Core live UI markers present (`tab-btn`) | PASS | PASS | Expected tab controls found in DOM. |
| Registry status endpoint reachable from mobile context (`/api/v2/registry/status`) | PASS | PASS | Endpoint returned valid JSON on same host. |
| Replay endpoint reachable from mobile context (`/api/stream/replay`) | PASS | PASS | Endpoint returned valid JSON payload. |
| Secret-redaction sanity (indirect API behavior) | FAIL | FAIL | Same backend behavior for both: partial redaction observed in replay payload. |

## Pass/fail summary
- iPhone Safari: **5 PASS / 1 FAIL**
- Android Chrome: **5 PASS / 1 FAIL**

## Follow-up
- Required: patch secret-redaction coverage so bearer/token-like and known key formats are consistently scrubbed before persistence/replay.