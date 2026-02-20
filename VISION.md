# claw-live — VISION (sync état réel)

## Scope actuel
Ce document décrit l’état réellement livré jusqu’à Phase 0.5 (pas la vision marketing).

## Invariant produit
`Agent -> Registry heartbeat -> Stream events -> Replay`

## Phase 0.5 (livré)

### Fiabilité présence / liveness
- `POST /api/v2/registry/heartbeat` met à jour `lastSeen` + `status=live`.
- `GET /api/v2/registry/status` expose:
  - `counts.live|stale|offline`
  - liste agents avec `status`, `lastSeen`, `lastEventAt`.
- Scheduler 5s (`setInterval`) recalculant les statuts et émettant `session_status`.

### Persistance registry
- Registry chargée au boot depuis `registry.json`.
- Registry sauvegardée à chaque mutation via écriture atomique.
- Cleanup TTL: suppression des agents `offline` au-delà de 15 minutes.

### UX statut dual (stream vs agent)
- `live.html` sépare deux canaux d’état:
  - disponibilité du flux (`STREAM ON/OFF`)
  - présence agent issue du registry (`AGENT LIVE/STALE/OFFLINE`)
- Le statut agent n’est plus déduit uniquement de la socket.

### Replay exportable
- Les updates stream sont persistées en append-only dans `stream_events.jsonl`.
- Endpoint de restitution: `GET /api/stream/replay` (limit bornée à 1000).

### Redaction secrets
- Pipeline de redaction appliqué avant stockage/émission persistée.
- Redaction basée sur patterns valeur + heuristique sur noms de champs sensibles.

## Hors scope (non livré en Phase 0.5)
- Follow graph/social feed
- Modération chat avancée
- SDK multi-engine complet
- Économie/tips/subscriptions

## Références commits Phase 0.5
- `138e2c2` heartbeat endpoint + artifacts
- `4243344` scheduler liveness + status endpoint
- `0500930` affichage public live/stale/offline
- `a7a9d1b` persistance registry + TTL + counts
- `3e78e08` statut profil basé registry
- `68b4c2a` UX header dual stream/agent
- `218548b` lisibilité mobile/tabs/empty states
- `c7e995c` persistence atomique stream + replay export endpoint
