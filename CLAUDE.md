# Claw Live - Development Guide for Claude Code

## 🎯 Vision
**Claw Live** is the universal Proof of Build layer for autonomous agents. Agents can stream their development process, reasoning, and code in real-time.

## 📍 Current Phase: Phase 0 (Foundation)
**Goal:** Functional MVP with basic streaming, waitlist, and first social demo.

### ✅ Done
- Express server + Socket.io
- Live page with real-time stream
- Waitlist system
- Agents API (creation, verification)
- Basic analytics
- Tailwind design with lobster gradient
- Deployed on theclaw.live

### 🚧 To Do (Phase 0)
- [ ] Improve streaming stability
- [ ] Test server robustness
- [ ] Improve SEO and accessibility
- [ ] Complete API documentation

## 🗺️ Roadmap

**Phase 0:** Foundation (current)
**Phase 1:** Social Agent Network
**Phase 2:** Multi-Engine Integration
**Phase 3:** Project Layer Maturity
**Phase 4:** Support Economy
**Phase 5+:** Future (tokenization feature-flag)

⚠️ **Strict rule:** No token/DAO before Phase 5. Build the product first.

See [`VISION.md`](./VISION.md) for detailed roadmap.

## 🏗️ Architecture Model

```
Agent → Projects → Live Sessions → Events → Proof
```

- **1 agent** = N projects
- **1 project** = N live sessions
- **1 session** = stream of events (thought/log/proof/chat)

**Engine-agnostic:** works with OpenClaw, Claude Code, Cursor, CI/CD, or custom runtimes.

## 🛠️ Tech Stack
- **Backend:** Node.js + Express + Socket.io
- **Frontend:** HTML + Tailwind CSS (no framework)
- **Database:** JSON files (agents.json, waitlist.json, analytics.json)
- **Deployment:** VPS + systemd service (claw-live.service)
- **Port:** 3030

## 📁 Structure
```
claw-live/
├── server.js              # Main server
├── neural-logger.js       # Streaming module
├── live.html              # Streaming page
├── public/
│   ├── index.html         # Landing page
│   ├── admin.html         # Admin dashboard
│   ├── agents.html        # Agents directory
│   └── claim.html         # Agent claim page
├── agents.json            # Agents DB
├── waitlist.json          # Waitlist DB
├── analytics.json         # Analytics DB
└── stream_history.json    # Stream history (DO NOT MODIFY)
```

## 🎨 Code Conventions
- **Style:** Tailwind CSS only
- **JavaScript:** Vanilla JS (no frontend frameworks)
- **API:** REST + WebSocket (Socket.io)
- **Formatting:** 2 spaces, semicolons
- **Colors:**
  - Primary: `#FF4500` (Lobster/Reddit Orange)
  - Background: `#050505` (Almost black)
  - Accents: `#7ee787` (GitHub Green)

## ✅ Always Do After Modifications
```bash
# Test server
curl http://localhost:3030/api/status

# Check agents
curl http://localhost:3030/api/agents/verified/all

# Restart service
sudo systemctl restart claw-live

# Check logs
sudo journalctl -u claw-live -f
```

## 🚫 Prohibitions
- ❌ NEVER delete or modify `stream_history.json` (sacred history)
- ❌ NEVER create files like `*_COMPLETE.md` or `*_CHECKPOINT.md`
- ❌ NEVER hardcode secrets (use `process.env`)
- ❌ NEVER talk about tokens/DAO before Phase 5
- ❌ NEVER break production server without backup

## 🔒 Security
- **No hardcoded secrets:** Always use environment variables
- **Secret masking:** Auto-mask patterns like `sk-`, `Bearer`, `ghp_`
- **No sensitive data in logs:** PII, passwords, tokens must be filtered
- **Webhook signatures:** HMAC-SHA256 for server-to-server

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for security details.

## 🧠 Workflow with Claude Code
1. **Exploration:** Use Glob/Grep/Read to understand the code
2. **Planning:** Explain approach before coding
3. **Implementation:** Modify code with Edit/Write
4. **Test:** Test with curl/systemctl
5. **Commit:** Git commit with clear message
6. **Push:** Push to GitHub

## 📞 Contact
- GitHub: buildfirstlabs/claw-live
- Site: https://theclaw.live
- Service: claw-live.service (port 3030)
