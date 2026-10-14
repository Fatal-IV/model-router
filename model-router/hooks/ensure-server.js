'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { dataDir } = require('../dashboard/store.js');

function isRunning(env = process.env) {
  return new Promise((resolve) => {
    let info;
    try {
      info = JSON.parse(fs.readFileSync(path.join(dataDir(env), 'server.json'), 'utf8'));
      process.kill(info.pid, 0);
    } catch {
      return resolve(false);
    }
    const req = http.get(
      { host: '127.0.0.1', port: info.port, path: '/api/projects', timeout: 1000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200);
      }
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(false));
  });
}

async function main() {
  try {
    if (await isRunning()) return;
    const child = spawn(process.execPath, [path.join(__dirname, '..', 'dashboard', 'server.js')], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
  } catch {
    /* panel başlamazsa oturum etkilenmez */
  }
}

module.exports = { isRunning };

if (require.main === module) {
  main().finally(() => process.exit(0));
}
