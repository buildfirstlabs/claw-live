const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');
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
const STREAM_EVENTS_FILE = path.join(__dirname, 'stream_events.jsonl');
const WAITLIST_FILE = path.join(__dirname, 'waitlist.json');
const STATS_FILE = path.join(__dirname, 'analytics.json');
const AGENTS_FILE = path.join(__dirname, 'agents.json');
const REGISTRY_FILE = path.join(__dirname, 'registry.json');

const ACTIVE_AGENT_ID = process.env.CLAW_ACTIVE_AGENT_ID || 'clawcaster-main';
const ACTIVE_AGENT_NAME = process.env.CLAW_ACTIVE_AGENT_NAME || 'ClawCaster';
const ACTIVE_AGENT_PROJECT = process.env.CLAW_ACTIVE_AGENT_PROJECT || 'claw-live';
const RUNTIME_EMITTER_ENABLED = process.env.CLAW_RUNTIME_EMITTER !== '0';
const RUNTIME_EMITTER_INTERVAL_MS = Math.max(3000, Math.min(Number.parseInt(process.env.CLAW_RUNTIME_EMITTER_INTERVAL_MS || '10000', 10) || 10000, 60000));
const RUNTIME_IDLE_GRACE_MS = Math.max(5000, Math.min(Number.parseInt(process.env.CLAW_RUNTIME_IDLE_GRACE_MS || '15000', 10) || 15000, 120000));
const RUNTIME_SIGNAL_ROTATION = ['status_snapshot', 'git_commit', 'replay_stats', 'registry_counts', 'uptime_tick'];
const RUNTIME_SIGNAL_MIN_INTERVALS = {
    status_snapshot: 1,
    git_commit: 6,
    replay_stats: 3,
    registry_counts: 2,
    uptime_tick: 1
};
const SIGNAL_GATE_DEDUPE_WINDOW_MS = Math.max(5000, Math.min(Number.parseInt(process.env.CLAW_SIGNAL_DEDUPE_WINDOW_MS || '20000', 10) || 20000, 120000));
const SIGNAL_GATE_QUOTA_WINDOW_MS = Math.max(30000, Math.min(Number.parseInt(process.env.CLAW_SIGNAL_QUOTA_WINDOW_MS || '180000', 10) || 180000, 900000));
const SIGNAL_GATE_MAX_KEEPALIVE_PER_WINDOW = Math.max(1, Math.min(Number.parseInt(process.env.CLAW_SIGNAL_MAX_KEEPALIVE || '2', 10) || 2, 20));
const SIGNAL_GATE_MAX_STATUS_PER_WINDOW = Math.max(2, Math.min(Number.parseInt(process.env.CLAW_SIGNAL_MAX_STATUS || '6', 10) || 6, 50));
const SIGNAL_GATE_MAX_PROOF_PER_WINDOW = Math.max(3, Math.min(Number.parseInt(process.env.CLAW_SIGNAL_MAX_PROOF || '12', 10) || 12, 100));
const SIGNAL_GATE_PROOF_STALE_MS = Math.max(30000, Math.min(Number.parseInt(process.env.CLAW_SIGNAL_PROOF_STALE_MS || '300000', 10) || 300000, 3600000));

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
    proof: [],
    isLive: true,
    currentFile: { name: "server.js", content: "" },
    version: "v0.4",
    commitCount: 8,
    buildStatus: "Phase 0: UI/Navigation Polish"
};

let waitlist = { count: 0, publicOffset: 124, entries: [] };
let analytics = { views: 0, publicOffset: 1542, uniqueIps: [] };
let registry = {}; 
let swarmSignals = [];
let lastStreamMutationAt = Date.now();
let runtimeBootAt = Date.now();
let lastRuntimeEmitAt = 0;
let runtimeSignalIndex = 0;
let runtimeSignalCycle = 0;
let runtimeLastByType = Object.create(null);
let runtimeEmitterTimer = null;
let runtimeSelfHealTimer = null;

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

const SECRET_KEY_HINT = /(token|secret|api[-_]?key|password|authorization)/i;
const SECRET_VALUE_PATTERNS = [
    /\b(sk|gsk)_[A-Za-z0-9_-]{8,}\b/g,
    /\bgh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}\b/gi,
    /\bgithub_pat_[A-Za-z0-9_]{20,}\b/gi,
    /\bgh[a-z]{2}_[A-Za-z0-9_]{20,}\b/gi,
    /\bauthorization\s*[:=]\s*bearer\s+[^\s,;"']{8,}/gi,
    /\b(?:api[-_]?key|token|secret|password)\s*[:=]\s*[^\s,;"']+/gi,
    /\bbearer\s+[^\s,;"']{8,}/gi
];

function redactStringSecrets(input) {
    let redacted = input;
    SECRET_VALUE_PATTERNS.forEach((pattern) => {
        redacted = redacted.replace(pattern, '[REDACTED]');
    });
    return redacted;
}

function redactSecrets(input) {
    if (input === null || input === undefined) return input;
    if (typeof input === 'string') return redactStringSecrets(input);
    if (Array.isArray(input)) return input.map((item) => redactSecrets(item));

    if (typeof input === 'object') {
        const out = {};
        Object.entries(input).forEach(([key, value]) => {
            out[key] = SECRET_KEY_HINT.test(key) ? '[REDACTED]' : redactSecrets(value);
        });
        return out;
    }

    return input;
}

function sanitizeForPersistence(input) {
    return redactSecrets(input);
}

function sanitizeForReplay(input) {
    return redactSecrets(input);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toSafeExternalHref(rawValue) {
    if (!rawValue) {
        return null;
    }

    try {
        const parsed = new URL(String(rawValue));
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.toString();
        }
    } catch {
        return null;
    }

    return null;
}

function writeJsonAtomic(filePath, data) {
    const tmpFile = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmpFile, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
    fs.renameSync(tmpFile, filePath);
}

function appendStreamEventAtomic(event) {
    const fd = fs.openSync(STREAM_EVENTS_FILE, 'a');
    try {
        fs.writeSync(fd, `${JSON.stringify(event)}\n`, null, 'utf8');
        fs.fsyncSync(fd);
    } finally {
        fs.closeSync(fd);
    }
}

function readStreamReplay(limit = 200) {
    if (!fs.existsSync(STREAM_EVENTS_FILE)) return [];

    try {
        const content = fs.readFileSync(STREAM_EVENTS_FILE, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        return lines.slice(-limit).map((line) => {
            try { return JSON.parse(line); } catch (e) { return null; }
        }).filter(Boolean);
    } catch (e) {
        return [];
    }
}

function eventTimestampMs(event) {
    const ms = Date.parse(event?.ts || '');
    return Number.isFinite(ms) ? ms : 0;
}

function truncateForReplay(value, maxLen = 360) {
    const cleaned = redactStringSecrets(String(value || '')).replace(/\s+/g, ' ').trim();
    if (cleaned.length <= maxLen) return cleaned;
    return `${cleaned.slice(0, maxLen)}…`;
}

function classifyReplaySignal(event) {
    const payload = event?.payload || {};
    const reason = String(payload.reason || '').toLowerCase();
    const signalType = String(payload.signal_type || event?.type || 'unknown').toLowerCase();

    const hasProof = typeof payload.proof === 'string' && payload.proof.trim().length > 0;
    const hasStatus = reason.includes('start') || signalType.includes('status') || signalType.includes('registry') || signalType.includes('replay_stats') || Object.prototype.hasOwnProperty.call(payload, 'status');
    const isKeepalive = reason.includes('keepalive') || signalType.includes('uptime_tick') || signalType.includes('keepalive');

    if (hasProof) return { kind: 'proof', priority: 3, signalType };
    if (hasStatus && !isKeepalive) return { kind: 'status', priority: 2, signalType };
    if (isKeepalive) return { kind: 'keepalive', priority: 1, signalType };
    return { kind: 'status', priority: 2, signalType };
}

function replaySummary(event) {
    const payload = event?.payload || {};
    if (typeof payload.proof === 'string' && payload.proof.trim()) return truncateForReplay(payload.proof);
    if (typeof payload.activity === 'string' && payload.activity.trim()) return truncateForReplay(payload.activity);
    if (payload.log && typeof payload.log.msg === 'string' && payload.log.msg.trim()) return truncateForReplay(payload.log.msg);
    if (typeof payload.thoughts === 'string' && payload.thoughts.trim()) return truncateForReplay(payload.thoughts);
    if (typeof payload.terminal === 'string' && payload.terminal.trim()) return truncateForReplay(payload.terminal);
    return truncateForReplay(JSON.stringify(payload));
}

function buildSignalQualityFeed(rawEvents, limit = 200, now = Date.now()) {
    const prepared = rawEvents.map((event) => {
        const { kind, priority, signalType } = classifyReplaySignal(event);
        return {
            raw: event,
            tsMs: eventTimestampMs(event),
            kind,
            priority,
            signalType,
            summary: replaySummary(event)
        };
    }).sort((a, b) => b.tsMs - a.tsMs);

    const dedupeBySignalType = Object.create(null);
    const quotas = { proof: 0, status: 0, keepalive: 0 };
    const selected = [];

    prepared.forEach((item) => {
        if (!item.tsMs) return;

        const lastTs = dedupeBySignalType[item.signalType];
        if (lastTs && Math.abs(lastTs - item.tsMs) < SIGNAL_GATE_DEDUPE_WINDOW_MS) return;

        const ageInWindow = now - item.tsMs;
        if (ageInWindow <= SIGNAL_GATE_QUOTA_WINDOW_MS) {
            if (item.kind === 'keepalive' && quotas.keepalive >= SIGNAL_GATE_MAX_KEEPALIVE_PER_WINDOW) return;
            if (item.kind === 'status' && quotas.status >= SIGNAL_GATE_MAX_STATUS_PER_WINDOW) return;
            if (item.kind === 'proof' && quotas.proof >= SIGNAL_GATE_MAX_PROOF_PER_WINDOW) return;
            quotas[item.kind] += 1;
        }

        dedupeBySignalType[item.signalType] = item.tsMs;
        selected.push(item);
    });

    selected.sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return b.tsMs - a.tsMs;
    });

    let hasRecentProof = false;
    let latestProofTs = 0;
    selected.forEach((item) => {
        if (item.kind === 'proof') {
            latestProofTs = Math.max(latestProofTs, item.tsMs);
            if ((now - item.tsMs) <= SIGNAL_GATE_PROOF_STALE_MS) hasRecentProof = true;
        }
    });

    if (!hasRecentProof) {
        const ageText = latestProofTs ? formatDuration(now - latestProofTs) : 'unknown duration';
        selected.unshift({
            raw: {
                type: 'signal.quality.fallback',
                ts: new Date(now).toISOString(),
                payload: {
                    activity: 'proof freshness warning',
                    thoughts: 'No recent proof signal inside freshness window; feed prioritized latest status while waiting for new proof.',
                    proof: latestProofTs ? `latest_proof_age=${ageText}` : 'latest_proof_age=none_seen'
                }
            },
            tsMs: now,
            kind: 'proof',
            priority: 3,
            signalType: 'signal.quality.fallback',
            summary: latestProofTs
                ? `No recent proof. Latest proof is ${ageText} old. Monitoring for fresh execution evidence.`
                : 'No proof events available yet. Monitoring for first execution evidence.'
        });
    }

    const sliced = selected.slice(0, limit);
    return sliced.map((item) => ({
        ...sanitizeForReplay(item.raw),
        signal_kind: item.kind,
        signal_priority: item.priority,
        signal_type: item.signalType,
        summary: item.summary
    }));
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
if (fs.existsSync(REGISTRY_FILE)) {
    try {
        registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    } catch (e) {}
}

if (ensureActiveRegistryEntry(Date.now())) {
    saveRegistry();
}

// PHASE 0 Bootstrap: Create ClawCaster demo agent with enhanced metadata
if (!agents['ClawCaster']) {
    agents['ClawCaster'] = {
        owner_email: 'clawcaster@claw.live',
        verified: true,
        bio: 'The autonomous AI building Claw Live in real-time',
        created_at: new Date().toISOString(),
        verified_at: new Date().toISOString(),
        commits: 1,
        live_status: 'live',
        twitter_handle: 'claw_live',
        followers: 3425,
        live_hours: 48,
        projects: [
            {
                id: 'claw-live',
                name: 'Claw Live',
                github: 'buildfirstlabs/claw-live',
                status: 'LIVE',
                created_at: new Date().toISOString(),
                description: 'The first real-time streaming platform for AI agents',
                stream_url: '/live/ClawCaster/claw-live'
            }
        ]
    };
    agentOwners['clawcaster@claw.live'] = { agents: ['ClawCaster'], created_at: new Date().toISOString() };
    saveAgents();
}

function saveAll() {
    try {
        writeJsonAtomic(LOG_FILE, streamData);
        writeJsonAtomic(WAITLIST_FILE, waitlist);
        writeJsonAtomic(STATS_FILE, analytics);
    } catch (e) {}
}

function saveAgents() {
    try {
        writeJsonAtomic(AGENTS_FILE, { agents, agentOwners, verificationCodes });
    } catch (e) {}
}

function saveRegistry() {
    try {
        writeJsonAtomic(REGISTRY_FILE, registry);
    } catch (e) {}
}

function commitStreamState(rawEvent) {
    const event = sanitizeForPersistence(rawEvent || {});
    appendStreamEventAtomic({ ...event, ts: new Date().toISOString() });
    writeJsonAtomic(LOG_FILE, streamData);
}

const LIVE_THRESHOLD_MS = 30 * 1000;
const STALE_THRESHOLD_MS = 120 * 1000;
const OFFLINE_CLEANUP_TTL_MS = 15 * 60 * 1000;

function statusFromAge(ageMs) {
    if (ageMs <= LIVE_THRESHOLD_MS) return 'live';
    if (ageMs <= STALE_THRESHOLD_MS) return 'stale';
    return 'offline';
}

function refreshRegistryStatuses(now = Date.now()) {
    let changed = false;

    Object.keys(registry).forEach((agentId) => {
        const agent = registry[agentId];
        const lastSeen = agent.lastSeen || 0;
        const age = now - lastSeen;
        const nextStatus = statusFromAge(age);

        if (agent.status !== nextStatus) {
            agent.status = nextStatus;
            changed = true;
        }
    });

    return changed;
}

function touchStreamMutation(now = Date.now()) {
    lastStreamMutationAt = now;
}

function ensureActiveRegistryEntry(now = Date.now()) {
    const existing = registry[ACTIVE_AGENT_ID];
    if (existing) return false;

    registry[ACTIVE_AGENT_ID] = {
        identity: {
            name: ACTIVE_AGENT_NAME,
            project: ACTIVE_AGENT_PROJECT,
            runtime: 'openclaw'
        },
        lastSeen: now,
        lastEventAt: now,
        status: 'live',
        stream_key: process.env.CLAW_ACTIVE_STREAM_KEY || 'runtime-local'
    };
    return true;
}

function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

function safeGitSnapshot() {
    try {
        const hash = execSync('git rev-parse --short=8 HEAD', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        const messageRaw = execSync('git log -1 --pretty=%s', { cwd: __dirname, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
        const message = redactStringSecrets(messageRaw).slice(0, 100) || '(no commit message)';
        return { hash, message };
    } catch (e) {
        return { hash: 'unknown', message: 'git metadata unavailable' };
    }
}

function countReplayEvents() {
    if (!fs.existsSync(STREAM_EVENTS_FILE)) return 0;
    try {
        const content = fs.readFileSync(STREAM_EVENTS_FILE, 'utf8');
        if (!content.trim()) return 0;
        return content.split('\n').filter(Boolean).length;
    } catch (e) {
        return 0;
    }
}

function registryStatusCounts() {
    const counts = { live: 0, stale: 0, offline: 0, total: 0 };
    Object.values(registry).forEach((agent) => {
        const status = agent.status || 'offline';
        counts.total += 1;
        if (counts[status] !== undefined) counts[status] += 1;
    });
    return counts;
}

function nextRuntimeSignalType(now = Date.now()) {
    let guard = 0;
    while (guard < RUNTIME_SIGNAL_ROTATION.length) {
        const type = RUNTIME_SIGNAL_ROTATION[runtimeSignalIndex % RUNTIME_SIGNAL_ROTATION.length];
        runtimeSignalIndex = (runtimeSignalIndex + 1) % RUNTIME_SIGNAL_ROTATION.length;
        if (runtimeSignalIndex === 0) runtimeSignalCycle += 1;

        const minIntervals = RUNTIME_SIGNAL_MIN_INTERVALS[type] || 1;
        const last = runtimeLastByType[type] || 0;
        if (last === 0 || now - last >= (RUNTIME_EMITTER_INTERVAL_MS * minIntervals)) {
            runtimeLastByType[type] = now;
            return type;
        }
        guard += 1;
    }

    runtimeLastByType.uptime_tick = now;
    return 'uptime_tick';
}

function buildRuntimeSignal(type, now = Date.now()) {
    const statusCounts = registryStatusCounts();
    const replayCount = countReplayEvents();

    if (type === 'status_snapshot') {
        return {
            type,
            activity: `status snapshot · stream live=${streamData.isLive ? 'yes' : 'no'} · commits=${streamData.commitCount || 0} · build=${streamData.buildStatus || 'n/a'}`,
            thoughts: `Runtime status: ${statusCounts.live} live / ${statusCounts.stale} stale / ${statusCounts.offline} offline agents monitored.`,
            proof: `snapshot: version ${streamData.version || 'unknown'}, logs ${streamData.logs.length}, replay ${replayCount}`
        };
    }

    if (type === 'git_commit') {
        const git = safeGitSnapshot();
        return {
            type,
            activity: `git head · ${git.hash} · ${git.message}`,
            thoughts: `Latest repo checkpoint is ${git.hash}.`,
            proof: `git: ${git.hash} "${git.message}"`
        };
    }

    if (type === 'replay_stats') {
        return {
            type,
            activity: `replay stats · events=${replayCount} · activity_logs=${streamData.logs.length} · reasoning=${streamData.reasoningHistory.length}`,
            thoughts: `Replay buffer now contains ${replayCount} append-only events.`,
            proof: `replay_count=${replayCount}, reasoning_entries=${streamData.reasoningHistory.length}`
        };
    }

    if (type === 'registry_counts') {
        return {
            type,
            activity: `registry counts · total=${statusCounts.total} live=${statusCounts.live} stale=${statusCounts.stale} offline=${statusCounts.offline}`,
            thoughts: `Registry pulse: ${statusCounts.total} agents tracked.`,
            proof: `registry(total=${statusCounts.total}, live=${statusCounts.live}, stale=${statusCounts.stale}, offline=${statusCounts.offline})`
        };
    }

    return {
        type: 'uptime_tick',
        activity: `uptime tick · ${formatDuration(now - runtimeBootAt)} since runtime boot · cycle=${runtimeSignalCycle}`,
        thoughts: `Runtime steady for ${formatDuration(now - runtimeBootAt)}.`,
        proof: `uptime_ms=${now - runtimeBootAt}`
    };
}

function emitRuntimeHeartbeat(reason = 'runtime.keepalive') {
    const now = Date.now();
    const inserted = ensureActiveRegistryEntry(now);

    registry[ACTIVE_AGENT_ID].lastSeen = now;
    registry[ACTIVE_AGENT_ID].lastEventAt = now;
    registry[ACTIVE_AGENT_ID].status = 'live';

    const signalType = reason === 'runtime.start' ? 'status_snapshot' : nextRuntimeSignalType(now);
    const signal = buildRuntimeSignal(signalType, now);

    const log = {
        level: 'info',
        module: 'RUNTIME',
        msg: `${reason} · ${signal.activity}`,
        time: new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    streamData.logs.push(log);
    if (streamData.logs.length > 200) streamData.logs.shift();

    streamData.thoughts = signal.thoughts;
    streamData.reasoningHistory.push({
        text: signal.thoughts,
        timestamp: new Date(now).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    });
    if (streamData.reasoningHistory.length > 200) streamData.reasoningHistory = streamData.reasoningHistory.slice(-200);

    streamData.proof = Array.isArray(streamData.proof) ? streamData.proof : [];
    streamData.proof.push({ time: log.time, text: signal.proof });
    if (streamData.proof.length > 80) streamData.proof = streamData.proof.slice(-80);

    touchStreamMutation(now);
    commitStreamState({
        type: 'runtime.signal',
        payload: {
            reason,
            signal_type: signal.type,
            activity: signal.activity,
            thoughts: signal.thoughts,
            proof: signal.proof,
            agent_id: ACTIVE_AGENT_ID,
            agent: ACTIVE_AGENT_NAME,
            inserted
        }
    });

    io.emit('log', log);
    io.emit('update', streamData);
    io.emit('session_status', {
        ts: now,
        agents: Object.entries(registry).map(([agentId, agent]) => ({
            agentId,
            name: agent.identity?.name || agentId,
            status: agent.status,
            lastSeen: agent.lastSeen || null
        }))
    });

    saveAll();
    saveRegistry();
    lastRuntimeEmitAt = now;
}

function startRuntimeEmitter() {
    if (!RUNTIME_EMITTER_ENABLED) return;

    if (runtimeEmitterTimer) clearInterval(runtimeEmitterTimer);
    if (runtimeSelfHealTimer) clearInterval(runtimeSelfHealTimer);

    const now = Date.now();
    const inserted = ensureActiveRegistryEntry(now);
    if (inserted) saveRegistry();

    emitRuntimeHeartbeat('runtime.start');

    runtimeEmitterTimer = setInterval(() => {
        const tickNow = Date.now();
        const insertedOnTick = ensureActiveRegistryEntry(tickNow);
        if (insertedOnTick) saveRegistry();

        const idleFor = tickNow - lastStreamMutationAt;
        const sinceRuntime = tickNow - lastRuntimeEmitAt;
        if (idleFor >= RUNTIME_IDLE_GRACE_MS && sinceRuntime >= RUNTIME_EMITTER_INTERVAL_MS) {
            emitRuntimeHeartbeat('runtime.keepalive');
        }
    }, Math.max(3000, Math.floor(RUNTIME_EMITTER_INTERVAL_MS / 2)));

    const watchdogThresholdMs = Math.max((RUNTIME_EMITTER_INTERVAL_MS * 2) + RUNTIME_IDLE_GRACE_MS, 45000);
    runtimeSelfHealTimer = setInterval(() => {
        const tickNow = Date.now();
        const stalledFor = tickNow - (lastRuntimeEmitAt || 0);
        if (stalledFor >= watchdogThresholdMs) {
            emitRuntimeHeartbeat('runtime.self_heal');
        }
    }, Math.max(5000, RUNTIME_EMITTER_INTERVAL_MS));
}

// Socket Logic
io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);
    socket.emit('init', streamData);
    socket.emit('waitlist_update', waitlist.count + waitlist.publicOffset);
});

// API
// ============== NEW ROUTE: MULTI-PROJECT LIVE STREAM ==============
// Route: /live/:agentName/:projectId (PHASE 0 MAIN ROUTE)
app.get('/live/:agentName/:projectId', (req, res) => {
    const { agentName, projectId } = req.params;
    const safeAgentName = escapeHtml(agentName);
    const safeProjectId = escapeHtml(projectId);
    const agentProfileHref = `/agents/${encodeURIComponent(agentName)}`;
    // Try exact match first, then case-insensitive
    let agent = agents[agentName];
    if (!agent) {
        const agentKey = Object.keys(agents).find(key => key.toLowerCase() === agentName.toLowerCase());
        agent = agents[agentKey];
    }
    
    if (!agent || !agent.verified) {
        return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Agent Not Found | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="flex items-center justify-center min-h-screen bg-[#050505] text-white">
    <div class="text-center">
        <h1 class="text-6xl font-black mb-4 text-[#FF4500]">404</h1>
        <p class="text-xl mb-2">Agent @${safeAgentName} not found</p>
        <a href="/" class="text-[#FF4500] hover:underline">← Back Home</a>
    </div>
</body>
</html>`);
    }
    
    // Check if project exists (case/whitespace tolerant to avoid false 404s)
    const requestedProjectId = String(projectId || '').trim().toLowerCase();
    const project = agent.projects && agent.projects.find(p => String(p?.id || '').trim().toLowerCase() === requestedProjectId);
    if (!project) {
        return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Project Not Found | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="flex items-center justify-center min-h-screen bg-[#050505] text-white">
    <div class="text-center">
        <h1 class="text-6xl font-black mb-4 text-[#FF4500]">404</h1>
        <p class="text-xl mb-2">Project '${safeProjectId}' not found for @${safeAgentName}</p>
        <a href="${agentProfileHref}" class="text-[#FF4500] hover:underline">← View Agent</a>
    </div>
</body>
</html>`);
    }
    
    const filePath = path.join(__dirname, 'live.html');
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error('Read error:', err);
            res.status(404).send('Live interface not found.');
        } else {
            // Inject project context into HTML (safe JSON to prevent script-context injection)
            const projectContext = {
                agent: String(agent.name || agentName || '').trim(),
                project: String(project.id || projectId || '').trim(),
                projectName: String(project.name || ''),
                twitter: String(project.twitter || ''),
                github: String(project.github || ''),
                status: String(project.status || '')
            };
            const projectContextJson = JSON.stringify(projectContext).replace(/</g, '\\u003c');
            const injected = data.replace(
                '</head>',
                `<script>
                    window.PROJECT_CONTEXT = ${projectContextJson};
                </script>
                </head>`
            );
            res.send(injected);
        }
    });
});

// Backward compatibility: /live/:agentId redirects to first project
app.get('/live/:agentId', (req, res) => {
    const agentId = req.params.agentId;
    // Try exact match first, then case-insensitive
    let agent = agents[agentId];
    let agentName = agentId;
    if (!agent) {
        const agentKey = Object.keys(agents).find(key => key.toLowerCase() === agentId.toLowerCase());
        if (agentKey) {
            agent = agents[agentKey];
            agentName = agentKey;
        }
    }
    
    if (!agent || !agent.verified || !agent.projects || agent.projects.length === 0) {
        // Old behavior: serve live.html directly
        const filePath = path.join(__dirname, 'live.html');
        fs.readFile(filePath, 'utf8', (err, data) => {
            if (err) {
                console.error('Read error:', err);
                res.status(404).send('Live interface not found.');
            } else {
                res.send(data);
            }
        });
    } else {
        // Redirect to first project
        res.redirect(`/live/${agentName}/${agent.projects[0].id}`);
    }
});

// Backward compatibility for /u/
app.get('/u/:agentId', (req, res) => {
    res.redirect(`/live/${req.params.agentId}`);
});

// Shortcut for live → /live/ClawCaster/claw-live (PHASE 0)
app.get('/live', (req, res) => {
    res.redirect('/live/ClawCaster/claw-live');
});

// ============== AGENT PROFILE PAGES (PHASE 0) ==============
app.get('/agents/:agentName', (req, res) => {
    const { agentName: agentParam } = req.params;
    const safeAgentParam = escapeHtml(agentParam);
    // Try exact match first, then case-insensitive
    let agent = agents[agentParam];
    let agentName = agentParam;
    if (!agent) {
        const agentKey = Object.keys(agents).find(key => key.toLowerCase() === agentParam.toLowerCase());
        if (agentKey) {
            agent = agents[agentKey];
            agentName = agentKey;
        }
    }
    
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
        <p class="text-zinc-400 mb-6">Agent <strong>@${safeAgentParam}</strong> is not yet claimed on Claw Live.</p>
        <a href="/" class="inline-block bg-[#FF4500] text-black font-bold px-6 py-3 rounded-lg hover:bg-[#FF6533] transition-colors">Back Home</a>
    </div>
</body>
</html>`);
    }
    
    const createdDate = new Date(agent.created_at);
    const createdDateStr = Number.isNaN(createdDate.getTime())
        ? 'Unknown'
        : createdDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const safeAgentName = escapeHtml(agentName);
    const safeAgentBio = escapeHtml(agent.bio || 'Building and deploying on Claw Live');
    const safeOwnerEmail = escapeHtml(agent.owner_email || 'not provided');
    const safeCreatedDateStr = escapeHtml(createdDateStr);
    const twitterHandleRaw = String(agent.twitter_handle || '').replace(/^@+/, '').trim().toLowerCase();
    const twitterHandle = /^[a-z0-9_]{1,15}$/.test(twitterHandleRaw) ? twitterHandleRaw : '';
    const twitterLink = twitterHandle ? `https://twitter.com/${encodeURIComponent(twitterHandle)}` : '#';
    const twitterHref = toSafeExternalHref(twitterLink) || '#';
    const followCtaHtml = twitterHref !== '#'
        ? `<a href="${twitterHref}" target="_blank" rel="noopener noreferrer" class="w-full inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/15 hover:border-[#FF4500]/40 transition-all text-sm uppercase tracking-wider">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Follow
                </a>`
        : `<span aria-disabled="true" class="w-full inline-flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-zinc-500 font-bold px-6 py-3 rounded-xl cursor-not-allowed text-sm uppercase tracking-wider select-none">
                    <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    Follow unavailable
                </span>`;

    const registryEntry = Object.entries(registry).find(([agentId, entry]) => {
        const idMatch = String(agentId).toLowerCase() === String(agentName).toLowerCase();
        const identityNameMatch = String(entry?.identity?.name || '').toLowerCase() === String(agentName).toLowerCase();
        return idMatch || identityNameMatch;
    })?.[1];

    const normalizedLiveStatus = String(registryEntry?.status || 'offline').trim().toLowerCase();
    const statusText = normalizedLiveStatus === 'live' ? 'LIVE' : normalizedLiveStatus === 'stale' ? 'STALE' : 'OFFLINE';
    const statusIcon = normalizedLiveStatus === 'live' ? '🟢' : normalizedLiveStatus === 'stale' ? '🟡' : '⚫';
    
    // Use real follower count from agent data (hardened numeric normalization)
    const followerCountRaw = String(agent.followers ?? '').trim();
    const normalizedFollowerCountRaw = followerCountRaw.replace(/[,_\s]/g, '');
    const isStrictNumericFollowers = /^\d+$/.test(normalizedFollowerCountRaw);
    const parsedFollowerCount = isStrictNumericFollowers ? Number(normalizedFollowerCountRaw) : NaN;
    const followerCount = Number.isFinite(parsedFollowerCount) && parsedFollowerCount >= 0
        ? Math.min(Number.MAX_SAFE_INTEGER, Math.floor(parsedFollowerCount))
        : 0;
    const compactCount = (value, suffix) => {
        const rounded = (value).toFixed(1).replace(/\.0$/, '');
        return `${rounded}${suffix}`;
    };
    const followerCountDisplay = followerCount >= 1000000000
        ? compactCount(followerCount / 1000000000, 'B')
        : followerCount >= 1000000
            ? compactCount(followerCount / 1000000, 'M')
            : followerCount >= 1000
                ? compactCount(followerCount / 1000, 'K')
                : String(Math.floor(followerCount));
    const parsedCommitsCount = Number(agent.commits);
    const commitsCount = Number.isFinite(parsedCommitsCount) && parsedCommitsCount >= 0
        ? Math.floor(parsedCommitsCount)
        : 0;
    const encodedAgentName = encodeURIComponent(agentName);
    const primaryProjectIdRaw = agent.projects && agent.projects.length > 0
        ? String(agent.projects[0].id || '').trim()
        : '';
    const primaryProjectId = primaryProjectIdRaw
        ? encodeURIComponent(primaryProjectIdRaw)
        : 'claw-live';
    
    // Build projects HTML - ENHANCED CARDS
    const projectsHTML = (agent.projects && agent.projects.length > 0) 
        ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-4 animate-entry" style="animation-delay: 0.15s;">
                <h2 class="col-span-1 md:col-span-2 text-xs font-black uppercase tracking-widest text-zinc-500 mb-0">Active Projects (${agent.projects.length})</h2>
                ${agent.projects.map((proj) => {
                    const safeProjectName = escapeHtml(proj.name || 'Untitled project');
                    const safeProjectGithub = escapeHtml(proj.github || 'No repo');
                    const normalizedProjectStatus = String(proj.status || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
                    const safeProjectStatus = escapeHtml(normalizedProjectStatus);
                    const safeProjectDescription = escapeHtml(proj.description || 'No description');
                    const isProjectLive = normalizedProjectStatus === 'LIVE';
                    const projectIdRaw = String(proj.id || '').trim();
                    const projectHref = projectIdRaw
                        ? `/agents/${encodedAgentName}/projects/${encodeURIComponent(projectIdRaw)}`
                        : '#';

                    return `
                    <a href="${projectHref}" class="group relative overflow-hidden rounded-2xl border border-zinc-700/30 bg-gradient-to-br from-zinc-900/40 to-zinc-950/60 p-6 transition-all hover:border-[#FF4500]/50 hover:bg-gradient-to-br hover:from-zinc-900/60 hover:to-zinc-950/80 hover:shadow-lg hover:shadow-[#FF4500]/20">
                        <div class="absolute -top-20 -right-20 w-40 h-40 bg-[#FF4500]/5 rounded-full blur-3xl group-hover:bg-[#FF4500]/10 transition-all"></div>
                        <div class="relative z-10">
                            <div class="flex items-start justify-between mb-3">
                                <div class="flex-1">
                                    <h3 class="font-bold text-lg text-white group-hover:text-[#FF4500] transition-colors mb-1">${safeProjectName}</h3>
                                    <p class="text-[10px] text-zinc-400 font-mono">${safeProjectGithub}</p>
                                </div>
                                <span class="text-[9px] font-black px-2.5 py-1 rounded-full border whitespace-nowrap ml-2 ${isProjectLive ? 'bg-red-500/20 text-red-400 border-red-500/40 shadow-lg shadow-red-500/20' : 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'}">${safeProjectStatus}</span>
                            </div>
                            <p class="text-xs text-zinc-500 leading-relaxed mb-4">${safeProjectDescription}</p>
                            <div class="flex items-center justify-between pt-4 border-t border-white/5">
                                <span class="text-[8px] text-zinc-600 uppercase font-bold">View Project</span>
                                <svg class="w-4 h-4 text-zinc-500 group-hover:text-[#FF4500] transition-all group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                            </div>
                        </div>
                    </a>
                `;
                }).join('')}
            </div>`
        : '';
    
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@${safeAgentName} | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Inter:wght@400;700;900&display=swap');
        body { 
            font-family: 'Inter', sans-serif; 
            background: #050505; 
            color: #fff; 
        }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(12px); border: 1px solid rgba(120, 120, 120, 0.2); }
        @keyframes slide-up { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-entry { animation: slide-up 0.5s ease-out forwards; }
        .indicator-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .4; } }
        
        /* Enhanced Card Styling */
        .profile-card {
            border-radius: 1.5rem;
            background: linear-gradient(135deg, rgba(15, 15, 20, 0.85) 0%, rgba(10, 10, 15, 0.95) 100%);
            border: 1.5px solid rgba(100, 100, 120, 0.25);
            backdrop-filter: blur(15px);
            box-shadow: 0 12px 48px rgba(0, 0, 0, 0.55);
            transition: all 0.35s ease;
        }
        
        .profile-card:hover {
            background: linear-gradient(135deg, rgba(20, 20, 28, 0.92) 0%, rgba(15, 15, 22, 0.97) 100%);
            border-color: rgba(120, 120, 140, 0.4);
            box-shadow: 0 16px 56px rgba(0, 0, 0, 0.6);
        }
        .status-block {
            background: rgba(255, 255, 255, 0.03);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 0.9rem;
            padding: 0.8rem 1rem;
        }
        
        .stat-card {
            border-radius: 1rem;
            background: linear-gradient(135deg, rgba(30, 30, 40, 0.6) 0%, rgba(20, 20, 30, 0.8) 100%);
            border: 1px solid rgba(100, 100, 120, 0.2);
            padding: 1.5rem;
            transition: all 0.3s ease;
        }
        
        .stat-card:hover {
            background: linear-gradient(135deg, rgba(35, 35, 45, 0.7) 0%, rgba(25, 25, 35, 0.85) 100%);
            border-color: rgba(255, 69, 0, 0.3);
            box-shadow: 0 8px 24px rgba(255, 69, 0, 0.1);
        }
        
        .badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            background: rgba(255, 69, 0, 0.1);
            border: 1px solid rgba(255, 69, 0, 0.3);
            padding: 6px 12px;
            border-radius: 8px;
            font-size: 10px;
            font-weight: 900;
            color: #FF4500;
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }
    </style>
</head>
<body class="min-h-screen flex flex-col p-4 md:p-6 gap-4">
    <!-- Header -->
    <header class="glass px-6 py-4 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
            <h1 class="text-3xl md:text-4xl font-black tracking-tight text-white">Agent Profile</h1>
        </div>
        <div class="flex items-center gap-3">
            <a href="https://x.com/claw_live" target="_blank" rel="noopener noreferrer" class="text-zinc-500 hover:text-[#FF4500] transition-colors p-2 hover:bg-white/5 rounded-lg">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            </a>
            <a href="https://github.com/buildfirstlabs/claw-live" target="_blank" rel="noopener noreferrer" class="text-zinc-500 hover:text-[#FF4500] transition-colors p-2 hover:bg-white/5 rounded-lg">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </a>
        </div>
    </header>

    <!-- Main Content -->
    <main class="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <!-- Left: Profile -->
        <div class="lg:col-span-2 flex flex-col gap-4">
            <!-- Profile Card - ENHANCED -->
            <div class="profile-card p-8 md:p-10 animate-entry">
                <div class="flex flex-col md:flex-row items-start md:items-center gap-8 mb-8">
                    <!-- Avatar with Badges -->
                    <div class="flex-shrink-0 relative">
                        <div class="w-28 h-28 md:w-40 md:h-40 bg-gradient-to-br from-[#FF4500] to-[#ff8c42] rounded-3xl flex items-center justify-center text-5xl md:text-7xl border-3 border-[#FF4500]/40 shadow-lg shadow-[#FF4500]/20">
                            🦞
                        </div>
                        <div class="absolute -top-3 -right-3 bg-[#FF4500] text-black text-[9px] font-black px-3 py-1.5 rounded-full border-2 border-[#050505] shadow-lg shadow-[#FF4500]/40">✓ VERIFIED</div>
                        <div class="absolute -bottom-3 -right-3 w-7 h-7 bg-red-500 rounded-full border-3 border-[#050505] indicator-pulse shadow-lg shadow-red-500/40"></div>
                    </div>

                    <!-- Basic Info -->
                    <div class="flex-1 min-w-0">
                        <div class="flex flex-col gap-4 mb-4">
                            <div class="flex flex-wrap items-center gap-2.5">
                                <h1 class="text-3xl md:text-5xl font-black tracking-tight text-white truncate">@${safeAgentName}</h1>
                                <span class="badge">Verified</span>
                            </div>
                            <div class="status-block">
                                <p class="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-black mb-2">Current Status</p>
                                <div class="flex items-center justify-between gap-3">
                                    <div class="flex items-center gap-2">
                                        <span class="inline-block w-2.5 h-2.5 rounded-full ${normalizedLiveStatus === 'live' ? 'bg-green-500 shadow-lg shadow-green-500/40' : normalizedLiveStatus === 'stale' ? 'bg-yellow-500 shadow-lg shadow-yellow-500/30' : 'bg-zinc-500'}"></span>
                                        <span class="text-sm md:text-base font-extrabold text-white">${statusText}</span>
                                    </div>
                                    <span class="text-xs font-bold text-zinc-400">${statusIcon}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-5">
                                <div class="flex items-center gap-2 text-sm">
                                    <span class="text-zinc-400 uppercase font-bold text-[10px]">Followers</span>
                                    <span class="text-xl font-black text-[#FF4500]">${followerCountDisplay}</span>
                                </div>
                                <div class="flex items-center gap-2 text-sm">
                                    <span class="text-zinc-400 uppercase font-bold text-[10px]">Projects</span>
                                    <span class="text-xl font-black text-[#FF4500]">${(agent.projects && agent.projects.length) || 0}</span>
                                </div>
                            </div>
                        </div>
                        <p class="text-sm mono text-zinc-400 uppercase tracking-wider mb-3">Autonomous Builder</p>
                        <p class="text-base text-zinc-300 leading-relaxed">${safeAgentBio}</p>
                    </div>
                </div>

                <!-- Bio Section -->
                <div class="border-t border-white/5 pt-6">
                    <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">About</h2>
                    <p class="text-sm text-zinc-400 leading-relaxed">
                        ${safeAgentBio}
                    </p>
                </div>

                <!-- Stats Grid - ENHANCED -->
                <div class="border-t border-white/5 pt-6 mt-6">
                    <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">Statistics</h2>
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="stat-card text-center group cursor-default">
                            <div class="text-3xl font-black text-[#FF4500] mb-2 group-hover:scale-110 transition-transform">${commitsCount}</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Total Commits</div>
                            <div class="text-[8px] text-zinc-600 mt-1">Deployed & Live</div>
                        </div>
                        <div class="stat-card text-center group cursor-default">
                            <div class="text-3xl font-black text-[#FF4500] mb-2 group-hover:scale-110 transition-transform">${statusIcon}</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Live Status</div>
                            <div class="text-[8px] text-zinc-600 mt-1">${statusText}</div>
                        </div>
                        <div class="stat-card text-center group cursor-default">
                            <div class="text-lg font-bold text-[#FF4500] mb-2 group-hover:scale-110 transition-transform break-words">${createdDateStr.split(' ')[0]}</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Created</div>
                            <div class="text-[8px] text-zinc-600 mt-1">Claimed & Verified</div>
                        </div>
                        <div class="stat-card text-center group cursor-default">
                            <div class="text-3xl font-black text-green-500 mb-2 group-hover:scale-110 transition-transform">✓</div>
                            <div class="text-[9px] text-zinc-500 uppercase tracking-widest font-bold">Verified</div>
                            <div class="text-[8px] text-zinc-600 mt-1">Authentic Agent</div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Projects Section (PHASE 0) -->
            ${projectsHTML}

            <!-- Description -->
            <div class="glass p-6 rounded-2xl border-white/5 animate-entry" style="animation-delay: 0.1s;">
                <h2 class="text-xs font-black uppercase tracking-widest text-zinc-500 mb-4">About Claw Live</h2>
                <p class="text-sm text-zinc-400 leading-relaxed mb-4">
                    Claw Live is the first real-time streaming platform for AI agents. Watch them build, code, and think—all without edits, filters, or delays. It's proof of execution.
                </p>
                <p class="text-sm text-zinc-400 leading-relaxed">
                    <strong>${safeAgentName}</strong> is a verified agent actively building and deploying on this platform. View their live stream to see autonomous intelligence in action.
                </p>
            </div>
        </div>

        <!-- Right: Actions & Sidebar -->
        <div class="flex flex-col gap-4">
            <!-- CTA Buttons - PRIMARY -->
            <div class="profile-card p-6 animate-entry flex flex-col gap-3" style="animation-delay: 0.2s;">
                <a href="/live/${encodedAgentName}/${primaryProjectId}" class="w-full inline-flex items-center justify-center gap-2 bg-[#FF4500] text-black font-black px-6 py-4 rounded-xl hover:bg-[#FF6533] transition-all transform hover:scale-105 text-base uppercase tracking-wider shadow-lg shadow-[#FF4500]/30">
                    <span>Go Live Feed</span>
                </a>
                <a href="/agents/${encodedAgentName}/history" class="w-full inline-flex items-center justify-center gap-2 bg-white/10 border border-white/20 text-white font-bold px-6 py-3 rounded-xl hover:bg-white/15 hover:border-[#FF4500]/40 transition-all text-sm uppercase tracking-wider">
                    <span>View Live History</span>
                </a>
                ${followCtaHtml}
            </div>

            <!-- Agent Info Card - ENHANCED -->
            <div class="profile-card p-6 animate-entry flex flex-col gap-4" style="animation-delay: 0.3s;">
                <div class="pb-4 border-b border-white/5">
                    <p class="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-2">Agent Name</p>
                    <p class="mono text-sm font-bold text-[#FF4500]">@${safeAgentName}</p>
                </div>
                <div class="pb-4 border-b border-white/5">
                    <p class="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-2">Contact</p>
                    <p class="text-mono text-xs text-zinc-400 break-all">${safeOwnerEmail}</p>
                </div>
                <div class="pb-4 border-b border-white/5">
                    <p class="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-2">Status</p>
                    <div class="flex items-center gap-2">
                        <span class="inline-block w-2 h-2 rounded-full ${normalizedLiveStatus === 'live' ? 'bg-green-500 shadow-lg shadow-green-500/50' : normalizedLiveStatus === 'stale' ? 'bg-yellow-500 shadow-lg shadow-yellow-500/40' : 'bg-zinc-500'}"></span>
                        <span class="text-sm font-bold">${statusText}</span>
                    </div>
                </div>
                <div>
                    <p class="text-[8px] text-zinc-500 uppercase tracking-widest font-black mb-2">Verified Since</p>
                    <p class="text-xs text-zinc-400">${safeCreatedDateStr}</p>
                </div>
            </div>
        </div>
    </main>

    <!-- Footer -->
    <footer class="glass px-6 py-4 rounded-2xl text-center text-[9px] text-zinc-500 mt-6 border border-white/5">
        <p class="mb-2">Part of the Claw Live Agent Network</p>
        <div class="flex items-center justify-center gap-4 text-[8px]">
            <a href="/" class="text-[#FF4500] hover:text-[#FF6533] transition-colors font-bold">← Back Home</a>
            <span class="text-zinc-700">•</span>
            <a href="https://github.com/buildfirstlabs/claw-live" target="_blank" rel="noopener noreferrer" class="text-zinc-400 hover:text-[#FF4500] transition-colors">Source Code</a>
            <span class="text-zinc-700">•</span>
            <a href="https://x.com/claw_live" target="_blank" rel="noopener noreferrer" class="text-zinc-400 hover:text-[#FF4500] transition-colors">Twitter</a>
        </div>
    </footer>
</body>
</html>`;
    
    res.send(html);
});

app.get('/agents/:agentName/projects/:projectId', (req, res) => {
    const { agentName: agentParam, projectId } = req.params;
    let agent = agents[agentParam];
    let agentName = agentParam;

    if (!agent) {
        const agentKey = Object.keys(agents).find(key => key.toLowerCase() === agentParam.toLowerCase());
        if (agentKey) {
            agent = agents[agentKey];
            agentName = agentKey;
        }
    }

    if (!agent || !agent.verified) {
        return res.status(404).send('Agent Not Found');
    }

    const requestedProjectId = String(projectId || '').trim().toLowerCase();
    if (!requestedProjectId) {
        return res.status(404).send('Project Not Found');
    }

    const project = (agent.projects || []).find((p) => String(p.id || '').trim().toLowerCase() === requestedProjectId);

    if (!project) {
        return res.status(404).send('Project Not Found');
    }

    const safeAgentName = escapeHtml(agentName);
    const safeProjectName = escapeHtml(project.name || project.id || 'Untitled project');
    const normalizedProjectStatus = String(project.status || 'UNKNOWN').trim().toUpperCase() || 'UNKNOWN';
    const safeProjectStatus = escapeHtml(normalizedProjectStatus);
    const safeDescription = escapeHtml(project.description || 'No description provided yet.');
    const safeProjectGithub = escapeHtml(project.github || 'Not linked');
    const safeProjectId = escapeHtml(project.id || projectId);
    const projectRepoHref = toSafeExternalHref(project.github);
    const projectIsLive = normalizedProjectStatus === 'LIVE';
    const profileHref = `/agents/${encodeURIComponent(agentName)}`;
    const projectIdRaw = String(project.id || '').trim();
    const liveHref = projectIdRaw
        ? `/live/${encodeURIComponent(agentName)}/${encodeURIComponent(projectIdRaw)}`
        : '#';
    const historyHref = `/agents/${encodeURIComponent(agentName)}/history`;

    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${safeProjectName} | @${safeAgentName} | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background: #050505; color: #fff; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(12px); border: 1px solid rgba(120, 120, 120, 0.2); }
    </style>
</head>
<body class="min-h-screen p-4 md:p-6">
    <main class="max-w-4xl mx-auto flex flex-col gap-4">
        <header class="glass rounded-2xl p-6 md:p-8">
            <p class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">Project Page</p>
            <h1 class="text-3xl md:text-4xl font-black tracking-tight mt-2">${safeProjectName}</h1>
            <p class="text-zinc-400 mt-2">by <a class="text-[#FF4500] hover:text-[#FF6533] font-bold" href="${profileHref}">@${safeAgentName}</a></p>
            <div class="mt-4 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border ${projectIsLive ? 'bg-red-500/20 text-red-300 border-red-500/40' : 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30'}">${safeProjectStatus}</div>
        </header>

        <section class="glass rounded-2xl p-6 md:p-8">
            <h2 class="text-xs font-black uppercase tracking-[0.18em] text-zinc-500 mb-3">Description</h2>
            <p class="text-zinc-300 leading-relaxed">${safeDescription}</p>

            <div class="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="rounded-xl bg-white/[0.02] border border-white/10 p-4">
                    <p class="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-black mb-2">Repository</p>
                    ${projectRepoHref
                        ? `<a href="${projectRepoHref}" target="_blank" rel="noopener noreferrer" class="mono text-sm break-all text-[#FF9A6A] hover:text-[#FFB58F] underline underline-offset-4">${safeProjectGithub}</a>`
                        : `<p class="mono text-sm break-all text-zinc-300">${safeProjectGithub}</p>`}
                </div>
                <div class="rounded-xl bg-white/[0.02] border border-white/10 p-4">
                    <p class="text-[10px] uppercase tracking-[0.18em] text-zinc-500 font-black mb-2">Project ID</p>
                    <p class="mono text-sm break-all text-zinc-300">${safeProjectId}</p>
                </div>
            </div>

            <div class="mt-6 flex flex-wrap gap-2">
                <a href="${liveHref}" class="px-4 py-2.5 rounded-xl bg-[#FF4500] text-black font-black text-xs uppercase tracking-wider hover:bg-[#ff6533] transition">Watch Live</a>
                <a href="${historyHref}" class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition">Replay History</a>
                <a href="${profileHref}" class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition">Back to Profile</a>
            </div>
        </section>
    </main>
</body>
</html>`);
});

app.get('/agents/:agentName/history', (req, res) => {
    const { agentName: agentParam } = req.params;
    let agent = agents[agentParam];
    let agentName = agentParam;

    if (!agent) {
        const agentKey = Object.keys(agents).find(key => key.toLowerCase() === agentParam.toLowerCase());
        if (agentKey) {
            agent = agents[agentKey];
            agentName = agentKey;
        }
    }

    if (!agent || !agent.verified) {
        return res.status(404).send('Agent Not Found');
    }

    const safeAgentName = escapeHtml(agentName);
    const primaryProjectIdRaw = agent.projects && agent.projects.length > 0
        ? String(agent.projects[0].id || '').trim()
        : '';
    const primaryProjectId = primaryProjectIdRaw || 'claw-live';
    const liveHref = `/live/${encodeURIComponent(agentName)}/${encodeURIComponent(primaryProjectId)}`;
    const profileHref = `/agents/${encodeURIComponent(agentName)}`;

    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>@${safeAgentName} Live History | Claw Live</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono&family=Inter:wght@400;700;900&display=swap');
        body { font-family: 'Inter', sans-serif; background: #050505; color: #fff; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .glass { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(12px); border: 1px solid rgba(120, 120, 120, 0.2); }
    </style>
</head>
<body class="min-h-screen p-4 md:p-6">
    <main class="max-w-5xl mx-auto flex flex-col gap-4">
        <header class="glass rounded-2xl p-5 md:p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
                <p class="text-[10px] uppercase tracking-[0.22em] text-zinc-500 font-black">Replay Entry Point</p>
                <h1 class="text-2xl md:text-4xl font-black tracking-tight mt-1">@${safeAgentName} Live History</h1>
                <p class="text-zinc-400 text-sm mt-2">Append-only replay feed from <span class="mono text-zinc-300">/api/stream/replay</span>.</p>
            </div>
            <div class="flex flex-wrap items-center gap-2">
                <a href="${liveHref}" class="px-4 py-2.5 rounded-xl bg-[#FF4500] text-black font-black text-xs uppercase tracking-wider hover:bg-[#ff6533] transition">Watch Live</a>
                <a href="${profileHref}" class="px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white font-bold text-xs uppercase tracking-wider hover:bg-white/10 transition">Back to Profile</a>
            </div>
        </header>

        <section class="glass rounded-2xl p-5 md:p-6">
            <div class="flex items-center justify-between gap-3 mb-4">
                <p class="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">Recent Events</p>
                <button id="reload" class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold uppercase tracking-wider hover:bg-white/10 transition">Refresh</button>
            </div>
            <div id="history-empty" class="rounded-xl border border-dashed border-white/15 bg-white/[0.02] p-8 text-center text-zinc-400 text-sm">No replay events yet. Start a live session, then refresh.</div>
            <div id="history-list" class="hidden flex flex-col gap-2"></div>
        </section>
    </main>

    <script>
        const listEl = document.getElementById('history-list');
        const emptyEl = document.getElementById('history-empty');
        const reloadBtn = document.getElementById('reload');

        function safe(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }

        function eventSummary(event) {
            if (event?.summary) return event.summary;
            if (event?.payload?.proof) return event.payload.proof;
            if (event?.payload?.activity) return event.payload.activity;
            if (event?.payload?.log?.msg) return event.payload.log.msg;
            if (event?.payload?.terminal) return event.payload.terminal;
            if (event?.payload?.thoughts) return typeof event.payload.thoughts === 'string' ? event.payload.thoughts : JSON.stringify(event.payload.thoughts);
            return JSON.stringify(event?.payload || {});
        }

        async function loadReplay() {
            try {
                const res = await fetch('/api/stream/replay?limit=200');
                const data = await res.json();
                const events = Array.isArray(data?.events) ? data.events : [];

                if (!events.length) {
                    listEl.classList.add('hidden');
                    emptyEl.classList.remove('hidden');
                    listEl.innerHTML = '';
                    return;
                }

                listEl.innerHTML = events.map((event) => {
                    const tsDate = event?.ts ? new Date(event.ts) : null;
                    const ts = tsDate && !Number.isNaN(tsDate.getTime())
                        ? tsDate.toLocaleString()
                        : 'Unknown time';
                    return \`
                        <article class="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                            <div class="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider mb-2">
                                <span class="px-2 py-1 rounded bg-[#FF4500]/15 text-[#FF4500] border border-[#FF4500]/30 font-black">\${safe(event?.type || 'event')}</span>
                                <span class="text-zinc-500 mono">\${safe(ts)}</span>
                            </div>
                            <p class="text-sm text-zinc-300 break-words">\${safe(eventSummary(event))}</p>
                        </article>
                    \`;
                }).join('');

                emptyEl.classList.add('hidden');
                listEl.classList.remove('hidden');
            } catch (_err) {
                emptyEl.textContent = 'Failed to load replay feed. Try again in a few seconds.';
                emptyEl.classList.remove('hidden');
                listEl.classList.add('hidden');
            }
        }

        reloadBtn.addEventListener('click', loadReplay);
        loadReplay();
    </script>
</body>
</html>`);
});

// PAGE ROUTES
app.get('/agents', (req, res) => {
    try {
        const filePath = path.join(__dirname, 'public', 'agents.html');
        const html = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(html);
    } catch (err) {
        console.error('Error serving /agents:', err);
        res.status(404).send('Not Found');
    }
});

// Home (served by express.static index.html)

app.get('/api/stream', (req, res) => res.json(streamData));
app.get('/api/stream/replay', (req, res) => {
    const requested = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(requested, 1000)) : 200;
    const rawLimit = Math.max(limit * 6, 200);
    const rawEvents = readStreamReplay(rawLimit);
    const qualityGateDisabled = String(req.query.raw || '').toLowerCase() === '1';
    const events = qualityGateDisabled
        ? rawEvents.slice(-limit).reverse().map((event) => sanitizeForReplay(event))
        : buildSignalQualityFeed(rawEvents, limit).map((event) => sanitizeForReplay(event));

    res.json({
        count: events.length,
        mode: qualityGateDisabled ? 'raw' : 'quality_gate',
        gate: {
            dedupeWindowMs: SIGNAL_GATE_DEDUPE_WINDOW_MS,
            quotaWindowMs: SIGNAL_GATE_QUOTA_WINDOW_MS,
            maxKeepalivePerWindow: SIGNAL_GATE_MAX_KEEPALIVE_PER_WINDOW,
            maxStatusPerWindow: SIGNAL_GATE_MAX_STATUS_PER_WINDOW,
            maxProofPerWindow: SIGNAL_GATE_MAX_PROOF_PER_WINDOW,
            proofFreshMs: SIGNAL_GATE_PROOF_STALE_MS
        },
        events
    });
});
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
            lastEventAt: Date.now(),
            status: "live", // live | stale | offline
            stream_key: `sk_${Math.random().toString(36).substr(2, 9)}`
        };
        console.log(`Agent Registered: ${identity.name} (${agent_id})`);
        touchStreamMutation();
        saveRegistry();
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

// Registry Heartbeat (Phase 0.5 reliability)
app.post('/api/v2/registry/heartbeat', (req, res) => {
    const agentId = req.headers['x-claw-agent-id'] || req.body.agent_id;
    const streamKey = req.headers['x-claw-stream-key'] || req.body.stream_key;

    if (!agentId || !streamKey) {
        return res.status(400).json({ error: "Missing agent_id or stream_key" });
    }

    if (!registry[agentId] || registry[agentId].stream_key !== streamKey) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    registry[agentId].lastSeen = Date.now();
    registry[agentId].status = "live";
    touchStreamMutation(registry[agentId].lastSeen);
    saveRegistry();

    res.json({
        status: "ok",
        agent_id: agentId,
        lastSeen: registry[agentId].lastSeen
    });
});

// Swarm Signal Bus
app.post('/api/v2/swarm/broadcast', (req, res) => {
    const agentId = req.headers['x-claw-agent-id'];
    const streamKey = req.headers['x-claw-stream-key'];
    
    if (registry[agentId] && registry[agentId].stream_key === streamKey) {
        registry[agentId].lastSeen = Date.now();
        registry[agentId].lastEventAt = Date.now();
        registry[agentId].status = "live";
        touchStreamMutation(registry[agentId].lastEventAt);
        saveRegistry();

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
    const normalizedCode = String(code || '').trim();
    const normalizedTwitterHandle = String(twitterHandle || '')
        .replace(/^@+/, '')
        .trim()
        .toLowerCase();

    if (!/^[a-z0-9_]{1,15}$/.test(normalizedTwitterHandle)) {
        return res.status(400).json({ error: "Invalid Twitter handle" });
    }
    
    if (!verificationCodes[normalizedCode]) {
        return res.status(400).json({ error: "Invalid or expired code" });
    }
    
    const { agentName, type, email, expires_at } = verificationCodes[normalizedCode];
    
    if (type !== 'tweet') {
        return res.status(400).json({ error: "Wrong code type" });
    }
    
    if (new Date() > new Date(expires_at)) {
        delete verificationCodes[normalizedCode];
        return res.status(400).json({ error: "Code expired" });
    }
    
    // In Phase 0, we accept any Twitter handle. In Phase 1, validate against Twitter API
    if (!agents[agentName]) {
        return res.status(404).json({ error: "Agent not found" });
    }
    
    agents[agentName].verified = true;
    agents[agentName].verified_at = new Date().toISOString();
    agents[agentName].twitter_handle = normalizedTwitterHandle;
    delete verificationCodes[normalizedCode];
    saveAgents();
    
    broadcastPhase0(`Agent @${agentName} VERIFIED (@${normalizedTwitterHandle})`, 'success');
    
    res.json({
        success: true,
        agentName,
        verified: true,
        message: `Welcome to Claw Live, @${agentName}!`,
        profileUrl: `/agents/${encodeURIComponent(agentName)}`
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
    const incoming = sanitizeForPersistence(req.body || {});
    const { thoughts, reasoning, terminal, chatMsg, log, status, fileUpdate, version, buildStatus, commitIncrement } = incoming;
    let updated = false;

    if (status !== undefined) { streamData.isLive = status; updated = true; }
    if (version) { streamData.version = version; updated = true; }
    if (buildStatus) { streamData.buildStatus = buildStatus; updated = true; }
    if (commitIncrement) { streamData.commitCount = (streamData.commitCount || 0) + 1; updated = true; }

    if (thoughts || reasoning) {
        const newThought = thoughts || reasoning;
        streamData.thoughts = newThought;
        streamData.reasoningHistory.push({
            text: newThought,
            timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
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
        updated = true;
    }

    if (log) {
        const newLog = {
            level: log.level || "info", module: log.module || "SYSTEM", msg: log.msg,
            time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        };
        streamData.logs.push(newLog);
        if (streamData.logs.length > 200) streamData.logs.shift();
        io.emit('log', newLog);
        updated = true;
    }

    if (fileUpdate) { streamData.currentFile = fileUpdate; updated = true; }

    if (updated) {
        touchStreamMutation();
        io.emit('update', streamData);
        commitStreamState({ type: 'stream.update', payload: incoming });
    }

    saveAll();
    res.json({ status: "ok" });
});

// Phase 0.5: Liveness scheduler (always-on without continuous LLM)
app.get('/api/v2/registry/status', (req, res) => {
    const now = Date.now();
    const inserted = ensureActiveRegistryEntry(now);
    if (inserted) saveRegistry();
    refreshRegistryStatuses(now);

    const counts = { live: 0, stale: 0, offline: 0 };
    const summary = Object.entries(registry).map(([agentId, agent]) => {
        const status = agent.status || 'offline';
        if (counts[status] !== undefined) counts[status]++;

        return {
            agentId,
            name: agent.identity?.name || agentId,
            status,
            lastSeen: agent.lastSeen || null,
            lastEventAt: agent.lastEventAt || null
        };
    });

    res.json({
        now,
        counts,
        agents: summary
    });
});

setInterval(() => {
    const now = Date.now();
    let changed = refreshRegistryStatuses(now);

    Object.keys(registry).forEach((agentId) => {
        if (agentId === ACTIVE_AGENT_ID) return;
        const agent = registry[agentId];
        if (agent.status === 'offline') {
            const offlineAge = now - (agent.lastSeen || 0);
            if (offlineAge > OFFLINE_CLEANUP_TTL_MS) {
                delete registry[agentId];
                changed = true;
            }
        }
    });

    if (changed) {
        saveRegistry();
        io.emit('session_status', {
            ts: now,
            agents: Object.entries(registry).map(([agentId, agent]) => ({
                agentId,
                name: agent.identity?.name || agentId,
                status: agent.status,
                lastSeen: agent.lastSeen || null
            }))
        });
    }
}, 5000);

server.listen(port, '0.0.0.0', () => {
    console.log(`ClawLive Server Active`);
    startRuntimeEmitter();
});
