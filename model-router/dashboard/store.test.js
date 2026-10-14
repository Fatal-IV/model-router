'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { dataDir, appendEvent, readEvents, listProjects, clearEvents } = require('./store.js');

function tmpEnv() {
  return { MODEL_ROUTER_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mr-store-')) };
}

const start = (id, project, ts) => ({
  type: 'start', id, ts, project, cwd: '/x/' + project, summary: 's', model: 'haiku', source: 'auto', reason: 'r',
});

test('dataDir honours MODEL_ROUTER_DIR', () => {
  assert.strictEqual(dataDir({ MODEL_ROUTER_DIR: '/tmp/z' }), '/tmp/z');
});

test('appendEvent then readEvents returns a running start event', () => {
  const env = tmpEnv();
  appendEvent(start('a', 'p1', 1), env);
  const [ev] = readEvents(env);
  assert.strictEqual(ev.id, 'a');
  assert.strictEqual(ev.status, 'running');
});

test('end event merges status and duration into its start', () => {
  const env = tmpEnv();
  appendEvent(start('a', 'p1', 1), env);
  appendEvent({ type: 'end', id: 'a', ts: 5, status: 'done', durationMs: 4 }, env);
  const evs = readEvents(env);
  assert.strictEqual(evs.length, 1);
  assert.strictEqual(evs[0].status, 'done');
  assert.strictEqual(evs[0].durationMs, 4);
});

test('corrupt lines are skipped', () => {
  const env = tmpEnv();
  appendEvent(start('a', 'p1', 1), env);
  fs.appendFileSync(path.join(env.MODEL_ROUTER_DIR, 'events.jsonl'), '{bozuk\n');
  appendEvent(start('b', 'p1', 2), env);
  assert.strictEqual(readEvents(env).length, 2);
});

test('readEvents is empty when no file exists', () => {
  assert.deepStrictEqual(readEvents(tmpEnv()), []);
});

test('listProjects orders by most recent event', () => {
  const env = tmpEnv();
  appendEvent(start('a', 'old', 1), env);
  appendEvent(start('b', 'new', 9), env);
  appendEvent(start('c', 'old', 2), env);
  const ps = listProjects(readEvents(env));
  assert.deepStrictEqual(ps.map((p) => p.project), ['new', 'old']);
  assert.strictEqual(ps[1].count, 2);
});

test('clearEvents empties the store', () => {
  const env = tmpEnv();
  appendEvent(start('a', 'p1', 1), env);
  clearEvents(env);
  assert.deepStrictEqual(readEvents(env), []);
});
