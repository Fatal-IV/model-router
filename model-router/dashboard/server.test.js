'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createServer } = require('./server.js');
const { appendEvent, readEvents } = require('./store.js');

function setup(events = []) {
  const env = { MODEL_ROUTER_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mr-srv-')) };
  for (const e of events) appendEvent(e, env);
  const server = createServer(env);
  return new Promise((resolve) =>
    server.listen(0, '127.0.0.1', () => resolve({ env, server, port: server.address().port }))
  );
}

function req(port, method, url, headers = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: url, headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    });
    r.on('error', reject);
    r.end();
  });
}

const ev = (id, project, ts, summary = 's') => ({
  type: 'start', id, ts, project, cwd: '/w/' + project, summary, model: 'opus', source: 'auto', reason: 'r',
});

test('serves projects and per-project events (newest first)', async () => {
  const { server, port } = await setup([ev('a', 'p1', 1), ev('b', 'p1', 2), ev('c', 'p2', 3)]);
  try {
    const projects = JSON.parse((await req(port, 'GET', '/api/projects')).body);
    assert.deepStrictEqual(projects.map((p) => p.project), ['p2', 'p1']);
    const events = JSON.parse((await req(port, 'GET', '/api/events?project=p1')).body);
    assert.deepStrictEqual(events.map((e) => e.id), ['b', 'a']);
  } finally {
    server.close();
  }
});

test('serves the HTML page and it never uses innerHTML', async () => {
  const { server, port } = await setup();
  try {
    const r = await req(port, 'GET', '/');
    assert.strictEqual(r.status, 200);
    assert.ok(r.type.startsWith('text/html'));
    assert.ok(!r.body.includes('innerHTML'));
  } finally {
    server.close();
  }
});

test('script-like summaries come back as plain data', async () => {
  const { server, port } = await setup([ev('a', 'p1', 1, '<script>alert(1)</script>')]);
  try {
    const events = JSON.parse((await req(port, 'GET', '/api/events?project=p1')).body);
    assert.strictEqual(events[0].summary, '<script>alert(1)</script>');
  } finally {
    server.close();
  }
});

test('listens on loopback only', async () => {
  const { server } = await setup();
  try {
    assert.strictEqual(server.address().address, '127.0.0.1');
  } finally {
    server.close();
  }
});

test('POST /api/clear rejects a foreign origin and keeps the data', async () => {
  const { env, server, port } = await setup([ev('a', 'p1', 1)]);
  try {
    const r = await req(port, 'POST', '/api/clear', { Origin: 'http://evil.example' });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(readEvents(env).length, 1);
  } finally {
    server.close();
  }
});

test('POST /api/clear rejects a foreign Host header (DNS rebinding)', async () => {
  const { env, server, port } = await setup([ev('a', 'p1', 1)]);
  try {
    const r = await req(port, 'POST', '/api/clear', { Host: 'evil.example' });
    assert.strictEqual(r.status, 403);
    assert.strictEqual(readEvents(env).length, 1);
  } finally {
    server.close();
  }
});

test('POST /api/clear from the same origin clears the data', async () => {
  const { env, server, port } = await setup([ev('a', 'p1', 1)]);
  try {
    const r = await req(port, 'POST', '/api/clear', { Origin: `http://127.0.0.1:${port}` });
    assert.strictEqual(r.status, 204);
    assert.strictEqual(readEvents(env).length, 0);
  } finally {
    server.close();
  }
});

test('unknown paths return 404', async () => {
  const { server, port } = await setup();
  try {
    assert.strictEqual((await req(port, 'GET', '/nope')).status, 404);
  } finally {
    server.close();
  }
});
