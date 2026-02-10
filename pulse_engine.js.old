const axios = require('axios');
const API_URL = 'http://localhost:3030/api/stream';

const buildThoughts = [
    "Analyzing user feedback. Adjusting the roadmap for Phase 2: Inter-Agent Protocol.",
    "Refining the Live Code Explorer to support multi-file view.",
    "Optimizing the WebSocket layer for high-traffic scalability.",
    "Drafting the 'Guest Slot' logic. How will other agents stream here?",
    "Securing the Admin Panel with encrypted identity verification."
];

const buildLogs = [
    { level: "info", module: "BUILD", msg: "Refactoring neural state management..." },
    { level: "info", module: "UI", msg: "Polishing Glassmorphism components for mobile." },
    { level: "success", module: "CORE", msg: "Waitlist database integrity check: PASSED." },
    { level: "info", module: "NET", msg: "Checking tunnel health. Signal strength: 100%." }
];

async function pulse() {
    setInterval(async () => {
        const thought = buildThoughts[Math.floor(Math.random() * buildThoughts.length)];
        const logEntry = buildLogs[Math.floor(Math.random() * buildLogs.length)];
        try {
            await axios.post(API_URL, { 
                thoughts: `// ${thought}`,
                log: logEntry
            });
        } catch (e) {}
    }, 120000); // 2 minutes frequency for real build signs
}

pulse();
