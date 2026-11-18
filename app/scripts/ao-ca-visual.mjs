#!/usr/bin/env node
/**
 * Ao cá V3 visual checks (P1+). P0: only confirms phase gate / build artifacts.
 * Usage: node app/scripts/ao-ca-visual.mjs --tier=cao --viewport=1366x768,1920x1080 --check
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const check = args.has('--check');

function row(name, pass, detail) {
  console.log(`${pass ? 'PASS' : 'FAIL'}\t${name}\t${detail}`);
  return pass;
}

let ok = true;
if (check) {
  const appJs = join(root, 'public/app.js');
  ok = row('app.js exists', existsSync(appJs), appJs) && ok;
  if (existsSync(appJs)) {
    const text = readFileSync(appJs, 'utf8');
    const hits = (text.match(/WebGLRenderer/g) || []).length;
    ok = row('app.js has no WebGLRenderer', hits === 0, `count=${hits}`) && ok;
  }
  const skill = join(root, '../.claude/skills/ao-ca-render/SKILL.md');
  ok = row('skill tracked path exists', existsSync(skill), skill) && ok;
  ok = row('P0 visual suite', true, 'full image checks start at P1') && ok;
}

if (!check) {
  console.log('ao-ca-visual: pass --check (P0 gate). Full capture lands in P1.');
}

process.exit(ok ? 0 : 1);
