import * as esbuild from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outdir = join(root, 'public');
const distServer = join(root, 'dist/server');
const fontsOut = join(outdir, 'fonts');

mkdirSync(outdir, { recursive: true });
mkdirSync(fontsOut, { recursive: true });
mkdirSync(distServer, { recursive: true });

/** CSS expects `/fonts/<name>.woff2`; @fontsource files end with `-normal.woff2`. */
const FONT_COPIES = [
  ['@fontsource/bungee/files/bungee-vietnamese-400-normal.woff2', 'bungee-vietnamese-400.woff2'],
  ['@fontsource/bungee/files/bungee-latin-400-normal.woff2', 'bungee-latin-400.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-400-normal.woff2', 'be-vietnam-pro-vietnamese-400.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-400-normal.woff2', 'be-vietnam-pro-latin-400.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-500-normal.woff2', 'be-vietnam-pro-vietnamese-500.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-500-normal.woff2', 'be-vietnam-pro-latin-500.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-700-normal.woff2', 'be-vietnam-pro-vietnamese-700.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-700-normal.woff2', 'be-vietnam-pro-latin-700.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-vietnamese-800-normal.woff2', 'be-vietnam-pro-vietnamese-800.woff2'],
  ['@fontsource/be-vietnam-pro/files/be-vietnam-pro-latin-800-normal.woff2', 'be-vietnam-pro-latin-800.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2', 'jetbrains-mono-latin-400.woff2'],
  ['@fontsource/jetbrains-mono/files/jetbrains-mono-latin-700-normal.woff2', 'jetbrains-mono-latin-700.woff2'],
];

let fontsCopied = 0;
for (const [srcRel, destName] of FONT_COPIES) {
  const src = join(root, 'node_modules', srcRel);
  if (!existsSync(src)) {
    console.warn('font missing:', srcRel);
    continue;
  }
  cpSync(src, join(fontsOut, destName));
  fontsCopied++;
}
console.log(`fonts → public/fonts/ (${fontsCopied}/${FONT_COPIES.length})`);

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
  if (existsSync(css)) cpSync(css, join(outdir, 'styles.css'));
  console.log('client bundle → public/app.js');
} else {
  console.warn('src/client/main.ts missing — skip client bundle');
}

console.log('server bundle → dist/server/');
