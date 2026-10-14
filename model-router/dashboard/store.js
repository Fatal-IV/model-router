'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function dataDir(env = process.env) {
  return (env && env.MODEL_ROUTER_DIR) || path.join(os.homedir(), '.claude', 'model-router');
}

const file = (env) => path.join(dataDir(env), 'events.jsonl');

function appendEvent(ev, env = process.env) {
  try {
    fs.mkdirSync(dataDir(env), { recursive: true });
    fs.appendFileSync(file(env), JSON.stringify(ev) + '\n');
  } catch {
    /* kayıt hatası isteği etkilememeli */
  }
}

function readEvents(env = process.env) {
  let text;
  try {
    text = fs.readFileSync(file(env), 'utf8');
  } catch {
    return [];
  }
  const byId = new Map();
  for (const line of text.split('\n')) {
    if (!line) continue;
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      continue;
    }
    if (!rec || typeof rec.id !== 'string') continue;
    if (rec.type === 'start') {
      byId.set(rec.id, { ...rec, status: 'running' });
    } else if (rec.type === 'end' && byId.has(rec.id)) {
      const cur = byId.get(rec.id);
      cur.status = rec.status;
      cur.durationMs = rec.durationMs;
    }
  }
  return [...byId.values()];
}

function listProjects(events) {
  const map = new Map();
  for (const e of events) {
    const p = map.get(e.project) || { project: e.project, count: 0, last: 0 };
    p.count += 1;
    p.last = Math.max(p.last, e.ts);
    map.set(e.project, p);
  }
  return [...map.values()].sort((a, b) => b.last - a.last);
}

function clearEvents(env = process.env) {
  try {
    fs.rmSync(file(env), { force: true });
  } catch {
    /* yok say */
  }
}

module.exports = { dataDir, appendEvent, readEvents, listProjects, clearEvents };
