'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const NAME = 'ik-software-plugins';
const ENTRY = { source: { source: 'github', repo: 'Fatal-IV/model-router' }, autoUpdate: true };

function settingsPath(env = process.env) {
  return path.join((env && env.CLAUDE_CONFIG_DIR) || path.join(os.homedir(), '.claude'), 'settings.json');
}

function load(env) {
  try {
    return JSON.parse(fs.readFileSync(settingsPath(env), 'utf8'));
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    throw e;
  }
}

function status(env = process.env) {
  try {
    const s = load(env);
    return !!(s && s.extraKnownMarketplaces && s.extraKnownMarketplaces[NAME] && s.extraKnownMarketplaces[NAME].autoUpdate === true);
  } catch {
    return false;
  }
}

function save(env, s) {
  const p = settingsPath(env);
  if (fs.existsSync(p)) fs.copyFileSync(p, p + '.bak');
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
}

function enable(env = process.env) {
  const s = load(env) || {};
  s.extraKnownMarketplaces = { ...(s.extraKnownMarketplaces || {}), [NAME]: ENTRY };
  save(env, s);
}

function disable(env = process.env) {
  const s = load(env);
  if (!s || !s.extraKnownMarketplaces || !(NAME in s.extraKnownMarketplaces)) return;
  delete s.extraKnownMarketplaces[NAME];
  save(env, s);
}

module.exports = { status, enable, disable, settingsPath };

if (require.main === module) {
  const arg = String(process.argv[2] || 'status').trim().toLowerCase();
  try {
    if (arg === 'on') {
      enable();
      console.log('Otomatik güncelleme açıldı. Yeni sürümler oturum içinde kendiliğinden indirilir; uygulamak için /reload-plugins yeterli.\nAyar dosyan: ' + settingsPath() + ' (yedek: settings.json.bak). Kapatmak için: /model-router:auto-update off');
    } else if (arg === 'off') {
      disable();
      console.log('Otomatik güncelleme kapatıldı.');
    } else {
      console.log(status() ? 'Otomatik güncelleme: açık. Kapatmak için: /model-router:auto-update off' : 'Otomatik güncelleme: kapalı.\nAçmak için: /model-router:auto-update on\n(Bu komut ayar dosyana yalnızca ik-software-plugins için bir autoUpdate girdisi ekler.)');
    }
  } catch {
    console.log('Ayar dosyası okunamadı veya yazılamadı; hiçbir şey değiştirilmedi. Elle açmak için /plugin > Marketplaces > Enable auto-update.');
  }
}
