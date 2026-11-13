/**
 * Probe doi that khi server da co (HNG_CONCURRENT_URL).
 * Dang nhap HTTP + WebSocket cmd theo plan §5.2.
 */
import WebSocket from 'ws';
import { randomUUID } from 'node:crypto';
import https from 'node:https';
import http from 'node:http';

export type LiveReport = {
  logins: number;
  votes: number;
  spinResultIndex: number | null;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  errors: string[];
};

function pctile(xs: number[], p: number): number {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

type Ack = { t: 'ack'; opId: string; ok: boolean; result?: unknown; error?: string };

function requestJson(
  url: string,
  opts: { method: string; headers: Record<string, string>; body?: string; insecure?: boolean },
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === 'https:' ? https : http;
    const req = lib.request(
      {
        protocol: u.protocol,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        method: opts.method,
        headers: opts.headers,
        rejectUnauthorized: opts.insecure ? false : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () =>
          resolve({
            status: res.statusCode ?? 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString('utf8'),
          }),
        );
      },
    );
    req.on('error', reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

async function login(base: string, username: string, pin: string, insecure: boolean): Promise<string> {
  const body = JSON.stringify({ username, pin });
  const res = await requestJson(`${base}/api/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      Origin: base,
      'X-HNG': '1',
      'content-length': String(Buffer.byteLength(body)),
    },
    body,
    insecure,
  });
  if (res.status < 200 || res.status >= 300) throw new Error(`login ${username} HTTP ${res.status}`);
  const raw = res.headers['set-cookie'];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  for (const c of list) {
    const m = c.match(/hng_sid=[^;]+/);
    if (m) return m[0];
  }
  throw new Error(`login ${username}: no hng_sid cookie`);
}

class LiveWs {
  latencies: number[] = [];
  private ws!: WebSocket;
  private pending = new Map<string, { resolve: (a: Ack) => void; reject: (e: Error) => void }>();

  constructor(
    private url: string,
    private cookie: string,
    private origin: string,
    private insecure: boolean,
  ) {}

  async connect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      this.ws = new WebSocket(this.url, {
        headers: { Cookie: this.cookie, Origin: this.origin },
        rejectUnauthorized: !this.insecure,
      });
      this.ws.once('open', () => resolve());
      this.ws.once('error', reject);
      this.ws.on('message', (raw) => {
        const msg = JSON.parse(String(raw)) as Ack & { t: string };
        if (msg.t === 'ack' && this.pending.has(msg.opId)) {
          this.pending.get(msg.opId)!.resolve(msg);
          this.pending.delete(msg.opId);
        }
      });
    });
    this.ws.send(JSON.stringify({ t: 'hello', subs: ['table:current', 'shops', 'wheels', 'members'] }));
  }

  cmd(name: string, args: Record<string, unknown>, opId = randomUUID()): Promise<Ack> {
    const t0 = performance.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout ${name}`)), 10000);
      this.pending.set(opId, {
        resolve: (a) => {
          clearTimeout(timer);
          this.latencies.push(performance.now() - t0);
          resolve(a);
        },
        reject,
      });
      this.ws.send(JSON.stringify({ t: 'cmd', opId, name, args }));
    });
  }

  close() {
    try {
      this.ws.close();
    } catch {
      /* ignore */
    }
  }
}

export async function probeLiveConcurrent(baseUrl: string, n: number): Promise<LiveReport> {
  const errors: string[] = [];
  const insecure = process.env.HNG_CONCURRENT_INSECURE === '1' || /localhost|127\.0\.0\.1/.test(baseUrl);
  const base = baseUrl.replace(/\/$/, '');
  const wsUrl = base.replace(/^http/, 'ws') + '/ws';

  const cookies: string[] = [];
  for (let i = 1; i <= n; i++) {
    const username = process.env[`HNG_U${i}`] ?? `u${String(i).padStart(2, '0')}`;
    const pin = process.env[`HNG_P${i}`] ?? String(100000 + i).slice(0, 6);
    try {
      cookies.push(await login(base, username, pin, insecure));
    } catch (e) {
      errors.push(String(e));
    }
  }

  const sockets: LiveWs[] = [];
  const latencies: number[] = [];
  let spinResultIndex: number | null = null;
  let votes = 0;

  try {
    for (const cookie of cookies) {
      const s = new LiveWs(wsUrl, cookie, base, insecure);
      await s.connect();
      sockets.push(s);
    }

    if (!sockets.length) {
      return { logins: 0, votes: 0, spinResultIndex: null, p50Ms: 0, p95Ms: 0, maxMs: 0, errors };
    }

    const host = sockets[0]!;
    const runTag = randomUUID().slice(0, 8);
    const shopAcks = [];
    for (let i = 0; i < 3; i++) {
      shopAcks.push(await host.cmd('shop.upsert', { name: `Live Quan ${i} ${runTag}` }));
    }
    for (const a of shopAcks) {
      if (!a.ok) errors.push(`shop.upsert: ${a.error || 'fail'}`);
    }
    const shopIds = shopAcks.filter((a) => a.ok).map((a) => (a.result as { id: string }).id);
    if (shopIds.length < 2) errors.push('shop.upsert failed');

    if (shopIds.length >= 2) {
      const created = await host.cmd('table.create', { shopIds });
      if (!created.ok) errors.push(`table.create: ${created.error || 'fail'}`);

      const voteAcks = await Promise.all(
        sockets.map((s, i) => s.cmd('vote.set', { shopId: shopIds[i % shopIds.length]! })),
      );
      votes = voteAcks.filter((a) => a.ok).length;

      const w = await host.cmd('wheel.create', { title: `Live wheel ${runTag}` });
      if (w.ok) {
        const wheelId = (w.result as { id: string }).id;
        await host.cmd('wheel.item.add', { wheelId, name: 'A', weight: 10 });
        await host.cmd('wheel.item.add', { wheelId, name: 'B', weight: 10 });
        const spin = await host.cmd('wheel.spin', { wheelId });
        if (spin.ok) spinResultIndex = (spin.result as { resultIndex: number }).resultIndex;
        else errors.push(`spin: ${spin.error}`);
      } else {
        errors.push(`wheel.create: ${w.error || 'fail'}`);
      }

      const opId = randomUUID();
      const first = await host.cmd('vote.set', { shopId: shopIds[0]! }, opId);
      const second = await host.cmd('vote.set', { shopId: shopIds[1]! }, opId);
      if (JSON.stringify(first) !== JSON.stringify(second)) errors.push('opId not idempotent');
    }

    for (const s of sockets) latencies.push(...s.latencies);
  } catch (e) {
    errors.push(String(e));
  } finally {
    for (const s of sockets) s.close();
  }

  return {
    logins: cookies.length,
    votes,
    spinResultIndex,
    p50Ms: +pctile(latencies, 50).toFixed(2),
    p95Ms: +pctile(latencies, 95).toFixed(2),
    maxMs: +Math.max(0, ...latencies).toFixed(2),
    errors,
  };
}
