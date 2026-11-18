import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, resolve, sep } from 'node:path';

export const appDir = new URL('../../', import.meta.url);
export const output = new URL('test-results/ao-ca/', appDir);
const root = fileURLToPath(new URL('public/', appDir));
const types = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.png':'image/png',
  '.svg':'image/svg+xml', '.woff2':'font/woff2', '.json':'application/json' };

export async function serveApp() {
  const server = createServer(async (req, res) => {
    try {
      const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
      if (!file.startsWith(resolve(root) + sep)) { res.writeHead(404).end(); return; }
      const body = await readFile(file);
      res.setHeader('Content-Type', types[extname(file)] ?? 'application/octet-stream');
      res.end(body);
    } catch {
      res.writeHead(404).end();
    }
  });
  await new Promise((done, fail) => server.once('error', fail).listen(0, '127.0.0.1', done));
  const base = 'http://127.0.0.1:' + server.address().port;
  return {base, close: () => new Promise(done => server.close(done))};
}

export async function loginMock(page, base, route = '#/chat') {
  await page.addInitScript(() => { window.__HNG_LIVE__ = false; });
  await page.goto(base);
  if (await page.locator('#login-user').isVisible()) {
    await page.locator('#login-user').fill('minh');
    await page.locator('#login-pin').fill('123456'); // mock only
    await page.locator('#login-go').click();
    await page.waitForURL(/#\/(?!login)/);
  }
  await page.goto(base + '/' + route);
  await page.locator('[data-fish-tank]').waitFor();
}
