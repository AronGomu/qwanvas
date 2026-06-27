import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { test } from 'vitest';
import { parseSpec } from '../scripts/generate.mjs';

const root = resolve(import.meta.dirname, '..');

const APP_SOURCE_FILES = [
  'src/app/00-types.ts',
  'src/app/01-state.ts',
  'src/app/02-wire-commands.ts',
  'src/app/03-command-palette.ts',
  'src/app/04-render-inspector.ts',
  'src/app/05-interactions.ts',
  'src/app/06-project-model.ts',
  'src/app/07-import-export.ts',
  'src/app/08-storage-utils.ts',
];

const file = (path) => readFileSync(join(root, path), 'utf8');
const appSource = () => APP_SOURCE_FILES.map(file).join('\n');

export {
  appSource,
  assert,
  existsSync,
  file,
  join,
  mkdirSync,
  mkdtempSync,
  parseSpec,
  readFileSync,
  rmSync,
  root,
  spawnSync,
  test,
  tmpdir,
  writeFileSync,
};
