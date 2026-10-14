'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { status, enable, disable, settingsPath } = require('./autoupdate.js');

const tmp = () => ({ CLAUDE_CONFIG_DIR: fs.mkdtempSync(path.join(os.tmpdir(), 'mr-au-')) });
const read = (env) => JSON.parse(fs.readFileSync(settingsPath(env), 'utf8'));

test('status is off when no settings file exists', () => {
  assert.strictEqual(status(tmp()), false);
});

test('enable creates the entry and keeps unrelated settings', () => {
  const env = tmp();
  fs.writeFileSync(settingsPath(env), JSON.stringify({ theme: 'dark', extraKnownMarketplaces: { other: { autoUpdate: false } } }));
  enable(env);
  const s = read(env);
  assert.strictEqual(s.theme, 'dark');
  assert.deepStrictEqual(s.extraKnownMarketplaces.other, { autoUpdate: false });
  assert.strictEqual(s.extraKnownMarketplaces['ik-software-plugins'].autoUpdate, true);
  assert.strictEqual(s.extraKnownMarketplaces['ik-software-plugins'].source.repo, 'Fatal-IV/model-router');
  assert.strictEqual(status(env), true);
});

test('enable backs up an existing settings file', () => {
  const env = tmp();
  fs.writeFileSync(settingsPath(env), '{"a":1}');
  enable(env);
  assert.strictEqual(fs.readFileSync(settingsPath(env) + '.bak', 'utf8'), '{"a":1}');
});

test('disable removes only our entry', () => {
  const env = tmp();
  enable(env);
  disable(env);
  assert.strictEqual(status(env), false);
  assert.ok(!('ik-software-plugins' in (read(env).extraKnownMarketplaces || {})));
});

test('a corrupt settings file is left untouched', () => {
  const env = tmp();
  fs.writeFileSync(settingsPath(env), '{bozuk');
  assert.throws(() => enable(env));
  assert.strictEqual(fs.readFileSync(settingsPath(env), 'utf8'), '{bozuk');
});
