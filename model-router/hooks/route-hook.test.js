'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { detectOverride, buildContext, run, isSystemPrompt } = require('./route-hook.js');

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

test('detects tags with Turkish apostrophe suffixes and wrapping punctuation', () => {
  assert.strictEqual(detectOverride("@opus'la yap"), 'opus');
  assert.strictEqual(detectOverride('@opus’u kullan'), 'opus');
  assert.strictEqual(detectOverride('(@opus)'), 'opus');
  assert.strictEqual(detectOverride('`@haiku` ile'), 'haiku');
  assert.strictEqual(detectOverride('"@sonnet"'), 'sonnet');
  assert.strictEqual(detectOverride('@opus...'), 'opus');
});

test('override context tells the model to invoke the skill even for questions', () => {
  const ctx = buildContext('haiku');
  assert.ok(ctx.includes('Skill aracıyla'));
  assert.ok(ctx.includes('soru'));
});

test('context reports when model selection is forced off by the environment', () => {
  const forced = buildContext(null, { CLAUDE_CODE_SUBAGENT_MODEL_FORCE: '1' });
  assert.ok(forced.includes('CLAUDE_CODE_SUBAGENT_MODEL_FORCE'));
  assert.ok(forced.includes('devre dışı'));
  assert.ok(!buildContext(null, {}).includes('CLAUDE_CODE_SUBAGENT_MODEL_FORCE'));
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

test('buildContext without override says the skill is invoked before any code change', () => {
  const ctx = buildContext(null);
  assert.ok(ctx.includes('Skill aracıyla'));
  assert.ok(ctx.includes('dosya düzenlenmeden önce'));
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

const NOTICE = '[SYSTEM NOTIFICATION - NOT USER INPUT]\nThis is an automated event.\n<task-notification> @opus auth katmanını düzelt</task-notification>';

test('text inside a system notification is not an override', () => {
  assert.strictEqual(detectOverride(NOTICE), null);
});

test('tags inside machine-generated blocks are ignored', () => {
  assert.strictEqual(detectOverride('<task-notification> @opus x</task-notification>'), null);
  assert.strictEqual(detectOverride('<system-reminder> @fable x</system-reminder>'), null);
  assert.strictEqual(detectOverride('<local-command-stdout> @opus</local-command-stdout>'), null);
  assert.strictEqual(detectOverride('<pasted_content id="a1"> @opus</pasted_content>'), null);
});

test('a tag the user types next to a generated block still counts', () => {
  assert.strictEqual(
    detectOverride('<task-notification> @opus</task-notification>\n@haiku rengi değiştir'),
    'haiku'
  );
});

test('isSystemPrompt flags notifications but not normal prompts', () => {
  assert.strictEqual(isSystemPrompt(NOTICE), true);
  assert.strictEqual(isSystemPrompt('  [system notification - not user input] x'), true);
  assert.strictEqual(isSystemPrompt('@opus şunu yap'), false);
  assert.strictEqual(isSystemPrompt(undefined), false);
});

test('run adds no context for a system notification', () => {
  assert.strictEqual(run(JSON.stringify({ prompt: NOTICE })), '');
});
