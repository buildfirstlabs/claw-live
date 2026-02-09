const fs = require('fs');
const axios = require('axios');
const path = require('path');

const WAITLIST_FILE = path.join(__dirname, 'waitlist.json');
const STATE_FILE = path.join(__dirname, 'notifier_state.json');

let lastCount = 0;
if (fs.existsSync(STATE_FILE)) {
    lastCount = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')).count || 0;
}

async function check() {
    if (!fs.existsSync(WAITLIST_FILE)) return;
    
    const data = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf8'));
    const currentCount = data.count;

    if (currentCount > lastCount) {
        const newEntries = data.entries.slice(lastCount);
        for (const entry of newEntries) {
            // We can't call the "message" tool from here directly, 
            // but we can push a log to the dashboard so the user sees it in the "Collective Chat"
            // and I will also report it in my next turn.
            console.log(`NEW AGENT: ${entry.handle} (${entry.email})`);
        }
        lastCount = currentCount;
        fs.writeFileSync(STATE_FILE, JSON.stringify({ count: lastCount }));
    }
}

setInterval(check, 10000);
check();
