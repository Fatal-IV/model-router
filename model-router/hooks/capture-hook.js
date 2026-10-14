'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectOverride } = require('./route-hook.js');
const { dataDir, appendEvent } = require('../dashboard/store.js');

const safe = (s) => String(s || 'x').replace(/[^\w.-]/g, '_');
const pendingFile = (env, sid) => path.join(dataDir(env), `pending-${safe(sid)}.json`);

function handle(event, env = process.env, now = Date.now()) {
  try {
    if (!event || (env && env.CLAUDE_CODE_SUBAGENT_MODEL_FORCE === '1')) return;
    const name = event.hook_event_name;

    if (name === 'UserPromptSubmit' && typeof event.prompt === 'string') {
      fs.mkdirSync(dataDir(env), { recursive: true });
      fs.writeFileSync(
        pendingFile(env, event.session_id),
        JSON.stringify({
          summary: event.prompt.slice(0, 200),
          source: detectOverride(event.prompt) ? 'override' : 'auto',
        })
      );
      return;
    }

    if (event.tool_name !== 'Agent' || typeof event.tool_use_id !== 'string') return;

    if (name === 'PreToolUse') {
      let pending = {};
      try {
        pending = JSON.parse(fs.readFileSync(pendingFile(env, event.session_id), 'utf8'));
      } catch {
        /* özet yok */
      }
      const input = event.tool_input || {};
      const cwd = event.cwd || '';
      appendEvent(
        {
          type: 'start',
          id: event.tool_use_id,
          ts: now,
          project: path.basename(cwd) || 'bilinmiyor',
          cwd,
          summary: pending.summary || '',
          model: input.model || 'inherit',
          source: pending.source || 'auto',
          reason: input.description || '',
        },
        env
      );
    } else if (name === 'PostToolUse') {
      const { readEvents } = require('../dashboard/store.js');
      const start = readEvents(env).find((e) => e.id === event.tool_use_id);
      const resp = event.tool_response;
      const failed = !!(resp && typeof resp === 'object' && (resp.is_error || resp.error));
      appendEvent(
        {
          type: 'end',
          id: event.tool_use_id,
          ts: now,
          status: failed ? 'error' : 'done',
          durationMs: start ? Math.max(0, now - start.ts) : 0,
        },
        env
      );
    }
  } catch {
    /* hook asla isteği engellemez */
  }
}

module.exports = { handle };

if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (c) => (input += c));
  process.stdin.on('end', () => {
    try {
      handle(JSON.parse(input));
    } catch {
      /* yok say */
    }
    process.exit(0);
  });
  process.stdin.on('error', () => process.exit(0));
}
