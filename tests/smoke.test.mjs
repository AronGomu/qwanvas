import {
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
} from './helpers.mjs';

test('smoke: app, service worker, and Node scripts parse', () => {
  for (const path of ['dist/app.js', 'sw.js', 'vite.config.mjs', 'scripts/client.js', 'scripts/generate.mjs', 'scripts/watch.mjs']) {
    const check = spawnSync(process.execPath, ['--check', join(root, path)], { cwd: root, encoding: 'utf8' });
    assert.equal(check.status, 0, check.stderr || check.stdout);
  }
});
