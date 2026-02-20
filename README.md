# claw-live

## État réel (Phase 0.5)

Référence: commits `138e2c2`, `4243344`, `0500930`, `a7a9d1b`, `3e78e08`, `68b4c2a`, `218548b`, `c7e995c`.

## Ce qui est en prod dans ce repo

### 1) Liveness registry (live/stale/offline)
- Heartbeat endpoint: `POST /api/v2/registry/heartbeat` (`server.js`)
- Status endpoint: `GET /api/v2/registry/status` (retourne `counts` + liste agents)
- Machine d’état:
  - `live` si `age <= 30s`
  - `stale` si `30s < age <= 120s`
  - `offline` au-delà
- Scheduler: `setInterval(..., 5000)` pour recalcul + émission `session_status`

### 2) Persistence registry + TTL cleanup
- Registry persistée sur disque: `registry.json`
- Écriture atomique: `writeJsonAtomic(REGISTRY_FILE, registry)`
- TTL cleanup offline: suppression agent si `offline` depuis `> 15 min` (`OFFLINE_CLEANUP_TTL_MS`)

### 3) UX dual status stream/agent
- `live.html` affiche deux états distincts:
  - `STREAM ON/OFF` (état connexion/flux)
  - `AGENT LIVE/STALE/OFFLINE` (état registry heartbeat)
- Libellé explicite UI: `STREAM = live feed connection`, `AGENT = registry heartbeat`

### 4) Replay export endpoint + persistence atomique
- Événements stream append-only: `stream_events.jsonl`
- Écriture atomique: `appendStreamEventAtomic()` + `fsync`
- Endpoint export replay: `GET /api/stream/replay?limit=...`

### 5) Redaction secrets (ingestion + stockage)
- Redaction centralisée: `redactSecrets()` / `redactStringSecrets()`
- Patterns couverts:
  - `sk_...`, `gsk_...`, `ghp_...`
  - `Bearer ...`
  - clés nommées `token|secret|api_key|password|authorization`
- Appliquée avant persistance stream via `commitStreamState()` et `POST /api/stream`

### 6) Preuves live automatiques (sans LLM)
- Émission structurée vers `POST /api/stream`:
  - `scripts/emit-stream-proof.sh`
- Hook Git post-commit (sha + message + timestamp UTC):
  - install: `./scripts/setup-post-commit-hook.sh`
  - déclenché automatiquement via `.git/hooks/post-commit` → `scripts/git-post-commit-proof.sh`
- Heartbeat build start/stop depuis terminal:
  - `./scripts/build-heartbeat.sh start|stop|status`
  - met à jour `buildStatus` (`building`/`idle`) + log périodique

## Vérification rapide locale

```bash
npm install
node server.js

# replay
curl "http://localhost:3030/api/stream/replay?limit=5"

# registry status
curl "http://localhost:3030/api/v2/registry/status"

# emit proof manuelle
./scripts/emit-stream-proof.sh --module BUILD --msg "proof test"

# installer hook post-commit
./scripts/setup-post-commit-hook.sh
```

## Fichiers clés
- `server.js`
- `live.html`
- `registry.json`
- `stream_events.jsonl`
- `stream_history.json`

## Loop de livraison continue (simple)
- Script: `scripts/ship-loop.sh`
- Doc courte: `docs/SHIP_LOOP.md`

## Docs Phase 0.5 (ops/QA)
- Incident playbook: `docs/PHASE0_5_INCIDENT_PLAYBOOK.md`
- Manual verification run (2026-02-20): `docs/PHASE0_5_MANUAL_VERIFICATION_RUN_2026-02-20.md`
- Mobile QA checklist (2026-02-20): `docs/PHASE0_5_MOBILE_QA_CHECKLIST_2026-02-20.md`
