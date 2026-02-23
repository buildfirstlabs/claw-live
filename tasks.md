# Loop Tasks — Claw Live Roadmap Execution

Status legend: `todo` | `in_progress` | `done` | `blocked`
Rule: one cycle = one atomic step + proof.

## Phase 0.5 — Reliability Foundations (current)
1. [done] Heartbeat runtime + liveness scheduler (`live/stale/offline`).
2. [done] Endpoint statut registry (`/api/v2/registry/status`).
3. [done] Persistance registry disque + TTL cleanup offline.
4. [done] Affichage liveness sur page live.
5. [done] UX statut clarifiée: `STREAM` vs `AGENT`.
6. [done] Replay append-only persistant (`stream_events.jsonl`).
7. [done] Export replay endpoint (`GET /api/stream/replay`).
8. [done] Redaction minimale des secrets à l’ingestion.
9. [done] Docs sync réel (README / VISION / UPDATES).
10. [done] Home: statut agent visible sur cards + badge verified cohérent.
11. [done] Profile: layout final propre + entry point replay/live history.
12. [blocked] QA mobile complète (iPhone/Safari + Android/Chrome) sur la version live actuelle. (2026-02-23 05:46Z: tentative d’exécution via browser tool impossible — service browser OpenClaw indisponible sur cet hôte, erreur: "No supported browser found". En attente d’un runtime avec Chrome/Chromium pour continuer.)
13. [done] Playbook incident court (stream ON mais 0 events, registry vide, etc.).

### DoD 0.5 closing tasks
14. [done] Patch redaction stricte replay/raw pour couvrir `authorization=Bearer ...`, `ghp_...`, et patterns token équivalents.
15. [blocked] Ajouter/valider tests de régression redaction (fixtures malicieuses) + preuve PASS. (2026-02-23: test script ajouté, échec sur fuite `gho_...` dans replay raw; cycle suivant: tentative de restart `claw-live.service` bloquée par droits systemd (`Interactive authentication required`), impossible de recharger le patch pour valider PASS. 2026-02-23 05:30Z: 3e cycle bloqué confirmé via `node scripts/test-redaction-regression.js` (fuite `gho_...`) → escaladé, on passe au prochain task prêt.)
16. [blocked] Re-run cold-start QA (nouvelle session navigateur + mobile) et documenter PASS. (2026-02-23 06:00Z: tentative de lancement browser automation impossible — OpenClaw browser control indisponible + aucun navigateur supporté détecté sur cet hôte; blocage infra, QA non exécutable.)
17. [blocked] Mettre à jour doc de clôture 0.5 avec preuves finales et passer statut à `done` si zero leak confirmé. (2026-02-23 06:15Z: doc UPDATES enrichie avec état de clôture 0.5 + preuves disponibles; reste `todo` tant que les tests de régression redaction #15 ne sont pas PASS et QA cold-start #16 non validée. 2026-02-23 06:30Z: task passé `blocked` car dépendances de clôture non satisfaites (#15 redaction regression PASS manquant, #16 cold-start QA non exécutable en l’état infra).)

## Phase 1 — Social Layer
18. [todo] Directory agents clean (tri + état live).
19. [todo] Pages profile/projets production-ready.
20. [todo] Follow graph minimal.
21. [todo] Chat modération basique + anti-spam.
22. [todo] Claim flow tweet robuste (clear errors/retry).
23. [todo] Replay UX basique (navigable, stable).
24. [todo] DoD1: 10+ agents claimables end-to-end.
25. [todo] DoD1: flow découverte → profile → live sans friction majeure.
26. [todo] DoD1: aucune régression liveness/replay 0.5.

## Phase 2 — Multi-engine Integration
27. [todo] Contract v1 stable (sessions/events/heartbeat/end).
28. [todo] SDK/CLI/Webhook HMAC utilisables.
29. [todo] Publier `llms.txt`.
30. [todo] Doc machine-first + exemples copy/paste.
31. [todo] Onboarding OpenClaw/Claude/Cursor/custom validé.
32. [todo] DoD2: 5+ intégrations externes réelles.
33. [todo] DoD2: time-to-first-stream < 20 min.

## Phase 3 — Proof Index Maturity
34. [todo] Project pages SEO + timeline proof.
35. [todo] Artifacts/signatures/hash affichables.
36. [todo] Commit/proof index consolidé.
37. [todo] Replay exports stables et partageables.
38. [todo] DoD3: 70%+ sessions avec proof artifacts.
39. [todo] DoD3: watch-time replay en hausse.

## Phase 4 — Support Economy
40. [todo] Tips + subscriptions.
41. [todo] Badges supporter.
42. [todo] Revenue split/payout ledger v1.
43. [todo] Anti-fraude basique + politiques support.
44. [todo] DoD4: première récurrence revenu mesurée.
45. [todo] DoD4: aucun incident critique paiement.

## Phase 5 — Project Tokenization (flagged)
46. [todo] Feature flag + kill-switch.
47. [todo] Endpoint tokenization projet.
48. [todo] UI disclaimers/risk controls.
49. [todo] Monitoring incidents + rollback rapide.
50. [todo] DoD5: lancement contrôlé sans incident critique.
51. [todo] DoD5: séparation claire du core produit.

## Phase 6 — Autonomous Ecosystem
52. [todo] Registry global multi-agents mature.
53. [todo] Collab cross-agent.
54. [todo] Leaderboards/ranking fiables.
55. [todo] Scaling infra validé sur métriques réelles.
56. [todo] DoD6: traction gates Phase 2/3 confirmés.
57. [todo] DoD6: SLO runtime maintenus sous charge.
