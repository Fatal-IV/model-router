'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('./server.js');

const PANEL = path.join(__dirname, 'panel.js');
const tmpEnv = () => ({ MODEL_ROUTER_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mr-panel-')) });


function freePort() {
  return new Promise((resolve) => {
    const s = require('node:net').createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => resolve(String(p)));
    });
  });
}

function run(env) {
  return new Promise((resolve) => {
    const c = spawn('node', [PANEL], { env: { ...process.env, ...env } });
    let stdout = '';
    c.stdout.on('data', (d) => (stdout += d));
    c.on('close', (status) => resolve({ status, stdout }));
  });
}

test('prints the address of the running panel', async () => {
  const env = tmpEnv();
  const server = createServer(env);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  try {
    fs.writeFileSync(path.join(env.MODEL_ROUTER_DIR, 'server.json'), JSON.stringify({ pid: process.pid, port }));
    const r = await run(env);
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout.trim(), `Model Router paneli: http://localhost:${port}`);
  } finally {
    server.close();
  }
});

test('starts the panel when it is down and prints its new address', async () => {
  const env = { ...tmpEnv(), MODEL_ROUTER_BASE_PORT: await freePort() };
  const r = await run(env);
  const info = JSON.parse(fs.readFileSync(path.join(env.MODEL_ROUTER_DIR, 'server.json'), 'utf8'));
  try {
    assert.strictEqual(r.status, 0);
    assert.strictEqual(r.stdout.trim(), `Model Router paneli: http://localhost:${info.port}`);
  } finally {
    try { process.kill(info.pid); } catch { /* zaten kapalı */ }
  }
});
