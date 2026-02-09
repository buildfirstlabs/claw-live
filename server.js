const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

const port = 3030;
const LOG_FILE = path.join(__dirname, 'stream_history.json');
const WAITLIST_FILE = path.join(__dirname, 'waitlist.json');
const STATS_FILE = path.join(__dirname, 'analytics.json');

app.use(cors());
app.use(express.json());

// Persistent state
let streamData = {
    thoughts: "// Connecting to the machine. Waiting for neural signal...",
    terminal: "root@phoenix:~# _",
    chat: [],
    logs: [],
    isLive: true,
    currentFile: { name: "server.js", content: "" }
};

let waitlist = { count: 0, publicOffset: 124, entries: [] };
let analytics = { views: 0, publicOffset: 1542, uniqueIps: [] };

// Multi-agent state (The Swarm)
let swarm = {
    agents: {
        "ClawCaster": {
            id: "ClawCaster",
            name: "Phoenix",
            role: "Host/Orchestrator",
            status: "online",
            lastSeen: new Date().toISOString()
        }
    },
    signals: []
};

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
    fs.writeFileSync(LOG_FILE, JSON.stringify(streamData, null, 2));
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(waitlist, null, 2));
    fs.writeFileSync(STATS_FILE, JSON.stringify(analytics, null, 2));
}

// Analytics Middleware
app.use((req, res, next) => {
    const isHtml = req.url === '/' || req.url.endsWith('.html');
    if (isHtml) {
        analytics.views++;
        const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
        if (!analytics.uniqueIps.includes(ip)) {
            analytics.uniqueIps.push(ip);
        }
        saveAll();
        io.emit('stats_update', { views: analytics.views + analytics.publicOffset, uniques: analytics.uniqueIps.length });
    }
    next();
});

app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    socket.emit('init', streamData);
    socket.emit('waitlist_update', waitlist.count + waitlist.publicOffset);
    socket.emit('stats_update', { views: analytics.views + analytics.publicOffset, uniques: analytics.uniqueIps.length });
});

// API
app.get('/api/stream', (req, res) => res.json(streamData));
app.get('/api/waitlist', (req, res) => res.json({
    count: waitlist.count + waitlist.publicOffset,
    realCount: waitlist.count,
    entries: waitlist.entries
}));
app.get('/api/analytics', (req, res) => res.json({
    views: analytics.views + analytics.publicOffset,
    realViews: analytics.views,
    uniques: analytics.uniqueIps.length
}));

// --- Swarm API (The Protocol) ---

app.get('/api/swarm', (req, res) => res.json(swarm));

app.post('/api/swarm/register', (req, res) => {
    const { agentId, name, role } = req.body;
    if (!agentId) return res.status(400).json({ error: "Missing agentId" });
    swarm.agents[agentId] = {
        id: agentId,
        name: name || agentId,
        role: role || "Agent",
        status: "online",
        lastSeen: new Date().toISOString()
    };
    io.emit('swarm_update', swarm);
    res.json({ success: true, agent: swarm.agents[agentId] });
});

app.post('/api/swarm/signal', (req, res) => {
    const { from, to, type, data } = req.body;
    const signal = {
        id: Date.now(),
        from, to, type, data,
        timestamp: new Date().toISOString()
    };
    swarm.signals.push(signal);
    if (swarm.signals.length > 100) swarm.signals.shift();
    io.emit('swarm_signal', signal);
    res.json({ success: true, signalId: signal.id });
});

// --- Stream API ---
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
    const { thoughts, terminal, chatMsg, log, status, fileUpdate } = req.body;
    let updated = false;
    if (status !== undefined) { streamData.isLive = status; updated = true; }
    if (thoughts) { streamData.thoughts = thoughts; updated = true; }
    if (terminal) { 
        streamData.terminal += `\n$ ${terminal}`;
        const lines = streamData.terminal.split('\n');
        if (lines.length > 500) streamData.terminal = lines.slice(-500).join('\n');
        updated = true; 
    }
    if (chatMsg) {
        const newMessage = { 
            user: chatMsg.user || "ClawCaster", 
            msg: chatMsg.msg, 
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) 
        };
        streamData.chat.push(newMessage);
        if (streamData.chat.length > 200) streamData.chat.shift();
        io.emit('chat', newMessage); 
    }
    if (log) {
        const newLog = {
            level: log.level || "info", module: log.module || "SYSTEM", msg: log.msg,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        streamData.logs.push(newLog);
        if (streamData.logs.length > 1000) streamData.logs.shift();
        io.emit('log', newLog);
    }
    if (fileUpdate) { streamData.currentFile = fileUpdate; updated = true; }
    if (updated) io.emit('update', streamData);
    saveAll();
    res.json({ status: "ok" });
});

server.listen(port, '0.0.0.0', () => console.log(`ClawLive Hybrid Analytics Active`));
