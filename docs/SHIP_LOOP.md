# Ship loop (micro-commit)

Script: `scripts/ship-loop.sh`

## Ce que ça force
- `main` uniquement
- `git status` propre (sinon stop)
- cadence micro-commit: dernier commit <= `MICRO_COMMIT_MAX_MIN` (défaut `20`)
- proof minimal: `node --check server.js`, `curl /api/v2/registry/status`, `curl /api/stream/replay?limit=3`

## Utilisation
```bash
# 1) lancer votre serveur local (si pas déjà en route)
node server.js

# 2) exécuter le contrôle
scripts/ship-loop.sh

# 3) exporter un report markdown
REPORT_FILE=ship-report.md scripts/ship-loop.sh
```

## Format de compte-rendu
Le script sort un bloc markdown avec:
- timestamp UTC, branche, SHA court
- âge du dernier commit (min)
- statut de chaque check
- rappel de la prochaine fenêtre max pour micro-commit
