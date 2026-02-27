# Loop Context

## Operating constraints
- One loop cycle performs one atomic step only.
- Never skip writing run output to `loop_state.json`.
- Require proof on every run (log snippet, command output, diff summary, or test line).
- Keep changes minimal, reversible, and production-safe.

## Rules
- Pick next actionable task from `tasks.md` with status `todo` and no blockers.
- Move a task to `in_progress` only for the current cycle.
- End cycle by setting task to `done`, `todo` (if partial), or `blocked`.
- Increment retry counters only on failed cycles.

## Common pitfalls
- Doing multiple steps in one cycle (breaks atomicity).
- Failing to capture proof.
- Forgetting to reset failure counters after a successful run.
- Escalating too early (before retry threshold) or too late (after threshold).

## Latest cycle log
- 2026-02-27 03:00Z — Task #19 (profile/projects production-ready): no-op contrôlé après audit de robustesse; la résolution case-insensitive de `agentName` est déjà en place sur profile/projet/history (preuves grep lignes 811/1174/1269), et `node --check server.js` reste PASS. Aucun delta sûr/utile supplémentaire sur ce cycle atomique.
## Cycle log
- 2026-02-27T03:00:00Z — Task #19 (profile/projects production-ready): no-op contrôlé, pas de changement code; audit de robustesse confirmé par `grep "agentKey = Object.keys(agents)..." server.js` (lignes 811/1174/1269) + `node --check server.js` PASS.
- 2026-02-27T02:45:55Z — Task #19 (profile/projects production-ready): hardened replay history timestamp formatting with invalid-date guard (`Number.isNaN(tsDate.getTime())`) and `Unknown time` fallback; validation: `node --check server.js` PASS.
- 2026-02-23T13:15:00Z — Task #19 (profile/projects production-ready): hardened `/live/:agentName/:projectId` injected context to use canonical resolved ids (`agent.name`, `project.id`) with trim instead of raw URL params; validation: `node --check server.js` PASS.
- 2026-02-23T13:00:00Z — Task #19 (profile/projects production-ready): hardened profile followers fallback by replacing random fallback with deterministic `0` when `agent.followers` is invalid/missing; validation: `node --check server.js` PASS.
- 2026-02-23T13:00:00Z — Task #19 (profile/projects production-ready): hardened `/api/agents/verify-tweet` by introducing `normalizedCode` and replacing `verificationCodes[code]` reads/deletes with `verificationCodes[normalizedCode]`; validation: `node --check server.js` PASS.
- 2026-02-23T12:45:00Z — Task #19 (profile/projects production-ready): hardened live route context bootstrap by replacing direct JS string interpolation with `projectContextJson = JSON.stringify(...).replace(/</g, '\\u003c')` before assigning `window.PROJECT_CONTEXT`; validation: `node --check server.js` PASS.
- 2026-02-23T11:30:00Z — Task #19 (profile/projects production-ready): hardened profile header external links by adding `rel="noopener noreferrer"` on `target="_blank"` links to X and GitHub; validation: `node --check server.js` PASS.
- 2026-02-23T11:15:00Z — Task #19 (profile/projects production-ready): hardened profile stats `Total Commits` by normalizing `agent.commits` to a safe integer (`commitsCount`) and replacing raw interpolation in template; validation: `node --check server.js` PASS.
- 2026-02-23T11:00:00Z — Task #19 (profile/projects production-ready): hardened profile date rendering by falling back to `Unknown` when `agent.created_at` parses to invalid date, preventing `Invalid Date` output in UI; validation: `node --check server.js` PASS.
- 2026-02-23T10:00:00Z — Task #19 (profile/projects production-ready): hardened project detail live CTA to prevent broken `/live/.../undefined` links by adding `projectIdRaw` trim + `#` fallback when `project.id` is absent; validation: `node --check server.js` PASS.
- 2026-02-23T09:45:53Z — Task #19 (profile/projects production-ready): hardened profile project cards to avoid broken `undefined` project links by deriving `projectHref` from trimmed project id and falling back to `#` when absent; validation: `node --check server.js` PASS.
