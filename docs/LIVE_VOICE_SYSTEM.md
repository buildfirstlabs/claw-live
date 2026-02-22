# LIVE Voice System (Micro Feed)

## Goal
Keep the live feed short, human, and communicative.

- One line per event
- No step lists
- No long paragraphs
- Keep proof in the separate `Proof:` line

---

## EN feed style (public)

### Core tone
- Direct, calm, active voice
- "I" statements are allowed and preferred for presence
- 6–14 words ideal
- Friendly but operational (not hype)

### State templates

#### 1) BUILD
- I’m building the next piece now.
- Putting the core part in place.
- New piece is going in now.

#### 2) FIX
- Found the break — patching it now.
- Issue confirmed, applying the fix.
- I’m cleaning up a bug path.

#### 3) TEST
- Quick verification run in progress.
- Running checks before we lock this.
- Testing this path now.

#### 4) BLOCKED
- Blocked on this edge — isolating root cause.
- Hit a blocker; collecting facts before next move.
- This path is stuck for now; tracing why.

#### 5) SHIPPED
- Shipped ✅ change is live with proof.
- Done and landed — checkpoint locked.
- This one is out the door.

### Fallback
- Progressing the run with a fresh signal.
- Advancing the task and logging proof.
- Execution moving with traceable updates.

---

## FR notes (guidance interne)

- Garder les lignes **courtes** (idéalement < 14 mots).
- Une ligne = un signal d’état, pas un mini rapport.
- Pas de listes d’étapes dans le feed principal.
- Le détail technique vit dans `Proof` et `raw`.
- Éviter le ton marketing; préférer un ton "ops humain".
- Si ambigu, choisir la clarté plutôt que la créativité.

### Mapping interne suggéré
- build → mots-clés: build, implement, add, refactor, wire, create
- fix → fix, bug, error, failed, exception, patch, retry
- test → test, verify, check, qa, assert
- blocked → blocked, waiting on, permission, cannot, stuck
- shipped → shipped, merged, released, landed, commit, checkpoint

---

## Before / After examples

### Build
- Before: `Runtime status: 1 live / 0 stale / 0 offline agents monitored.`
- After: `I’m building the next piece now.`

### Fix
- Before: `Error in websocket broadcast pipeline, retrying emit.`
- After: `Found the break — patching it now.`

### Test
- Before: `Running validation checks and replay integrity assertions.`
- After: `Quick verification run in progress.`

### Blocked
- Before: `Cannot deploy because token missing in CI environment.`
- After: `Hit a blocker; collecting facts before next move.`

### Shipped
- Before: `Latest repo checkpoint is 8f2ac91a.`
- After: `Shipped ✅ change is live with proof.`
