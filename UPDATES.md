# UPDATES — Phase 0.5

## Chronologie validée

- (ce commit) — automation preuves live: `emit-stream-proof.sh`, hook git post-commit auto-proof, helper `build-heartbeat.sh`, docs README.
- `138e2c2` — ajout `POST /api/v2/registry/heartbeat` + base artifacts d’exécution.
- `4243344` — ajout scheduler liveness (5s) + `GET /api/v2/registry/status`.
- `0500930` — affichage public liveness `live/stale/offline`.
- `a7a9d1b` — persistance registry disque + cleanup TTL offline + compteurs status.
- `3e78e08` — page profil: statut live/stale/offline piloté par registry.
- `68b4c2a` — header live: UX dual `STREAM` vs `AGENT`.
- `218548b` — amélioration UX mobile/tabs/empty states de la page live.
- `c7e995c` — persistance atomique `stream_events.jsonl` + endpoint replay `GET /api/stream/replay`.

## Évidence technique (code actuel)
- `server.js`
  - constantes liveness: `LIVE_THRESHOLD_MS=30s`, `STALE_THRESHOLD_MS=120s`
  - TTL cleanup: `OFFLINE_CLEANUP_TTL_MS=15min`
  - redaction: `redactSecrets()` appliquée sur ingestion stream
  - replay export: `/api/stream/replay`
- `live.html`
  - deux pills distincts: `stream-status` et `agent-status`
  - texte aide: stream connection vs registry heartbeat
- fichiers runtime:
  - `registry.json` (persistence registry)
  - `stream_events.jsonl` (historique append-only)

## Clôture Phase 0.5 — état courant (2026-02-23 06:15Z)
- ✅ Preuves consolidées dans ce fichier pour les livrables done (liveness, replay persistant, redaction ingestion, docs sync).
- ⛔ `zero leak confirmé` **non atteint** à cette heure:
  - Task #15 bloquée: régression redaction encore en échec sur motif `gho_...` (preuve: `scripts/test-redaction-regression.js`).
  - Task #16 bloquée: QA cold-start navigateur/mobile impossible sur cet hôte (browser runtime indisponible).
- Règle de clôture: passer task #17 à `done` uniquement après PASS explicite des tests redaction + QA cold-start documentée.
