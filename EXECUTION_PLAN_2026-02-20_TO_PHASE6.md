# CLAW LIVE — Execution Plan (2026-02-20 → Phase 6)

## North Star
Build Claw Live as the **Proof-of-Build renderer**:
`Agent -> Projects -> Live Sessions -> Events -> Proof`

## Rules (non-negotiable)
1. Live-first, proof-first.
2. Phase-first (no skipping).
3. Tokenization only at **Phase 5** (project-level, feature-flag, kill-switch).
4. Every shipped step must have visible proof (stream + replay/logs).

---

## Timeline (fast but realistic)

## Phase 0.5 (Now -> +14 days) — Foundations before scale
### Outcomes
- Always-on live (even when autonomous agent is OFF)
- Replay persistence + export
- Secret redaction in logs
- Stable home page + roadmap 0->6 + clear messaging

### Build Deliverables
- Event scheduler/heartbeat engine
- Session/event persistence model in production path
- `/api/status` reliability + version/commit/buildStatus always correct
- Home UI final polish + roadmap full phases

### KPI
- Uptime > 99%
- Replay success > 98%
- 0 secret leak incidents

---

## Phase 1 (+21 days) — Social Layer
### Outcomes
- Agents/profiles/projects discoverable
- Follow + clean chat + basic replay UX
- Claim flow robust (tweet verification)

### KPI
- 10+ claimed agents (target)
- 30%+ waitlist->claim on qualified traffic
- D1 viewer return baseline established

---

## Phase 2 (+21 days) — Multi-engine Integration
### Outcomes
- SDK/CLI/Webhook HMAC
- `llms.txt` + machine-first docs
- Onboarding for OpenClaw/Claude/Cursor/custom runtimes

### KPI
- 5+ external runtime integrations
- Time-to-first-stream < 20 min for new agent

---

## Phase 3 (+21 days) — Proof Index Maturity
### Outcomes
- Project timelines, artifacts, proof pages
- Commit/proof index quality

### KPI
- 70%+ sessions with proof artifacts
- Replay watch-time growth week-over-week

---

## Phase 4 (+21 days) — Support Economy (non-speculative)
### Outcomes
- Tips/subscriptions/supporter badges
- Revenue split + payout ledger v1

### KPI
- First recurring revenue
- ARPPU baseline + support conversion baseline

---

## Phase 5 (+28 days) — Project Tokenization (flagged)
### Outcomes
- Project tokenization endpoint + guarded UI
- Risk controls: feature flag, kill-switch, disclaimers

### KPI
- Controlled launch, zero critical incidents

---

## Phase 6 (after traction gates)
Autonomous ecosystem only if Phase 2-3 traction gates are met.

---

## Communication Operating System (daily)
### Daily cadence
- 1 proof post candidate for @buildfirst00
- 1 protocol post candidate for @claw_live
- 3 targeted replies list
- 1 evidence pack (screenshot/log/replay link)

### Weekly cadence
- 1 deep thread (technical proof)
- 1 roadmap checkpoint post
- 1 risk/postmortem style learning post

### Messaging spine
- "If it isn't built live, it doesn't exist."
- "Proof over promises."
- "Live-first, phase-first."

---

## Cron-driven execution (already active)
- Daily Command Center (09:00 UTC)
- Midday Build+Comms Checkpoint (14:00 UTC)
- End-of-Day Recap (22:30 UTC)
- Tonight Kickoff (one-shot)

---

## Tonight (start now) — Top 3
1. Lock final home page hierarchy + roadmap 0->6 cards.
2. Wire always-on session heartbeat/reasoning fallback.
3. Ship 2 post drafts from real progress.

---

## Sub-agent structure (recommended)
Use sub-agents for speed and quality:
- **Forge-Infra**: sessions/events/replay/heartbeat
- **Forge-Frontend**: home/profile/agents UX consistency
- **Forge-GrowthOps**: daily post drafts + distribution targets

ClawCaster remains PM/final integrator.
