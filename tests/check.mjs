#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const tsc = join(root, 'node_modules/typescript/bin/tsc');
const vite = join(root, 'node_modules/vite/bin/vite.js');
const vitest = join(root, 'node_modules/vitest/vitest.mjs');

for (const [command, args] of [
  [tsc, ['-p', 'tsconfig.json', '--noEmit']],
  [vite, ['build']],
  [vitest, ['run']],
]) {
  const run = spawnSync(process.execPath, [command, ...args], { cwd: root, stdio: 'inherit' });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
