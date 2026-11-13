import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { config } from './config.ts';
import { openDb } from './db.ts';
import { seedIfEmpty, printSeedPins } from './seed.ts';
import { createHttpHandler } from './http.ts';
import { attachWs } from './ws.ts';
import { createAiQueue } from './ai/queue.ts';
import { backupDb } from './backup.ts';

function ensureDataDir() {
  const dir = dirname(config.dbPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function createServer(handler: ReturnType<typeof createHttpHandler>) {
  if (config.devHttp) {
    return createHttpServer(handler);
  }
  if (config.tlsPfx && existsSync(config.tlsPfx)) {
    return createHttpsServer(
      {
        pfx: readFileSync(config.tlsPfx),
        passphrase: config.tlsPfxPass || undefined,
      },
      handler,
    );
  }
  if (!existsSync(config.tlsCert) || !existsSync(config.tlsKey)) {
    console.warn(
      `Thiếu TLS cert/key (${config.tlsCert}). Đặt HNG_DEV_HTTP=1 để chạy HTTP localhost, hoặc tạo cert.`,
    );
    console.warn('Tạm chạy HTTP vì thiếu cert.');
    return createHttpServer(handler);
  }
  return createHttpsServer(
    {
      cert: readFileSync(config.tlsCert),
      key: readFileSync(config.tlsKey),
    },
    handler,
  );
}

export function startServer(opts?: { dbPath?: string; port?: number; listen?: boolean }) {
  ensureDataDir();
  const dbPath = opts?.dbPath ?? config.dbPath;
  const port = opts?.port ?? config.port;
  const db = openDb(dbPath);

  const pins = seedIfEmpty(db);
  if (pins) printSeedPins(pins);

  const ai = createAiQueue();
  const httpHandler = createHttpHandler({ db, ai });
  const server = createServer(httpHandler);
  const hub = attachWs(server, db);
  ai.setNotify((memberId, msg) => hub.sendToMember(memberId, msg));

  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }
    hub.handleUpgrade(req, socket, head);
  });

  if (opts?.listen === false) {
    return { server, db, hub, ai, port };
  }

  void backupDb(db)
    .then((dest) => console.log(`Startup backup → ${dest}`))
    .catch((e) => console.warn('Backup failed', e));

  server.listen(port, () => {
    const hasTls =
      (config.tlsPfx && existsSync(config.tlsPfx)) ||
      (existsSync(config.tlsCert) && existsSync(config.tlsKey));
    const proto = config.devHttp || !hasTls ? 'http' : 'https';
    console.log(`HNG server ${proto}://localhost:${port}  origin=${config.origin}`);
    console.log(`DB ${dbPath}  AI=${ai.enabled() ? config.aiProvider : 'disabled'}`);
  });

  return { server, db, hub, ai, port };
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith('index.ts') || process.argv[1].endsWith('index.js'));

if (isMain) {
  startServer();
}
