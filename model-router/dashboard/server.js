'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { dataDir, readEvents, listProjects, clearEvents } = require('./store.js');

const HOST = '127.0.0.1';
const BASE_PORT = 37888;
const PORT_TRIES = 20;

function createServer(env = process.env) {
  const server = http.createServer((req, res) => {
    try {
      handle(req, res);
    } catch {
      try {
        res.writeHead(400);
        res.end();
      } catch {
        /* bağlantı kapanmış */
      }
    }
  });

  function handle(req, res) {
    const port = server.address().port;
    // DNS rebinding'e karşı: tüm rotalar yalnızca kendi adresine gelen istekleri yanıtlar.
    if (![`${HOST}:${port}`, `localhost:${port}`].includes(req.headers.host)) {
      res.writeHead(403);
      return res.end();
    }
    const url = new URL(req.url, 'http://localhost');
    const json = (obj) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(obj));
    };

    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    } else if (req.method === 'GET' && url.pathname === '/api/projects') {
      json(listProjects(readEvents(env)));
    } else if (req.method === 'GET' && url.pathname === '/api/events') {
      const project = url.searchParams.get('project');
      const events = readEvents(env)
        .filter((e) => e.project === project)
        .sort((a, b) => b.ts - a.ts)
        .slice(0, 500);
      json(events);
    } else if (req.method === 'POST' && url.pathname === '/api/clear') {
      const origin = req.headers.origin;
      if (origin && origin !== `http://${req.headers.host}`) {
        res.writeHead(403);
        return res.end();
      }
      clearEvents(env);
      res.writeHead(204);
      res.end();
    } else {
      res.writeHead(404);
      res.end();
    }
  }
  return server;
}

function answers(port) {
  return new Promise((resolve) => {
    const r = http.get({ host: HOST, port, path: '/api/projects', timeout: 1500 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    r.on('timeout', () => r.destroy());
    r.on('error', () => resolve(false));
  });
}

function listenFrom(server, port, left, done) {
  const onError = (err) => {
    server.removeListener('listening', onListening);
    if (err.code !== 'EADDRINUSE' || left <= 0) return process.exit(1);
    // Bu portta zaten bir panel varsa ikinci kopya açılmaz.
    answers(port).then((up) => (up ? process.exit(0) : listenFrom(server, port + 1, left - 1, done)));
  };
  const onListening = () => {
    server.removeListener('error', onError);
    done(server.address().port);
  };
  server.once('error', onError);
  server.once('listening', onListening);
  server.listen(port, HOST);
}

module.exports = { createServer, HOST, BASE_PORT };

if (require.main === module) {
  const server = createServer();
  listenFrom(server, Number(process.env.MODEL_ROUTER_BASE_PORT) || BASE_PORT, PORT_TRIES, (port) => {
    try {
      fs.mkdirSync(dataDir(), { recursive: true });
      fs.writeFileSync(path.join(dataDir(), 'server.json'), JSON.stringify({ pid: process.pid, port }));
    } catch {
      /* port dosyası yazılamazsa sunucu yine çalışır */
    }
  });
}
