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
16. [blocked] Re-run cold-start QA (nouvelle session navigateur + mobile) et documenter PASS. (2026-02-23 06:00Z: tentative de lancement browser automation impossible — OpenClaw browser control indisponible + aucun navigateur supporté détecté sur cet hôte; blocage infra, QA non exécutable. 2026-02-23 06:45Z: recheck effectué via browser status (`running=false`, `detectedBrowser=null`) → blocage infra confirmé, QA toujours non exécutable sur cet hôte. 2026-02-23 07:00Z: 3e cycle bloqué confirmé (`running=false`, `detectedBrowser=null`) → ESCALADE: dépendance runtime navigateur absente sur l’hôte; on bascule sur le prochain task prêt #18 en attendant déblocage infra.)
17. [blocked] Mettre à jour doc de clôture 0.5 avec preuves finales et passer statut à `done` si zero leak confirmé. (2026-02-23 06:15Z: doc UPDATES enrichie avec état de clôture 0.5 + preuves disponibles; reste `todo` tant que les tests de régression redaction #15 ne sont pas PASS et QA cold-start #16 non validée. 2026-02-23 06:30Z: task passé `blocked` car dépendances de clôture non satisfaites (#15 redaction regression PASS manquant, #16 cold-start QA non exécutable en l’état infra).)

## Phase 1 — Social Layer
18. [done] Directory agents clean (tri + état live). (2026-02-23 07:16Z: directory `/agents` now merges registry runtime status (`live/stale/offline`), sorts cards by status priority then name, and shows accurate status chip; proof commit `1fab4a9`.)
19. [todo] Pages profile/projets production-ready. (2026-02-23 07:30Z: étape atomique livrée — ajout route page projet dédiée `/agents/:agentName/projects/:projectId` + liens projets du profil redirigés vers cette page; reste du hardening/UI final à terminer dans prochains cycles.) (2026-02-23 07:33Z: step atomique livré — cards projets du profile pointent vers `/agents/:agent/projects/:projectId` + nouvelle page projet serveur (hero + description + repo + CTA live/replay). Reste à finaliser critères “production-ready” complets avant passage `done`.) (2026-02-23 07:45Z: étape atomique livrée — hardening sécurité de la page projet: échappement HTML des champs dynamiques (nom/status/description/github/id) + URLs encodées pour éviter injection/XSS; preuve commit `16a30f3` + `node --check server.js` PASS.) (2026-02-23 08:00Z: étape atomique livrée — normalisation robuste du badge statut projet (`LIVE` insensible à la casse) + lien profil encodé/réutilisé (`profileHref`) pour éviter incohérences d’URL sur identifiants spéciaux; preuve commit `<pending>` + `node --check server.js` PASS.) (2026-02-23 08:00Z: étape atomique livrée — robustesse status/profile links sur page projet: détection `LIVE` rendue case-insensitive (`projectIsLive`) + `profileHref` encodé/réutilisé pour tous les liens retour profil; preuve `node --check server.js` PASS.) (2026-02-23 08:15Z: étape atomique livrée — encodage systématique des segments URL dynamiques sur page profile (`agentName`, `project.id`) pour liens projets + CTA live/history, afin d’éviter liens cassés sur identifiants spéciaux; preuve commit `a0b78bb` + `node --check server.js` PASS.) (2026-02-23 08:30Z: étape atomique livrée — échappement HTML des champs dynamiques sur les cards projets de la page profile (`name/github/status/description`) + badge LIVE case-insensitive, pour éviter injection XSS côté profile; preuve commit `9ffa797` + `node --check server.js` PASS.) (2026-02-23 08:46Z: étape atomique livrée — carte Repository de la page projet durcie/production-ready: lien externe cliquable seulement si URL `http/https` valide (`toSafeExternalHref`), sinon fallback texte neutre; ajout `target=_blank` + `rel="noopener noreferrer"` pour sécurité. preuve commit `181bf45` + `node --check server.js` PASS.) (2026-02-23 09:00Z: étape atomique livrée — hardening page history: handle agent échappé dans title/H1 (`safeAgentName`) + liens `Watch Live`/`Back to Profile` encodés (`encodeURIComponent`) pour éviter injection/URL cassées via identifiants spéciaux; preuve commit `a15a364` + `node --check server.js` PASS.) (2026-02-23 09:15Z: étape atomique livrée — hardening profile page: échappement des champs dynamiques `agentName` (incluant 404/title/UI), `bio`, `owner_email`, `createdDate`, et construction sûre du lien Twitter via handle normalisé+encodé pour réduire risques XSS/injection attributaire; preuve commit `<pending>` + `node --check server.js` PASS.) (2026-02-23 09:15Z: étape atomique livrée — page 404 profile durcie: handle agent non-claimé échappé via `safeAgentParam` pour éviter injection HTML dans message `Agent Not Found`; preuve commit `5449ce5` + `node --check server.js` PASS.) (2026-02-23 09:15Z: étape atomique livrée — CTA Follow de la page profile durcie: `twitterHref` validé via `toSafeExternalHref` + ajout `rel="noopener noreferrer"` sur lien externe `target=_blank` pour réduire risques d’URL unsafe/tabnabbing; preuve commit enregistré + `node --check server.js` PASS.) (2026-02-23 09:30Z: étape atomique livrée — réponse API claim flow durcie: `profileUrl` renvoyée par `/api/agents/verify-tweet` encode désormais `agentName` via `encodeURIComponent` pour éviter URL cassées/injection de chemin; preuve commit `<pending>` + `node --check server.js` PASS.) (2026-02-23 09:46Z: étape atomique livrée — normalisation robuste du compteur followers sur page profile: conversion numérique stricte de `agent.followers`, fallback sécurisé si valeur invalide, et rendu via `followerCountK` pré-calculé pour éviter affichage `NaN`/valeurs non fiables; preuve commit `<pending>` + `node --check server.js` PASS.) (2026-02-23 09:45Z: étape atomique livrée — hardening robustesse cards projets profile: lien projet construit via `projectIdRaw` (trim) et fallback `#` si id absent pour éviter URLs `/projects/undefined` en production; preuve commit enregistré + `node --check server.js` PASS.) (2026-02-23 10:00Z: étape atomique livrée — hardening CTA live de la page projet: `liveHref` construit depuis `projectIdRaw` (trim) avec fallback `#` si id manquant pour éviter route `/live/.../undefined`; preuve commit `<pending>` + `node --check server.js` PASS.) (2026-02-23 10:00Z: étape atomique livrée — hardening robustesse page projet: lien CTA `Watch Live` sécurisé avec `projectIdRaw` (trim) et fallback `#` si `project.id` absent pour éviter URLs live cassées sur données incomplètes; preuve commit `pending` + `node --check server.js` PASS.) (2026-02-23 10:00Z: no-op contrôlé — tentative de nouveau hardening CTA live abandonnée car protection `projectIdRaw` + fallback `#` déjà présente dans `server.js`; validation exécutée via `grep projectIdRaw` + `node --check server.js` PASS. Task #19 reste `todo`.) (2026-02-23 10:15Z: étape atomique livrée — hardening robustesse page history: normalisation `primaryProjectIdRaw` (trim string) + fallback explicite `claw-live` avant construction de `liveHref`, pour éviter route `/live/.../undefined` si `projects[0].id` est vide/null; preuve commit `<pending>` + `node --check server.js` PASS.) (2026-02-23 10:30Z: étape atomique livrée — hardening CTA principal de la page profile: normalisation `primaryProjectIdRaw` (trim) + fallback `claw-live` avant encodage, pour éviter lien `Go Live Feed` cassé quand `projects[0].id` est vide/null; preuve commit `ffa795d` + `node --check server.js` PASS.) (2026-02-23 10:45Z: étape atomique livrée — robustesse lookup projet sur route `/agents/:agentName/projects/:projectId`: normalisation `requestedProjectId` (trim + lowercase) et comparaison contre `p.id` normalisé (`String(p.id || '').trim().toLowerCase()`), pour éviter faux 404 sur IDs avec espaces/casse variable; preuve commit `474632a` + `node --check server.js` PASS.) (2026-02-23 11:00Z: étape atomique livrée — robustesse profile page: fallback `createdDateStr='Unknown'` si `agent.created_at` est invalide (`Invalid Date`) pour éviter rendu date cassé en production; preuve commit `5d14a67` + `node --check server.js` PASS.) (2026-02-23 11:15Z: étape atomique livrée — hardening profile page: compteur `Total Commits` désormais normalisé côté serveur (`Number(agent.commits)` + garde `>=0` + `Math.floor`), pour éviter affichage non fiable/injection si la donnée est corrompue/non numérique; preuve commit `0b7e9e3` + `node --check server.js` PASS.) (2026-02-23 11:30Z: étape atomique livrée — hardening sécurité liens externes de l’en-tête profile: ajout `rel="noopener noreferrer"` sur liens `x.com/claw_live` et GitHub ouverts en `target="_blank"` pour réduire risque tabnabbing; preuve commit `8b7db25` + `node --check server.js` PASS.)
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
