'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, spawn } = require('node:child_process');
const { createServer } = require('../dashboard/server.js');
const { isRunning } = require('./ensure-server.js');

const HOOK = path.join(__dirname, 'ensure-server.js');
const tmpEnv = () => ({ MODEL_ROUTER_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mr-ens-')) });
const writeInfo = (env, info) =>
  fs.writeFileSync(path.join(env.MODEL_ROUTER_DIR, 'server.json'), JSON.stringify(info));

function runAsync(env) {
  return new Promise((resolve) => {
    const c = spawn('node', [HOOK], { env: { ...process.env, ...env } });
    let stdout = '';
    c.stdout.on('data', (d) => (stdout += d));
    c.on('close', (status) => resolve({ status, stdout }));
  });
}

function listen(env) {
  const server = createServer(env);
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r({ server, port: server.address().port })));
}

test('isRunning is false without server.json', async () => {
  assert.strictEqual(await isRunning(tmpEnv()), false);
});

test('isRunning is true for a live server described by server.json', async () => {
  const env = tmpEnv();
  const { server, port } = await listen(env);
  try {
    writeInfo(env, { pid: process.pid, port });
    assert.strictEqual(await isRunning(env), true);
  } finally {
    server.close();
  }
});

test('isRunning is false when the recorded port answers nothing', async () => {
  const env = tmpEnv();
  const { server, port } = await listen(env);
  server.close();
  writeInfo(env, { pid: process.pid, port });
  assert.strictEqual(await isRunning(env), false);
});

test('isRunning is false for a dead pid', async () => {
  const env = tmpEnv();
  const { server, port } = await listen(env);
  try {
    writeInfo(env, { pid: 2147483646, port });
    assert.strictEqual(await isRunning(env), false);
  } finally {
    server.close();
  }
});

test('the hook does not start a second server when one is running', async () => {
  const env = tmpEnv();
  const { server, port } = await listen(env);
  try {
    writeInfo(env, { pid: process.pid, port });
    const r = await runAsync(env);
    assert.strictEqual(r.status, 0);
    assert.strictEqual(JSON.parse(r.stdout).systemMessage.includes(`http://localhost:${port}`), true);
    await new Promise((res) => setTimeout(res, 400));
    const info = JSON.parse(fs.readFileSync(path.join(env.MODEL_ROUTER_DIR, 'server.json'), 'utf8'));
    assert.strictEqual(info.port, port);
  } finally {
    server.close();
  }
});

test('the hook starts a detached server when none is running', async () => {
  const env = tmpEnv();
  writeInfo(env, { pid: 2147483646, port: 1 });
  const r = spawnSync('node', [HOOK], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  const msg = JSON.parse(r.stdout).systemMessage;
  let info;
  for (let i = 0; i < 30 && !info; i++) {
    await new Promise((res) => setTimeout(res, 100));
    try {
      info = JSON.parse(fs.readFileSync(path.join(env.MODEL_ROUTER_DIR, 'server.json'), 'utf8'));
    } catch {
      /* henüz yok */
    }
  }
  try {
    assert.ok(info && info.port, 'server.json yazılmadı');
    assert.ok(msg.includes(`http://localhost:${info.port}`), msg);
    assert.strictEqual(await isRunning(env), true);
  } finally {
    if (info) try { process.kill(info.pid); } catch { /* zaten kapalı */ }
  }
});

test('a second server exits instead of drifting to another port when one already answers', async () => {
  const env = tmpEnv();
  const { server, port } = await listen(env);
  try {
    const child = spawn('node', [path.join(__dirname, '..', 'dashboard', 'server.js')], {
      env: { ...process.env, ...env, MODEL_ROUTER_BASE_PORT: String(port) },
      stdio: 'ignore',
    });
    const code = await new Promise((res) => {
      const t = setTimeout(() => { child.kill(); res('still-running'); }, 3000);
      child.on('exit', (c) => { clearTimeout(t); res(c); });
    });
    assert.strictEqual(code, 0);
  } finally {
    server.close();
  }
});
