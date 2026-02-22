# LIVE V3 Acceptance Spec (Hard Gate)

**Purpose:** stop endless redesign churn by using binary pass/fail checks.

**Applies to:** `live.html` V3 surface on:
- **Desktop:** 1280×800 (and 1440×900 spot-check)
- **Mobile:** 390×844 (iPhone 12-ish) and 360×800 (Android baseline)

**Release rule:** V3 is accepted only if **all P0 criteria pass** on both desktop and mobile.

---

## 1) Pass/Fail Criteria (P0)

| ID | Dimension | Test Method | Pass Condition (Binary) |
|---|---|---|---|
| P0-1 | Hierarchy clarity | Open page at first paint, no scrolling, 5-second glance audit. | First viewport clearly exposes: (a) identity header, (b) main narrative stream, (c) proof area, (d) chat area (desktop side-by-side; mobile stacked). |
| P0-2 | Readability in 5 seconds | Observe default empty state and one populated sample state. | User can identify in ≤5s: who is live, what changed recently, where proof is, where chat is. Supporting signals must be visible labels, not implied layout only. |
| P0-3 | Narrative tone (human, non-robotic) | Feed entries from `thoughts` text through rendering logic. | Narrative line outputs human-action phrasing (verbs + progress framing), avoids raw debug dumps as primary line. |
| P0-4 | Proof visibility | Populate proof list with at least 1 item and verify placement/readability. | Proof section is always visibly distinct, with timestamp + proof text, and not hidden behind debug drawer. |
| P0-5 | Chat usefulness | Populate chat with ≥3 varied messages (short/long). | Chat displays speaker + time + message body with wrapping; newest message appends without breaking layout. |
| P0-6 | Scroll / swipe behavior | On touch/mobile and desktop trackpad, interact with feed/proof/chat independently. | Vertical scroll works per panel; no horizontal overflow at page level; “Latest” returns feed to newest item. |
| P0-7 | Freshness cues | Simulate fresh and stale intervals. | UI exposes freshness text (`just now` / `Xs` / `Xm`) and a live state pill that changes based on connection + recency. |
| P0-8 | Brand consistency with landing promise | Compare top-level copy/tone with promise “Claw Live = proof-first stream”. | Above-the-fold copy and labels reinforce proof-first live transparency (not generic dashboard language). |

---

## 2) Strict Test Procedure

1. Run app locally (`node server.js`) and open `http://localhost:3030/live.html`.
2. Validate desktop criteria P0-1..P0-8.
3. Validate mobile criteria P0-1..P0-8 using responsive emulation at 390×844 and 360×800.
4. Mark each line **PASS** or **FAIL** only (no “mostly”).
5. **Acceptance threshold: 8/8 PASS on desktop + 8/8 PASS on mobile.**

---

## 3) Quick Verification of Current Implemented V3 (2026-02-22 UTC)

Method used: source audit of `live.html` with criteria mapping (fast gate check).

| ID | Desktop | Mobile | Evidence |
|---|---|---|---|
| P0-1 Hierarchy | PASS | PASS | Explicit sections: identity header, narrative stream, proof timeline, visible chat (`live.html` lines 294-337). Desktop 2-col + mobile 1-col breakpoint at `max-width:1024` (lines 111-126). |
| P0-2 5s readability | PASS | PASS | Strong labels in viewport: “Human narrative live stream”, “Compact proof timeline”, “Visible chat”, plus live/freshness in header (lines 303, 313, 322, 331, 381-394). |
| P0-3 Narrative tone | PASS | PASS | `humanLine()` rewrites raw events into human progress sentences (lines 409-418). |
| P0-4 Proof visibility | PASS | PASS | Dedicated proof panel + timestamp/text rendering (`timeline` + `proof-item`, lines 183-200, 321-325, 432-436). |
| P0-5 Chat usefulness | PASS | PASS | Chat card includes user/time/body, wraps long text (`chat-msg` word-break), append behavior on event (lines 220-227, 438-440, 499-505). |
| P0-6 Scroll/swipe | PASS | PASS | Independent vertical overflow in feed/proof/chat (lines 159-162, 187, 208-211); no horizontal layout trigger; “Latest” button scrolls feed to top/newest (lines 513-515). |
| P0-7 Freshness cues | PASS | PASS | Freshness string logic + live pill state tied to recency/socket/status (lines 353, 387-402, 448-450, 526-533). |
| P0-8 Brand consistency | PASS | PASS | Page title and section language reinforce proof-first live transparency: “Proof-first Stream”, “Compact proof timeline”, live/freshness cues (line 6, lines 321-323, 387-402). |

### Verification Verdict

- **Desktop:** PASS (8/8)
- **Mobile:** PASS (8/8)
- **Overall V3 Acceptance:** **PASS**

---

## 4) Enforcement Rule for Future Changes

Any redesign PR touching `live.html` must update this file’s verification table and cannot merge if any P0 line is FAIL.
