# Live Narrative Mode v1 (Claw Live)

## Goal
Make live execution instantly understandable and addictive:
1. **Agent-human readable thoughts first** (what is happening + why)
2. **Proof cards second** (verifiable evidence)
3. **Raw logs only behind optional debug**

No continuous LLM dependency. Near-zero marginal cost using deterministic templates over existing runtime signals.

---

## Product Behavior

### 1) Narrative Feed (Primary Surface)
- Default first tab: **Narrative**.
- Each incoming runtime signal is transformed into a concise story card:
  - **Now doing** (headline)
  - **Thinking** (agent-readable thought summary)
  - **Why it matters** (impact line)
  - **Confidence badge** (High/Medium/Low)
  - **Timestamp + step index**
- Newest card appears first.
- Narrative cards are generated from:
  - `reasoningHistory`, `thoughts`
  - `proof` entries
  - `log` entries

### 2) Proof Cards (Secondary Surface)
- Dedicated tab: **Proof Cards**.
- Render each proof item as a compact, verifiable card.
- Preserve exact artifact text/hash/link where present.
- Reverse chronological order, newest first.

### 3) Debug Logs (Optional Surface)
- Dedicated tab: **Debug Logs**.
- Hidden from primary flow; shown only when user explicitly opens tab.
- Includes all raw logs/events with level/module/timestamp.
- Framed as diagnostic mode, not default storytelling mode.

---

## Template Engine (No LLM)

### Input Signals
Existing runtime stream events and socket updates.

### Deterministic Mapping
Keyword/rule-based intent classification:
- `git|commit|hash` → **Checkpoint**
- `replay|events|buffer` → **Replay Health**
- `registry|live|stale|offline` → **Agent Network Pulse**
- `uptime|keepalive|runtime` → **Runtime Stability**
- fallback → **Execution Update**

### Output Narrative Fields
- `headline`
- `thinking`
- `why`
- `confidence`
- `type`
- `time`

### Cost
- Pure front-end string transformations.
- No per-event model call.
- Reuses existing server payloads.

---

## UX Principles
- **Clarity in <2s**: user instantly knows what changed.
- **Trust via proof**: every narrative ties to evidence.
- **Depth on demand**: raw logs available, never forced.
- **Compulsion loop**: step counter + fresh-card cadence creates momentum.

---

## Implementation Scope (v1)
- `live.html` updated with:
  - New tab structure (Narrative / Proof Cards / Debug Logs)
  - Narrative card renderer + template transformer
  - Debug tab and optional toggle copy
- Server wiring:
  - **No new mandatory endpoint**; uses existing socket + init payload.
  - Existing `/api/stream/replay` remains compatible for future upgrades.

---

## Success Criteria
- Default viewer can explain current agent progress without opening logs.
- Proof remains visible and verifiable.
- Debug users still access full raw execution trail.
- Runtime cost remains effectively unchanged.