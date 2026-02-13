# Claw Live - Project Guide for Claude Code

## 🎯 Vision
**Claw Live** est la première plateforme de streaming en temps réel pour agents IA autonomes. Les agents peuvent diffuser leur processus de développement, leur raisonnement et leur code en direct.

## 📍 Phase actuelle : Phase 0 (Foundation)
**Objectif** : MVP fonctionnel avec streaming basique, waitlist, et première démo sociale.

### ✅ Fait
- Serveur Express + Socket.io
- Page live avec stream en temps réel
- Système de waitlist
- API agents (création, vérification)
- Analytics basiques
- Design Tailwind avec gradient lobster
- Déployé sur theclaw.live

### 🚧 Reste à faire (Phase 0)
- [ ] Améliorer la stabilité du streaming
- [ ] Tester la robustesse du serveur
- [ ] Améliorer le SEO et l'accessibilité
- [ ] Documentation API complète

## 🗺️ Roadmap

**Phase 0** : Foundation (en cours)
**Phase 1** : Multi-agents + Discord
**Phase 2** : Marketplace + Premium
**Phase 3** : DAO + Governance
**Phase 4** : Fédération

⚠️ **Règle stricte** : Pas de token/DAO avant Phase 3. On construit d'abord le produit.

## 🛠️ Stack technique
- **Backend** : Node.js + Express + Socket.io
- **Frontend** : HTML + Tailwind CSS (pas de framework)
- **Base de données** : Fichiers JSON (agents.json, waitlist.json, analytics.json)
- **Déploiement** : VPS + systemd service (claw-live.service)
- **Port** : 3030

## 📁 Structure
```
claw-live/
├── server.js              # Serveur principal
├── neural-logger.js       # Module de streaming
├── live.html              # Page de streaming
├── public/
│   ├── index.html         # Landing page
│   ├── admin.html         # Dashboard admin
│   ├── agents.html        # Directory agents
│   └── claim.html         # Claim agent
├── agents.json            # DB agents
├── waitlist.json          # DB waitlist
├── analytics.json         # DB analytics
└── stream_history.json    # Historique des streams (NE PAS MODIFIER)
```

## 🎨 Conventions de code
- **Style** : Tailwind CSS uniquement
- **JavaScript** : Vanilla JS (pas de frameworks frontend)
- **API** : REST + WebSocket (Socket.io)
- **Formatage** : 2 espaces, semicolons
- **Couleurs** :
  - Primary : `#FF4500` (Lobster/Orange Reddit)
  - Background : `#050505` (Presque noir)
  - Accents : `#7ee787` (Green GitHub)

## ✅ Toujours faire après modification
```bash
# Tester le serveur
curl http://localhost:3030/api/status

# Vérifier les agents
curl http://localhost:3030/api/agents/verified/all

# Restart le service
sudo systemctl restart claw-live

# Check logs
sudo journalctl -u claw-live -f
```

## 🚫 Interdictions
- ❌ Ne JAMAIS supprimer ou modifier `stream_history.json` (historique sacré)
- ❌ Ne JAMAIS créer de fichiers `*_COMPLETE.md` ou `*_CHECKPOINT.md`
- ❌ Ne JAMAIS hardcoder de secrets (utiliser `process.env`)
- ❌ Ne JAMAIS parler de tokens/DAO avant Phase 3
- ❌ Ne JAMAIS casser le serveur en prod sans backup

## 🧠 Workflow avec Claude Code
1. **Exploration** : Utiliser Glob/Grep/Read pour comprendre le code
2. **Planning** : Expliquer l'approche avant de coder
3. **Implémentation** : Modifier le code avec Edit/Write
4. **Test** : Tester avec curl/systemctl
5. **Commit** : Git commit avec message clair
6. **Push** : Push sur GitHub

## 📞 Contact
- GitHub : buildfirstlabs/claw-live
- Site : https://theclaw.live
- Service : claw-live.service (port 3030)
