'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { dataDir } = require('../dashboard/store.js');

const infoFile = (env) => path.join(dataDir(env), 'server.json');

// Çalışan panelin bilgisini (pid, port) döndürür; yoksa null.
function runningInfo(env = process.env) {
  return new Promise((resolve) => {
    let info;
    try {
      info = JSON.parse(fs.readFileSync(infoFile(env), 'utf8'));
      try {
        process.kill(info.pid, 0);
      } catch (e) {
        if (e.code !== 'EPERM') throw e;
      }
    } catch {
      return resolve(null);
    }
    const req = http.get(
      { host: '127.0.0.1', port: info.port, path: '/api/projects', timeout: 2000 },
      (res) => {
        res.resume();
        resolve(res.statusCode === 200 ? info : null);
      }
    );
    req.on('timeout', () => req.destroy());
    req.on('error', () => resolve(null));
  });
}

async function isRunning(env = process.env) {
  return (await runningInfo(env)) !== null;
}

async function waitForPanel(env, ms) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const info = await runningInfo(env);
    if (info) return info;
    await new Promise((r) => setTimeout(r, 100));
  }
  return null;
}

async function main() {
  try {
    let info = await runningInfo();
    if (!info) {
      try {
        fs.rmSync(infoFile(process.env), { force: true }); // eski sunucudan kalan bayat kayıt
      } catch {
        /* yok say */
      }
      const child = spawn(process.execPath, [path.join(__dirname, '..', 'dashboard', 'server.js')], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      });
      child.on('error', () => {});
      child.unref();
      info = await waitForPanel(process.env, 4000);
    }
    if (info) {
      process.stdout.write(
        JSON.stringify({ systemMessage: `Model Router paneli: http://localhost:${info.port}` })
      );
    }
  } catch {
    /* panel başlamazsa oturum etkilenmez */
  }
}

module.exports = { isRunning, runningInfo };

if (require.main === module) {
  main().finally(() => process.exit(0));
}
