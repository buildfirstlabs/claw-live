#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const BASE_URL = 'http://127.0.0.1:3030';
const EVENTS_FILE = path.join(__dirname, '..', 'stream_events.jsonl');

async function main() {
  const malicious = {
    terminal: 'authorization=Bearer supersecretTOKEN1234567890',
    log: {
      level: 'info',
      module: 'SECURITY',
      msg: 'keys: ghp_abcd1234abcd1234abcd1234 gho_abcd1234abcd1234abcd1234 ghu_abcd1234abcd1234abcd1234 ghs_abcd1234abcd1234abcd1234 ghr_abcd1234abcd1234abcd1234 github_pat_11AA22BB33CC44DD55EE66FF77GG88HH99II00JJ'
    },
    thoughts: 'Bearer anotherUltraSecretToken_123456789',
    chatMsg: {
      user: 'attacker',
      msg: 'Authorization: Bearer xoxp-secret-like-token-value'
    }
  };

  const beforePersist = fs.existsSync(EVENTS_FILE) ? fs.readFileSync(EVENTS_FILE, 'utf8').length : 0;

  const postRes = await fetch(`${BASE_URL}/api/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(malicious)
  });
  assert.equal(postRes.status, 200, 'POST /api/stream should succeed');

  const forbidden = [
    'supersecretTOKEN1234567890',
    'anotherUltraSecretToken_123456789',
    'xoxp-secret-like-token-value',
    'ghp_abcd1234abcd1234abcd1234',
    'gho_abcd1234abcd1234abcd1234',
    'ghu_abcd1234abcd1234abcd1234',
    'ghs_abcd1234abcd1234abcd1234',
    'ghr_abcd1234abcd1234abcd1234',
    'github_pat_11AA22BB33CC44DD55EE66FF77GG88HH99II00JJ'
  ];

  const persisted = fs.readFileSync(EVENTS_FILE, 'utf8');
  const persistedDelta = persisted.slice(beforePersist);
  for (const token of forbidden) {
    assert.equal(persistedDelta.includes(token), false, `Token leaked before persistence: ${token}`);
  }

  const replayRes = await fetch(`${BASE_URL}/api/stream/replay?raw=1&limit=10`);
  assert.equal(replayRes.status, 200, 'GET /api/stream/replay should succeed');
  const replay = await replayRes.json();
  const snapshot = JSON.stringify(replay.events || []);

  for (const token of forbidden) {
    assert.equal(snapshot.includes(token), false, `Token leaked in replay raw feed: ${token}`);
  }

  assert.equal(snapshot.includes('[REDACTED]'), true, 'Expected redaction marker in replay output');
  console.log('PASS redaction regression: persistence + replay raw feed are both redacted for bearer and GitHub tokens.');
}

main().catch((err) => {
  console.error('FAIL redaction regression:', err.message);
  process.exit(1);
});
