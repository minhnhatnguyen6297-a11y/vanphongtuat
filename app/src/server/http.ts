import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, normalize } from 'node:path';
import type { Db } from './db.ts';
import {
  checkOriginAndCsrf,
  clientIp,
  clearSessionCookie,
  getSessionId,
  login,
  memberFromSession,
  publicMember,
  registerMember,
  revokeSession,
  setSessionCookie,
} from './auth.ts';
import { APP_ROOT } from './config.ts';
import type { AiQueue } from './ai/queue.ts';
import type { AiKind } from './ai/provider.ts';
import { acceptShopSuggestion } from '../shared/shop-suggest.ts';

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.map': 'application/json',
  '.ico': 'image/x-icon',
};

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buf.length;
    if (size > limit) throw Object.assign(new Error('too_large'), { code: 'too_large' });
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

function json(res: ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
  });
  res.end(data);
}

function detectImageMime(buf: Buffer, header: string | undefined): string | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  )
    return 'image/png';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  if (header && /image\/(jpeg|png|webp)/.test(header)) return header.split(';')[0].trim();
  return null;
}

function shopSources(db: Db): { name: string; type: string }[] {
  return db.prepare(`SELECT name, type FROM shops ORDER BY name LIMIT 80`).all() as {
    name: string;
    type: string;
  }[];
}

/** Tên quán chỉ sống nếu có trong kho hoặc trong chữ người dùng. Không giữ địa chỉ. */
function sanitizeShop(db: Db, raw: unknown, note: string) {
  const obj =
    raw && typeof raw === 'object'
      ? (raw as { name?: string | null; type?: string | null; phone?: string | null })
      : {};
  const accepted = acceptShopSuggestion(obj, shopSources(db), note);
  const phoneRaw = String(obj.phone || '').trim();
  const digits = phoneRaw.replace(/\s/g, '');
  const phone = digits && note.replace(/\s/g, '').includes(digits) ? phoneRaw.slice(0, 40) : null;
  return { name: accepted.name, type: accepted.type, phone, uncertain: accepted.uncertain };
}

function memberBody(db: Db, id: string) {
  const pub = publicMember(db, id)!;
  return {
    ...pub,
    isOperator: !!pub.isOperator,
    disabled: !!pub.disabled,
  };
}

function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const url = new URL(req.url || '/', 'http://localhost');
  let path = decodeURIComponent(url.pathname);
  if (path === '/') path = '/index.html';
  if (path.includes('..')) {
    res.writeHead(400);
    res.end();
    return true;
  }
  const filePath = normalize(join(APP_ROOT, 'public', path.replace(/^\//, '')));
  const publicRoot = normalize(join(APP_ROOT, 'public'));
  if (!filePath.startsWith(publicRoot)) {
    res.writeHead(403);
    res.end();
    return true;
  }
  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    // SPA fallback
    const index = join(publicRoot, 'index.html');
    if (existsSync(index) && !extname(path)) {
      const html = readFileSync(index);
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(html);
      return true;
    }
    return false;
  }
  const ext = extname(filePath).toLowerCase();
  const mime = MIME[ext] || 'application/octet-stream';
  const buf = readFileSync(filePath);
  res.writeHead(200, { 'content-type': mime, 'content-length': buf.length });
  if (req.method === 'HEAD') res.end();
  else res.end(buf);
  return true;
}

export type HttpDeps = {
  db: Db;
  ai: AiQueue;
};

export function createHttpHandler(deps: HttpDeps) {
  const { db, ai } = deps;

  return async function handler(req: IncomingMessage, res: ServerResponse) {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      const path = url.pathname;

      if (path === '/api/login' && req.method === 'POST') {
        if (!checkOriginAndCsrf(req)) return json(res, 403, { error: 'csrf' });
        const raw = await readBody(req, 64_000);
        let body: { username?: string; pin?: string };
        try {
          body = JSON.parse(raw.toString('utf8'));
        } catch {
          return json(res, 400, { error: 'bad_json' });
        }
        const result = login(db, String(body.username || ''), String(body.pin || ''), clientIp(req));
        if (!result.ok) {
          const status = result.error === 'locked' || result.error === 'rate_limited' ? 429 : 401;
          return json(res, status, {
            error: result.error,
            retryAfterMin: result.retryAfterMin,
          });
        }
        setSessionCookie(res, result.sessionId);
        return json(res, 200, { member: memberBody(db, result.member.id) });
      }

      if (path === '/api/register' && req.method === 'POST') {
        if (!checkOriginAndCsrf(req)) return json(res, 403, { error: 'csrf' });
        const raw = await readBody(req, 64_000);
        let body: { username?: string; displayName?: string; pin?: string };
        try {
          body = JSON.parse(raw.toString('utf8'));
        } catch {
          return json(res, 400, { error: 'bad_json' });
        }
        const result = registerMember(
          db,
          String(body.username || ''),
          String(body.displayName || ''),
          String(body.pin || ''),
          clientIp(req),
        );
        if (!result.ok) {
          const status = result.error === 'rate_limited' ? 429 : result.error === 'username_taken' ? 409 : 400;
          return json(res, status, { error: result.error, retryAfterMin: result.retryAfterMin });
        }
        setSessionCookie(res, result.sessionId);
        return json(res, 200, { member: memberBody(db, result.member.id) });
      }

      if (path === '/api/logout' && req.method === 'POST') {
        if (!checkOriginAndCsrf(req)) return json(res, 403, { error: 'csrf' });
        const sid = getSessionId(req);
        if (sid) revokeSession(db, sid);
        clearSessionCookie(res);
        return json(res, 200, { ok: true });
      }

      if (path === '/api/me' && req.method === 'GET') {
        const member = memberFromSession(db, getSessionId(req));
        if (!member) return json(res, 401, { error: 'unauthorized' });
        return json(res, 200, { member: memberBody(db, member.id) });
      }

      // Danh sách đăng nhập công khai (username + displayName, không PIN/hash).
      if (path === '/api/roster' && req.method === 'GET') {
        const rows = db
          .prepare(
            `SELECT username, display_name AS displayName
             FROM members WHERE disabled = 0
             ORDER BY display_name COLLATE NOCASE`,
          )
          .all() as { username: string; displayName: string }[];
        return json(res, 200, rows);
      }

      const aiMatch = path.match(/^\/api\/ai\/(bill|menu|shop)$/);
      if (aiMatch && req.method === 'POST') {
        if (!checkOriginAndCsrf(req)) return json(res, 403, { error: 'csrf' });
        const member = memberFromSession(db, getSessionId(req));
        if (!member) return json(res, 401, { error: 'unauthorized' });
        if (!ai.enabled()) return json(res, 503, { error: 'ai_disabled' });

        const kind = aiMatch[1] as AiKind;
        let buf: Buffer;
        try {
          buf = await readBody(req, 2 * 1024 * 1024);
        } catch {
          return json(res, 413, { error: 'too_large' });
        }
        const ctype = String(req.headers['content-type'] || '');
        try {
          if (ctype.includes('application/json')) {
            if (kind === 'menu') return json(res, 400, { error: 'bad_image' });
            let body: { note?: string; text?: string };
            try {
              body = JSON.parse(buf.toString('utf8'));
            } catch {
              return json(res, 400, { error: 'bad_json' });
            }
            const text = String(kind === 'shop' ? body.note || '' : body.text || '').trim();
            if (!text || text.length > 4000) return json(res, 400, { error: 'bad_text' });
            const context =
              kind === 'shop' ? shopSources(db).map((s) => `${s.name} | ${s.type}`).join('\n') : '';
            const after = kind === 'shop' ? (raw: unknown) => sanitizeShop(db, raw, text) : undefined;
            const { jobId } = await ai.enqueueText(db, kind, member.id, text, context, after);
            return json(res, 200, { jobId });
          }
          const mime = detectImageMime(buf, ctype);
          if (!mime) return json(res, 400, { error: 'bad_image' });
          const after = kind === 'shop' ? (raw: unknown) => sanitizeShop(db, raw, '') : undefined;
          const { jobId } = await ai.enqueue(db, kind, member.id, buf, mime, after);
          return json(res, 200, { jobId });
        } catch (e: any) {
          if (e?.code === 'busy') return json(res, 429, { error: 'busy' });
          if (e?.code === 'ai_disabled') return json(res, 503, { error: 'ai_disabled' });
          return json(res, 500, { error: 'ai_error' });
        }
      }

      if (serveStatic(req, res)) return;

      json(res, 404, { error: 'not_found' });
    } catch (e) {
      console.error('http error', e);
      json(res, 500, { error: 'internal' });
    }
  };
}
