# Phase 0.5 Closure Check — 2026-02-22

Date (UTC): 2026-02-22
Operator: subagent QA closure run
Scope demandé: test froid live persistent (nouvelle session), checks `/api/v2/registry/status` et `/api/stream/replay`, UX mobile non‑négociables (swipe, scroll interne, panels même hauteur, header agent-first), sécurité redaction visible.

## Méthode
- Serveur local `http://localhost:3030`
- Redémarrage serveur pour test « cold » (nouvelle session)
- Chargement `/live` avec UA mobile iPhone Safari + Android Chrome et cookie jars neufs
- Vérification API via `curl`
- Vérifications UX mobiles via:
  - marqueurs DOM servis sur `/live`
  - contrat CSS/JS dans `live.html` (handlers touch, scroll interne, layout)
- Vérification redaction via injection contrôlée puis replay `raw=1`

## Résultats détaillés (PASS/FAIL)

| Check | Verdict | Evidence |
|---|---|---|
| Cold start + nouvelle session `/live` (iPhone) | **PASS** | `IPHONE_LIVE_HTTP:200`, URL finale `/live/ClawCaster/claw-live` |
| Cold start + nouvelle session `/live` (Android) | **PASS** | `ANDROID_LIVE_HTTP:200`, URL finale `/live/ClawCaster/claw-live` |
| Persistance replay après redémarrage serveur | **PASS** | Événement `closure2-20260222T022434Z` retrouvé après restart dans `/api/stream/replay?raw=1` |
| `/api/v2/registry/status` disponible | **PASS** | JSON valide retourné post-restart, agent runtime présent (`live`) |
| `/api/stream/replay` disponible | **PASS** | JSON valide retourné (`mode=quality_gate` et `mode=raw`) |
| UX mobile — swipe tabs (narrative/proof/debug) | **PASS** | `touchstart/touchend` + seuils swipe (`45/60px`) et `switchTab` présents dans `live.html` |
| UX mobile — scroll interne panel | **PASS** | `.scroll-y{overflow-y:auto; touch-action:pan-y; -webkit-overflow-scrolling:touch}` + panels `flex-1 scroll-y` |
| UX mobile — panels même hauteur (contrat layout) | **PASS** | `main.feed-wrap` + `section ... h-full` + `aside ... h-full` (layout contract en place) |
| UX mobile — header agent-first visible | **PASS** | Libellé `Agent-first live feed` présent et servi sur `/live` |
| Sécurité — redaction visible sur replay | **FAIL** | Redaction **partielle** observée: `token=...` devient `[REDACTED]`, mais `authorization=Bearer ...` et `ghp_...` restent visibles |

## Preuve redaction (extrait)
Replay `raw=1` contient:

```json
{"type":"stream.update","payload":{"terminal":"echo closure2-20260222T022434Z [REDACTED]","log":{"level":"info","module":"SECURITY","msg":"closure2-20260222T022434Z [REDACTED] authorization=Bearer abc123 ghp_ABCDEF1234567890"}},"ts":"2026-02-22T02:24:34.111Z"}
```

=> Redaction visible mais incomplète sur secrets auth/token GitHub-like.

## Conclusion de clôture Phase 0.5
- Bloc fiabilité/live/replay/UX mobile structurelle: **PASS**
- Bloc sécurité redaction visible: **FAIL** (bloquant pour clôture stricte)

**Statut global clôture Phase 0.5: FAIL** (jusqu’à correction de la couverture de redaction).
