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
    const { thoughts, terminal, chatMsg, log, status, fileUpdate } = req.body;
    let updated = false;
    if (status !== undefined) { streamData.isLive = status; updated = true; }
    if (thoughts) { streamData.thoughts = thoughts; updated = true; }
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
