'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { detectOverride, buildContext, run } = require('./route-hook.js');

const HOOK = path.join(__dirname, 'route-hook.js');

test('detects a leading override tag', () => {
  assert.strictEqual(detectOverride('@opus şunu yap'), 'opus');
});

test('override tag is case-insensitive', () => {
  assert.strictEqual(detectOverride('@OPUS x'), 'opus');
});

test('detects a tag mid-sentence followed by punctuation', () => {
  assert.strictEqual(detectOverride('lütfen @haiku ile yap.'), 'haiku');
});

test('first of several tags wins', () => {
  assert.strictEqual(detectOverride('@haiku ... @opus'), 'haiku');
});

test('email-like text is not an override', () => {
  assert.strictEqual(detectOverride('ali@opus.com'), null);
});

test('unknown or longer tags are not overrides', () => {
  assert.strictEqual(detectOverride('@gpt4 x'), null);
  assert.strictEqual(detectOverride('@opuss x'), null);
});

test('non-string prompts yield null', () => {
  assert.strictEqual(detectOverride(''), null);
  assert.strictEqual(detectOverride(undefined), null);
  assert.strictEqual(detectOverride(42), null);
});

test('buildContext with override names the model and the skill', () => {
  const ctx = buildContext('fable');
  assert.ok(ctx.includes('fable'));
  assert.ok(ctx.includes('model-routing'));
  assert.ok(ctx.length < 10000);
});

test('buildContext without override mentions the skill but selects no model', () => {
  const ctx = buildContext(null);
  assert.ok(ctx.includes('model-routing'));
  assert.ok(!/seçti/.test(ctx));
  assert.ok(ctx.length < 10000);
});

test('run returns UserPromptSubmit additionalContext JSON', () => {
  const out = JSON.parse(run(JSON.stringify({ prompt: '@sonnet x' })));
  assert.strictEqual(out.hookSpecificOutput.hookEventName, 'UserPromptSubmit');
  assert.strictEqual(typeof out.hookSpecificOutput.additionalContext, 'string');
  assert.ok(out.hookSpecificOutput.additionalContext.includes('sonnet'));
});

test('run is silent for empty, broken or invalid input', () => {
  assert.strictEqual(run(''), '');
  assert.strictEqual(run('{bozuk'), '');
  assert.strictEqual(run('{"prompt":42}'), '');
  assert.strictEqual(run('{}'), '');
});

test('run handles a 100000-character prompt', () => {
  const out = run(JSON.stringify({ prompt: 'a'.repeat(100000) }));
  assert.ok(JSON.parse(out).hookSpecificOutput.additionalContext.length < 10000);
});

test('process exits 0 with no output on broken stdin', () => {
  const r = spawnSync('node', [HOOK], { input: '{bozuk', encoding: 'utf8' });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
});

test('process exits 0 with valid JSON on good stdin', () => {
  const r = spawnSync('node', [HOOK], {
    input: JSON.stringify({ prompt: 'x' }),
    encoding: 'utf8',
  });
  assert.strictEqual(r.status, 0);
  assert.doesNotThrow(() => JSON.parse(r.stdout));
});
