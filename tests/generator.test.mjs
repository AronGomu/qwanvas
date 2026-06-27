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

test('parseSpec: frontmatter, yaml, text layout, and canvas elements normalize predictably', () => {
  const deck = parseSpec(`---\ndraft: true\n---\ntitle: "Regression Deck"\n# Fallback Title\n\n## Slide 1\n\n\`\`\`yaml\npage_number: "01 / 02"\ncontent_center_y: "44%"\nblocks_align: left\nblocks_padding_left: "5"\ntitle_x: "50%"\ntitle_y: "20%"\ntitle_width: "70%"\ntitle_height: "12%"\nimage:\n  enabled: true\n  src: assets/pic.png\n  crop_scale: "6"\n  crop_x: "90%"\n\`\`\`\n\n### Title\n\nHello {brand:AI}\n\n### Blocks\n\n- One\n- Two\n\n## Slide 2\n\n\`\`\`yaml\npage_number: "02 / 02"\n\`\`\`\n\n### Elements\n\n\`\`\`json\n[\n  {"id":"wide","type":"text","text":"Hi **there**","x":"1%","y":"99%","width":"120%","height":"1%","zIndex":123,"fontSize":"bad","color":"javascript:bad","bold":true},\n  {"id":"bad-type","type":"unknown","x":"50%","y":"50%"}\n]\n\`\`\`\n`);

  assert.equal(deck.title, 'Regression Deck');
  assert.equal(deck.slides.length, 2);
  assert.equal(deck.slides[0].page, '01 / 02');
  assert.equal(deck.slides[0].centerY, '44%');
  assert.deepEqual(deck.slides[0].blocks, ['One', 'Two']);
  assert.deepEqual(deck.slides[0].text.blocks, { align: 'left', paddingLeft: '5cqw' });
  assert.deepEqual(deck.slides[0].textPositions.title, { x: '50.0%', y: '20.0%', width: '70.0%', height: '12.0%' });
  assert.equal(deck.slides[0].image.cropScale, '4.00');
  assert.equal(deck.slides[0].image.cropX, '37.5%');

  const [wide, fallback] = deck.slides[1].elements;
  assert.equal(wide.id, 'wide');
  assert.equal(wide.type, 'text');
  assert.equal(wide.x, '47.5%');
  assert.equal(wide.y, '98.0%');
  assert.equal(wide.width, '95.0%');
  assert.equal(wide.height, '4.0%');
  assert.equal(wide.zIndex, 99);
  assert.equal(wide.fontSize, '0');
  assert.equal(wide.color, 'var(--text)');
  assert.equal(fallback.type, 'text');
});

test('generate: temporary legacy fixture renders the expected carousel features', () => {
  const relativeProject = `projects/__legacy-check-${process.pid}`;
  const projectDir = join(root, relativeProject);
  rmSync(projectDir, { recursive: true, force: true });
  mkdirSync(projectDir, { recursive: true });
  try {
    writeFileSync(join(projectDir, 'spec.md'), `title: "package.json"\n# package.json\n\n## Slide 1\n\n\`\`\`yaml\npage_number: "01 / 02"\nimage:\n  enabled: true\n  src: "C:/Users/Natha/brain/3_ressources/assets/png/memes/pepe-the-frog/magnifying_king_apu.png"\n\`\`\`\n\n### Title\n\n{brand:package.json}\n\n## Slide 2\n\n\`\`\`yaml\npage_number: "02 / 02"\nblocks_align: left\nblocks_padding_left: "5cqw"\n\`\`\`\n\n### Blocks\n\n- package.json\n`, 'utf8');
    const run = spawnSync(process.execPath, [join(root, 'scripts/generate.mjs'), relativeProject, '--no-pdf'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const html = readFileSync(join(projectDir, 'index.html'), 'utf8');
    assert.equal((html.match(/class="slide/g) || []).length, 2);
    assert.match(html, /package\.json/);
    assert.match(html, /<span class="text-brand">package\.json<\/span>/);
    assert.match(html, /<ul class="editable-text" data-kind="blocks" data-slide="2" style="text-align:left;padding-left:5cqw">/);
    assert.match(html, /\/__save-layout/);
    assert.doesNotMatch(html, /Edit images/);
    assert.doesNotMatch(html, /src="[A-Za-z]:\\/, 'raw Windows asset path leaked into generated HTML');
    assert.match(html, /file:\/\/\/C:\/Users\/Natha\/brain\/3_ressources\/assets\/png\/memes\/pepe-the-frog\/magnifying_king_apu\.png/);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
  }
});

test('generate: temporary canvas elements render escaped editable HTML without PDF', () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'qwanvas-'));
  const relativeProject = `projects/__check-${process.pid}`;
  const projectDir = join(root, relativeProject);
  rmSync(projectDir, { recursive: true, force: true });
  mkdirSync(projectDir, { recursive: true });
  try {
    writeFileSync(join(projectDir, 'spec.md'), `# Canvas test\n\n## Slide 1\n\n\`\`\`yaml\nslide: 1\npage_number: "01 / 01"\n\`\`\`\n\n### Elements\n\n\`\`\`json\n[\n  {"id":"t1","type":"text","text":"Hello **AI** <script>","x":"50%","y":"30%","width":"70%","height":"12%","zIndex":4,"fontSize":"40px","color":"#5aa7ff","bold":true},\n  {"id":"c1","type":"code","lang":"json","text":"{\\n  \\\"ok\\\": true\\n}","x":"50%","y":"55%","width":"70%","height":"22%","zIndex":5},\n  {"id":"i1","type":"image","src":"data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==","x":"50%","y":"80%","width":"30%","height":"15%","zIndex":3}\n]\n\`\`\`\n`, 'utf8');
    const run = spawnSync(process.execPath, [join(root, 'scripts/generate.mjs'), relativeProject, '--no-pdf'], { cwd: root, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const html = readFileSync(join(projectDir, 'index.html'), 'utf8');
    assert.match(html, /data-element-id="t1"/);
    assert.match(html, /data-type="image"/);
    assert.match(html, /<strong>AI<\/strong> &lt;script&gt;/);
    assert.match(html, /class="tok-key">&quot;ok&quot;<\/span>/);
  } finally {
    rmSync(projectDir, { recursive: true, force: true });
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
