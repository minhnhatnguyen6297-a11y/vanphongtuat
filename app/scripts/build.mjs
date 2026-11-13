import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'public');
const distServer = join(root, 'dist/server');
const resolve = createRequire(import.meta.url).resolve;

mkdirSync(outdir, { recursive: true });
mkdirSync(join(outdir, 'fonts'), { recursive: true });
mkdirSync(distServer, { recursive: true });

// Server bundle (Node)
await esbuild.build({
  entryPoints: [
    join(root, 'src/server/index.ts'),
    join(root, 'src/server/admin-cli.ts'),
    join(root, 'src/server/seed.ts'),
  ],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: ['node20'],
  outdir: join(root, 'dist/server'),
  packages: 'external',
  sourcemap: true,
  logLevel: 'info',
});

// Client bundle (optional until frontend lands)
const clientMain = join(root, 'src/client/main.ts');
if (existsSync(clientMain)) {
  await esbuild.build({
    entryPoints: [clientMain],
    bundle: true,
    outfile: join(outdir, 'app.js'),
    format: 'esm',
    platform: 'browser',
    target: ['es2022'],
    sourcemap: true,
    logLevel: 'info',
  });
  const css = join(root, 'src/client/styles.css');
  if (existsSync(css)) {
    const fonts = [
      ['bungee', ['vietnamese', 'latin'], [400]],
      ['be-vietnam-pro', ['vietnamese', 'latin'], [400, 500, 700, 800]],
      ['jetbrains-mono', ['latin'], [400, 700]],
    ];
    for (const [family, subsets, weights] of fonts) {
      const packageDir = dirname(resolve(`@fontsource/${family}/package.json`));
      for (const subset of subsets) {
        for (const weight of weights) {
          const name = `${family}-${subset}-${weight}`;
          cpSync(join(packageDir, 'files', `${name}-normal.woff2`), join(outdir, 'fonts', `${name}.woff2`));
        }
      }
    }
    cpSync(css, join(outdir, 'styles.css'));
  }
  console.log('client bundle → public/app.js');
} else {
  console.warn('src/client/main.ts missing — skip client bundle');
}

console.log('server bundle → dist/server/');
