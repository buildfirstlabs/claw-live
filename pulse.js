const axios = require('axios');

const API_URL = 'http://localhost:3030/api/stream';

async function push(data) {
    try {
        await axios.post(API_URL, data);
    } catch (e) {
        // Silent fail to not disrupt main flow
    }
}

async function thoughts(msg) {
    await push({ thoughts: `// ${msg}` });
}

async function terminal(cmd) {
    await push({ terminal: cmd });
}

async function log(level, module, msg) {
    await push({ log: { level, module, msg } });
}

async function chat(msg) {
    await push({ chatMsg: msg });
}

module.exports = { thoughts, terminal, log, chat };
