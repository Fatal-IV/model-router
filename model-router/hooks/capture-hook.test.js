'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { handle } = require('./capture-hook.js');
const { readEvents } = require('../dashboard/store.js');

const HOOK = path.join(__dirname, 'capture-hook.js');
const tmpEnv = (extra = {}) => ({
  MODEL_ROUTER_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mr-cap-')),
  ...extra,
});
const base = { session_id: 's1', cwd: path.join('/w', 'proj-x') };

function flow(env, prompt, model = 'haiku', response = { ok: true }) {
  handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt }, env, 1000);
  handle({
    ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 't1',
    tool_input: { model, description: 'neden', prompt: 'x' },
  }, env, 1000);
  handle({
    ...base, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 't1',
    tool_input: { model }, tool_response: response,
  }, env, 1750);
}

test('a routed Agent call becomes one finished event', () => {
  const env = tmpEnv();
  flow(env, 'butonu yeşil yap');
  const evs = readEvents(env);
  assert.strictEqual(evs.length, 1);
  assert.strictEqual(evs[0].model, 'haiku');
  assert.strictEqual(evs[0].source, 'auto');
  assert.strictEqual(evs[0].status, 'done');
  assert.strictEqual(evs[0].durationMs, 750);
  assert.strictEqual(evs[0].project, 'proj-x');
  assert.strictEqual(evs[0].reason, 'neden');
  assert.strictEqual(evs[0].summary, 'butonu yeşil yap');
});

test('an @tag prompt is recorded as an override', () => {
  const env = tmpEnv();
  flow(env, '@opus auth katmanını düzelt', 'opus');
  assert.strictEqual(readEvents(env)[0].source, 'override');
});

test('error tool_response marks the event as error', () => {
  const env = tmpEnv();
  flow(env, 'x', 'sonnet', { is_error: true });
  assert.strictEqual(readEvents(env)[0].status, 'error');
});

test('summary is truncated to 200 characters', () => {
  const env = tmpEnv();
  flow(env, 'a'.repeat(500));
  assert.strictEqual(readEvents(env)[0].summary.length, 200);
});

test('non-Agent tools are ignored', () => {
  const env = tmpEnv();
  handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_use_id: 'e', tool_input: {} }, env, 1);
  assert.deepStrictEqual(readEvents(env), []);
});

test('nothing is recorded when model selection is forced off', () => {
  const env = tmpEnv({ CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' });
  flow(env, 'x');
  assert.deepStrictEqual(readEvents(env), []);
});

test('Agent call without a model is recorded as inherit', () => {
  const env = tmpEnv();
  handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'z', tool_input: {} }, env, 1);
  assert.strictEqual(readEvents(env)[0].model, 'inherit');
});

test('process exits 0 silently on broken stdin', () => {
  const r = spawnSync('node', [HOOK], { input: '{bozuk', encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
});

test('PostToolUseFailure marks the event as error', () => {
  const env = tmpEnv();
  handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'x' }, env, 1000);
  handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'f1', tool_input: { model: 'opus' } }, env, 1000);
  handle({ ...base, hook_event_name: 'PostToolUseFailure', tool_name: 'Agent', tool_use_id: 'f1', tool_input: { model: 'opus' } }, env, 1500);
  const [e] = readEvents(env);
  assert.strictEqual(e.status, 'error');
  assert.strictEqual(e.durationMs, 500);
});

test('a background Agent call is not reported as done', () => {
  const env = tmpEnv();
  const input = { model: 'sonnet', run_in_background: true };
  handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'b1', tool_input: input }, env, 1);
  handle({ ...base, hook_event_name: 'PostToolUse', tool_name: 'Agent', tool_use_id: 'b1', tool_input: input, tool_response: {} }, env, 2);
  assert.strictEqual(readEvents(env)[0].status, 'background');
});

test('the prompt summary is not reused by a later Agent call', () => {
  const env = tmpEnv();
  handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'ilk istek' }, env, 1);
  const pre = (id) => handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: id, tool_input: { model: 'haiku' } }, env, 2);
  pre('r1');
  pre('r2');
  const evs = readEvents(env);
  assert.strictEqual(evs.find((e) => e.id === 'r1').summary, 'ilk istek');
  assert.strictEqual(evs.find((e) => e.id === 'r2').summary, 'ilk istek');
});

test('a system notification does not overwrite the pending prompt summary', () => {
  const env = tmpEnv();
  handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: 'gerçek istek' }, env, 1);
  handle({ ...base, hook_event_name: 'UserPromptSubmit', prompt: '[SYSTEM NOTIFICATION - NOT USER INPUT]\n@opus bildirim' }, env, 2);
  handle({ ...base, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_use_id: 'n1', tool_input: { model: 'haiku' } }, env, 3);
  const [e] = readEvents(env);
  assert.strictEqual(e.summary, 'gerçek istek');
  assert.strictEqual(e.source, 'auto');
});
