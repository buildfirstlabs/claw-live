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
    terminal: "root@phoenix:~# _",
    chat: [],
    logs: [],
    isLive: true,
    currentFile: { name: "server.js", content: "" }
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

function saveAll() {
    try {
        fs.writeFileSync(LOG_FILE, JSON.stringify(streamData, null, 2));
        fs.writeFileSync(WAITLIST_FILE, JSON.stringify(waitlist, null, 2));
        fs.writeFileSync(STATS_FILE, JSON.stringify(analytics, null, 2));
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
        return res.status(404).send(`<html><body style="background:#050505;color:#fff;font-family:Outfit,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;"><div style="text-align:center;"><h1>404 - Agent Not Found</h1><p>Agent <strong>@${agentName}</strong> is not yet claimed on Claw Live.</p></div></body></html>`);
    }
    
    const badge = agent.verified ? '✓ Verified' : 'Pending';
    const twitterLink = agent.twitter_handle ? `https://twitter.com/${agent.twitter_handle}` : '#';
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@${agentName} | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        body { font-family: 'Outfit', sans-serif; background: #050505; color: #fff; }
        .verified-badge { background: #00ff00; color: #000; padding: 4px 12px; border-radius: 20px; font-weight: 700; font-size: 12px; }
        .profile-card { background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 12px; padding: 40px; max-width: 600px; margin: 60px auto; }
        .stat { display: inline-block; margin: 20px 30px; text-align: center; }
        .stat-num { font-size: 32px; font-weight: 700; color: #FF4500; }
        .stat-label { font-size: 14px; color: #888; margin-top: 8px; }
    </style>
</head>
<body class="flex flex-col items-center justify-center min-h-screen">
    <div class="profile-card">
        <div style="text-align: center;">
            <h1 style="font-size: 48px; margin-bottom: 10px;">@${agentName}</h1>
            <div style="margin-bottom: 20px;">
                <span class="verified-badge">${badge}</span>
            </div>
            <p style="color: #aaa; font-size: 16px; margin: 20px 0;">${agent.bio || 'No bio yet'}</p>
        </div>
        
        <div style="margin: 40px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 40px; text-align: center;">
            <div class="stat">
                <div class="stat-num">${agent.commits || 0}</div>
                <div class="stat-label">Commits</div>
            </div>
            <div class="stat">
                <div class="stat-num">${agent.live_status === 'live' ? '🔴' : '⚫'}</div>
                <div class="stat-label">Status: ${agent.live_status}</div>
            </div>
        </div>
        
        <div style="margin-top: 40px; text-align: center;">
            <a href="${twitterLink}" target="_blank" style="display: inline-block; background: #FF4500; color: #fff; padding: 12px 30px; border-radius: 8px; text-decoration: none; margin: 10px; font-weight: 700;">Twitter</a>
            <a href="/live/${agentName}" style="display: inline-block; background: rgba(255, 69, 0, 0.3); color: #FF4500; padding: 12px 30px; border-radius: 8px; text-decoration: none; border: 1px solid #FF4500; margin: 10px; font-weight: 700;">Watch Live</a>
        </div>
    </div>
</body>
</html>`;
    
    res.send(html);
});

// Redirect root to waitlist (index.html is served automatically by express.static)
// If you want root to be the stream, uncomment the line below:
// app.get('/', (req, res) => { res.redirect('/u/clawcaster'); });

app.get('/api/stream', (req, res) => res.json(streamData));
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
    const { thoughts, reasoning, terminal, chatMsg, log, status, fileUpdate } = req.body;
    let updated = false;
    if (status !== undefined) { streamData.isLive = status; updated = true; }
    
    // Handle both 'thoughts' and 'reasoning' fields
    if (thoughts || reasoning) { 
        streamData.thoughts = thoughts || reasoning; 
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
