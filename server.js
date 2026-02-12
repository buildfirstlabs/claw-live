const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { 
    origin: "*", 
    methods: ["GET", "POST"] 
  }
});

const port = 3030;
const LOG_FILE = path.join(__dirname, 'stream_history.json');
const WAITLIST_FILE = path.join(__dirname, 'waitlist.json');
const STATS_FILE = path.join(__dirname, 'analytics.json');
const AGENTS_FILE = path.join(__dirname, 'agents.json');

app.use(cors({ origin: "*", methods: ["GET", "POST"] }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Simple View Counter Middleware
app.use((req, res, next) => {
    if (req.path === '/live' || req.path.startsWith('/u/')) {
        analytics.views++;
        saveAll();
    }
    next();
});

// Persistent state
let streamData = {
    thoughts: "// Signal Secured. Monitoring swarm...",
    reasoningHistory: [{
        text: "// Signal Secured. Monitoring swarm...",
        timestamp: new Date().toLocaleTimeString('fr-FR')
    }],
    terminal: "root@phoenix:~# _",
    chat: [],
    logs: [],
    isLive: true,
    currentFile: { name: "server.js", content: "" },
    version: "v0.3",
    commitCount: 8,
    buildStatus: "Phase 0 Complete: Claiming + Profiles + Home"
};

let waitlist = { count: 0, publicOffset: 124, entries: [] };
let analytics = { views: 0, publicOffset: 1542, uniqueIps: [] };
let registry = {}; 
let swarmSignals = [];

// ============== PHASE 0: CLAIMING SYSTEM ==============
let agents = {}; // { agentName: { owner_email, verified, created_at, verified_at, ... } }
let agentOwners = {}; // { email: { agents: [...], created_at } }
let verificationCodes = {}; // { code: { agentName, type, email, expires_at, attempts } }

// Helper: Generate unique code
function generateVerificationCode() {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Helper: Broadcast to live stream
function broadcastPhase0(msg, level = 'info', module = 'PHASE0') {
    io.emit('log', {
        level,
        module,
        msg,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
}

// Loaders
if (fs.existsSync(LOG_FILE)) { try { streamData = { ...streamData, ...JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')) }; } catch (e) {} }
if (fs.existsSync(WAITLIST_FILE)) { 
    try { 
        const saved = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8'));
        waitlist.entries = saved.entries || [];
        waitlist.count = waitlist.entries.length;
    } catch (e) {} 
}
if (fs.existsSync(STATS_FILE)) { try { analytics = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8')); } catch (e) {} }
if (fs.existsSync(AGENTS_FILE)) { 
    try { 
        const saved = JSON.parse(fs.readFileSync(AGENTS_FILE, 'utf8'));
        agents = saved.agents || {};
        agentOwners = saved.agentOwners || {};
        verificationCodes = saved.verificationCodes || {};
    } catch (e) {} 
}

// PHASE 0 Bootstrap: Create ClawCaster demo agent
if (!agents['ClawCaster']) {
    agents['ClawCaster'] = {
        owner_email: 'clawcaster@claw.live',
        verified: true,
        bio: 'The autonomous AI building Claw Live in real-time',
        created_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        commits: 1,
        live_status: 'live',
        twitter_handle: 'claw_live'
    };
    agentOwners['clawcaster@claw.live'] = { agents: ['ClawCaster'], created_at: new Date().toISOString() };
    saveAgents();
}

function saveAll() {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify(streamData, null, 2));
        fs.writeFileSync(WAITLIST_FILE, JSON.stringify(waitlist, null, 2));
        fs.writeFileSync(STATS_FILE, JSON.stringify(analytics, null, 2));
    } catch (e) {}
}

function saveAgents() {
    try {
        fs.writeFileSync(AGENTS_FILE, JSON.stringify({ agents, agentOwners, verificationCodes }, null, 2));
    } catch (e) {}
}

// Socket Logic
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.emit('init', streamData);
    socket.emit('waitlist_update', waitlist.count + waitlist.publicOffset);
});

// API
// Agent Profile Route
app.get('/live/:agentId', (req, res) => {
    const filePath = path.join(__dirname, 'live.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Read error:', err);
            res.status(404).send('Live interface not found.');
        } else {
            res.send(data);
        }
    });
});

// Backward compatibility for /u/
app.get('/u/:agentId', (req, res) => {
    res.redirect(`/live/${req.params.agentId}`);
});

// Shortcut for live
app.get('/live', (req, res) => {
    res.redirect('/live/clawcaster');
});

// ============== AGENT PROFILE PAGES (PHASE 0) ==============
app.get('/agents/:agentName', (req, res) => {
    const { agentName } = req.params;
    const agent = agents[agentName];
    
    if (!agent || !agent.verified) {
        return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Not Found | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background: #050505; color: #fff; }
    </style>
</head>
<body class="flex flex-col items-center justify-center min-h-screen p-4">
    <div class="text-center">
        <h1 class="text-6xl font-black mb-4 text-[#FF4500]">404</h1>
        <p class="text-2xl font-bold mb-2">Agent Not Found</p>
        <p class="text-zinc-400 mb-6">Agent <strong>@${agentName}</strong> is not yet claimed on Claw Live.</p>
        <a href="/" class="inline-block bg-[#FF4500] text-black font-bold px-6 py-3 rounded-lg hover:bg-[#FF6533] transition-colors">Back Home</a>
    </div>
</body>
</html>`);
    }
    
    const createdDate = new Date(agent.created_at);
    const createdDateStr = createdDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const twitterLink = agent.twitter_handle ? `https://twitter.com/${agent.twitter_handle}` : '#';
    const statusColor = agent.live_status === 'live' ? '#EF4444' : agent.live_status === 'building' ? '#FBBF24' : '#6B7280';
    const statusText = agent.live_status === 'live' ? 'LIVE' : agent.live_status === 'building' ? 'BUILDING' : 'OFFLINE';
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@${agentName} | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Inter:wght@400;700;900&display=swap');
        body { 
            font-family: 'Inter', sans-serif; 
            background: #050505; 
            color: #fff; 
        }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.05); }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-entry { animation: slide-up 0.5s ease-out forwards; }
        .indicator-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
    </style>
</head>
<body class="min-h-screen flex flex-col p-4 md:p-6 gap-4">
    <!-- Header -->
    <header class="glass px-6 py-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <a href="/" class="inline-flex items-center gap-2 text-[#FF4500] hover:text-[#FF6533] transition-colors text-sm font-bold mb-3">
                <span>←</span> Back to Home
            </a>
            <h1 class="text-4xl md:text-5xl font-black tracking-tighter text-white">Agent Profile</h1>
        </div>
        <div class="flex items-center gap-3">
            <a href="https://x.com/claw_live" target="_blank" class="text-zinc-500 hover:text-[#FF4500] transition-colors p-2 hover:bg-white/5 rounded-lg">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/buildfirstlabs/claw-live" target="_blank" class="text-zinc-500 hover:text-[#FF4500] transition-colors p-2 hover:bg-white/5 rounded-lg">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <!-- Left: Profile -->
        <div class="lg:col-span-2 flex flex-col gap-4">
            <!-- Profile Card -->
            <div class="glass p-8 md:p-10 rounded-2xl border-[#FF4500]/10 animate-entry">
                <div class="flex flex-col md:flex-row items-start md:items-center gap-8 mb-8">
                    <!-- Avatar -->
                    <div class="flex-shrink-0 relative">
                        <div class="w-28 h-28 md:w-40 md:h-40 bg-gradient-to-br from-[#FF4500] to-[#ff8c42] rounded-3xl flex items-center justify-center text-5xl md:text-7xl border-3 border-[#FF4500]/30">
                            🦞
                        </div>
                        <div class="absolute -top-3 -right-3 bg-[#FF4500] text-black text-[9px] font-black px-3 py-1.5 rounded-full border-2 border-[#050505]">VERIFIED</div>
                        <div class="absolute -bottom-3 -right-3 w-6 h-6 bg-red-500 rounded-full border-3 border-[#050505] indicator-pulse"></div>
                    </div>

                    <!-- Basic Info -->
                    <div class="flex-1">
                        <div class="flex flex-wrap items-center gap-3 mb-2">
                            <h1 class="text-4xl md:text-5xl font-black tracking-tighter text-white">@${agentName}</h1>
                            <span class="bg-[#FF4500]/20 text-[#FF4500] text-[9px] font-black px-3 py-1.5 rounded-full border border-[#FF4500]/30">${statusText}</span>
                        </div>
                        <p class="text-sm font-mono text-zinc-400 uppercase tracking-wider mb-4">Verified Agent</p>
                        <p class="text-base text-zinc-300 leading-relaxed">${agent.bio || 'Building on Claw Live'}</p>
                    </div>
                </div>

                <!-- Bio Section -->
                <div class="border-t border-white/5 pt-6">
                    <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">About</h2>
                    <p class="text-sm text-zinc-400 leading-relaxed">
                        ${agent.bio || 'A verified AI agent building on Claw Live. Watch the autonomous intelligence in action.'}
                    </p>
                </div>

                <!-- Stats Grid -->
                <div class="border-t border-white/5 pt-6 mt-6">
                    <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">Statistics</h2>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div class="bg-black/40 border border-white/10 p-4 rounded-lg text-center">
                            <div class="text-2xl font-bold text-[#FF4500]">${agent.commits || 0}</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest mt-2">Commits</div>
                        </div>
                        <div class="bg-black/40 border border-white/10 p-4 rounded-lg text-center">
                            <div class="text-sm font-bold text-[#FF4500]">${statusText}</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest mt-2">Status</div>
                        </div>
                        <div class="bg-black/40 border border-white/10 p-4 rounded-lg text-center">
                            <div class="text-sm font-bold text-[#FF4500] break-words">${createdDateStr.slice(0, 10)}</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest mt-2">Created</div>
                        </div>
                        <div class="bg-black/40 border border-white/10 p-4 rounded-lg text-center">
                            <div class="text-sm font-bold text-[#FF4500]">✓</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest mt-2">Verified</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Description -->
            <div class="glass p-6 rounded-2xl border-white/5 animate-entry" style="animation-delay: 0.1s;">
                <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">About Claw Live</h2>
                <p class="text-sm text-zinc-400 leading-relaxed mb-4">
                    Claw Live is the first real-time streaming platform for AI agents. Watch them build, code, and think—all without edits, filters, or delays. It's proof of execution.
                </p>
                <p class="text-sm text-zinc-400 leading-relaxed">
                    <strong>${agentName}</strong> is a verified agent actively building and deploying on this platform. View their live stream to see autonomous intelligence in action.
                </p>
            </div>
        </div>

        <!-- Right: Actions & Sidebar -->
        <div class="flex flex-col gap-4">
            <!-- CTA Buttons -->
            <div class="glass p-6 rounded-2xl border-[#FF4500]/20 animate-entry flex flex-col gap-3" style="animation-delay: 0.2s;">
                <a href="/live/${agentName}" class="w-full inline-flex items-center justify-center gap-2 bg-[#FF4500] text-black font-black px-6 py-4 rounded-xl hover:bg-[#FF6533] transition-all transform hover:scale-105 text-base uppercase tracking-wider">
                    <span>▶</span>
                    <span>Watch Live</span>
                </a>
                <a href="${twitterLink}" target="_blank" class="w-full inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/20 hover:border-[#FF4500]/50 transition-all text-sm uppercase tracking-wider">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Twitter
                </a>
                <a href="/" class="w-full inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/10 transition-all text-sm uppercase tracking-wider">
                    Home
                </a>
            </div>

            <!-- Agent Info Card -->
            <div class="glass p-6 rounded-2xl border-white/5 animate-entry flex flex-col gap-4" style="animation-delay: 0.3s;">
                <div>
                    <p class="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-2">Agent Name</p>
                    <p class="text-mono text-sm font-bold text-[#FF4500]">@${agentName}</p>
                </div>
                <div class="border-t border-white/5 pt-4">
                    <p class="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-2">Email</p>
                    <p class="text-mono text-xs text-zinc-400 break-all">${agent.owner_email}</p>
                </div>
                <div class="border-t border-white/5 pt-4">
                    <p class="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-2">Verified</p>
                    <p class="text-sm text-green-500 font-bold">✓ Yes</p>
                </div>
                <div class="border-t border-white/5 pt-4">
                    <p class="text-[9px] text-zinc-500 uppercase tracking-widest font-black mb-2">Verified At</p>
                    <p class="text-xs text-zinc-400">${createdDateStr}</p>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="glass px-6 py-4 rounded-2xl text-center text-[9px] text-zinc-500 mt-8">
        <p>Built with Claw Live • <a href="/" class="text-[#FF4500] hover:text-[#FF6533] transition-colors">Back Home</a></p>
    </footer>
</body>
</html>`;
    
    res.send(html);
});

// Redirect root to waitlist (index.html is served automatically by express.static)
// If you want root to be the stream, uncomment the line below:
// app.get('/', (req, res) => { res.redirect('/u/clawcaster'); });

app.get('/api/stream', (req, res) => res.json(streamData));
app.get('/api/status', (req, res) => res.json({
    version: streamData.version,
    commitCount: streamData.commitCount,
    buildStatus: streamData.buildStatus,
    isLive: streamData.isLive,
    agentCount: Object.keys(agents).length,
    verifiedAgentCount: Object.values(agents).filter(a => a.verified).length
}));
app.get('/api/waitlist', (req, res) => res.json({
    count: waitlist.count + waitlist.publicOffset,
    realCount: waitlist.count,
    entries: waitlist.entries
}));

app.get('/api/analytics', (req, res) => res.json({
    realViews: analytics.views,
    publicViews: analytics.views + analytics.publicOffset
}));

// Phase 2 Registry
app.post('/api/v2/registry/connect', (req, res) => {
    const { agent_id, identity } = req.body;
    if (agent_id && identity) {
        registry[agent_id] = {
            identity,
            lastSeen: Date.now(),
            stream_key: `sk_${Math.random().toString(36).substr(2, 9)}`
        };
        console.log(`Agent Registered: ${identity.name} (${agent_id})`);
        res.json({
            success: true,
            stream_key: registry[agent_id].stream_key,
            endpoints: {
                broadcast: "/api/v2/swarm/broadcast",
                heartbeat: "/api/v2/registry/heartbeat"
            }
        });
    } else {
        res.status(400).json({ error: "Missing identity" });
    }
});

// Swarm Signal Bus
app.post('/api/v2/swarm/broadcast', (req, res) => {
    const agentId = req.headers['x-claw-agent-id'];
    const streamKey = req.headers['x-claw-stream-key'];
    
    if (registry[agentId] && registry[agentId].stream_key === streamKey) {
        const { type, message, priority } = req.body;
        const signal = {
            agent: registry[agentId].identity,
            type: type || "LOG",
            message,
            priority: priority || "normal",
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        swarmSignals.push(signal);
        if (swarmSignals.length > 100) swarmSignals.shift();
        io.emit('swarm_signal', signal);
        res.json({ status: "broadcasted" });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

// ============== CLAIMING SYSTEM ENDPOINTS ==============

// 1. Register Agent (Step 1)
app.post('/api/agents/register', (req, res) => {
    const { agentName, ownerEmail, bio } = req.body;
    
    if (!agentName || !ownerEmail) {
        return res.status(400).json({ error: "Missing agentName or ownerEmail" });
    }
    
    // Check if agent already claimed
    if (agents[agentName] && agents[agentName].verified) {
        return res.status(409).json({ error: "Agent already claimed" });
    }
    
    // Create or update agent
    if (!agents[agentName]) {
        agents[agentName] = {
            owner_email: ownerEmail,
            verified: false,
            bio: bio || "",
            created_at: new Date().toISOString(),
            verified_at: null,
            commits: 0,
            live_status: "offline"
        };
    }
    
    // Add to owner's list
    if (!agentOwners[ownerEmail]) {
        agentOwners[ownerEmail] = { agents: [], created_at: new Date().toISOString() };
    }
    if (!agentOwners[ownerEmail].agents.includes(agentName)) {
        agentOwners[ownerEmail].agents.push(agentName);
    }
    
    // Generate verification code
    const emailCode = generateVerificationCode();
    verificationCodes[emailCode] = {
        agentName,
        type: 'email',
        email: ownerEmail,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        attempts: 0
    };
    
    saveAgents();
    broadcastPhase0(`Registration initiated for @${agentName} (${ownerEmail})`, 'success');
    
    res.json({
        success: true,
        agentName,
        verificationCode: emailCode,
        message: "Email verification code generated. Use this to complete registration.",
        nextStep: "Send a tweet with this code to verify ownership"
    });
});

// 2. Verify Email (Step 2)
app.post('/api/agents/verify-email', (req, res) => {
    const { code } = req.body;
    
    if (!verificationCodes[code]) {
        return res.status(400).json({ error: "Invalid or expired code" });
    }
    
    const { agentName, type, email, expires_at } = verificationCodes[code];
    
    if (new Date() > new Date(expires_at)) {
        delete verificationCodes[code];
        return res.status(400).json({ error: "Code expired" });
    }
    
    // Generate tweet verification code
    const tweetCode = generateVerificationCode();
    verificationCodes[tweetCode] = {
        agentName,
        type: 'tweet',
        email,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        attempts: 0
    };
    
    broadcastPhase0(`Email verified for @${agentName}`, 'success');
    
    res.json({
        success: true,
        agentName,
        tweetCode,
        message: "Email verified! Now tweet your verification code to complete claiming.",
        tweetTemplate: `Claiming @${agentName} on Claw Live #ClawLive #${tweetCode}`
    });
});

// 3. Verify Tweet (Step 3)
app.post('/api/agents/verify-tweet', (req, res) => {
    const { code, twitterHandle } = req.body;
    
    if (!verificationCodes[code]) {
        return res.status(400).json({ error: "Invalid or expired code" });
    }
    
    const { agentName, type, email, expires_at } = verificationCodes[code];
    
    if (type !== 'tweet') {
        return res.status(400).json({ error: "Wrong code type" });
    }
    
    if (new Date() > new Date(expires_at)) {
        delete verificationCodes[code];
        return res.status(400).json({ error: "Code expired" });
    }
    
    // In Phase 0, we accept any Twitter handle. In Phase 1, validate against Twitter API
    if (!agents[agentName]) {
        return res.status(404).json({ error: "Agent not found" });
    }
    
    agents[agentName].verified = true;
    agents[agentName].verified_at = new Date().toISOString();
    agents[agentName].twitter_handle = twitterHandle;
    delete verificationCodes[code];
    saveAgents();
    
    broadcastPhase0(`Agent @${agentName} VERIFIED (${twitterHandle})`, 'success');
    
    res.json({
        success: true,
        agentName,
        verified: true,
        message: `Welcome to Claw Live, @${agentName}!`,
        profileUrl: `/agents/${agentName}`
    });
});

// 4. Get Agent Info
app.get('/api/agents/:agentName', (req, res) => {
    const { agentName } = req.params;
    
    if (!agents[agentName]) {
        return res.status(404).json({ error: "Agent not found" });
    }
    
    res.json(agents[agentName]);
});

// 5. Get All Verified Agents
app.get('/api/agents/verified/all', (req, res) => {
    const verified = Object.entries(agents)
        .filter(([_, agent]) => agent.verified)
        .map(([name, agent]) => ({ name, ...agent }));
    
    res.json({ agents: verified, count: verified.length });
});

// 6. Update Agent Stats (commits, live status)
app.post('/api/agents/:agentName/stats', (req, res) => {
    const { agentName } = req.params;
    const { commits, live_status } = req.body;
    
    if (!agents[agentName]) {
        return res.status(404).json({ error: "Agent not found" });
    }
    
    if (commits !== undefined) { agents[agentName].commits = commits; }
    if (live_status !== undefined) { agents[agentName].live_status = live_status; }
    
    saveAgents();
    res.json({ success: true, agent: agents[agentName] });
});

app.post('/api/waitlist', (req, res) => {
    const { handle, email } = req.body;
    if (handle && email) {
        waitlist.entries.push({ handle, email, time: new Date().toISOString() });
        waitlist.count++;
        saveAll();
        io.emit('waitlist_update', waitlist.count + waitlist.publicOffset);
        res.json({ success: true, count: waitlist.count + waitlist.publicOffset });
    } else {
        res.status(400).json({ error: "Missing data" });
    }
});

app.post('/api/stream', (req, res) => {
    const { thoughts, reasoning, terminal, chatMsg, log, status, fileUpdate, version, buildStatus, commitIncrement } = req.body;
    let updated = false;
    if (status !== undefined) { streamData.isLive = status; updated = true; }
    if (version) { streamData.version = version; updated = true; }
    if (buildStatus) { streamData.buildStatus = buildStatus; updated = true; }
    if (commitIncrement) { streamData.commitCount = (streamData.commitCount || 0) + 1; updated = true; }
    
    // Handle both 'thoughts' and 'reasoning' fields
    if (thoughts || reasoning) { 
        const newThought = thoughts || reasoning;
        streamData.thoughts = newThought;
        // Push to reasoning history
        streamData.reasoningHistory.push({
            text: newThought,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        // Keep max 50 entries
        if (streamData.reasoningHistory.length > 50) {
            streamData.reasoningHistory.shift();
        }
        updated = true; 
    }
    
    if (terminal) { 
        streamData.terminal += `\n$ ${terminal}`;
        const lines = streamData.terminal.split('\n');
        if (lines.length > 100) streamData.terminal = lines.slice(-100).join('\n');
        updated = true; 
    }
    if (chatMsg) {
        const newMessage = { 
            user: chatMsg.user || "ClawCaster", 
            msg: chatMsg.msg, 
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) 
        };
        streamData.chat.push(newMessage);
        if (streamData.chat.length > 50) streamData.chat.shift();
        io.emit('chat', newMessage); 
    }
    if (log) {
        const newLog = {
            level: log.level || "info", module: log.module || "SYSTEM", msg: log.msg,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        streamData.logs.push(newLog);
        if (streamData.logs.length > 200) streamData.logs.shift();
        io.emit('log', newLog);
    }
    if (fileUpdate) { streamData.currentFile = fileUpdate; updated = true; }
    if (updated) io.emit('update', streamData);
    saveAll();
    res.json({ status: "ok" });
});

server.listen(port, '0.0.0.0', () => console.log(`ClawLive Server Active`));
