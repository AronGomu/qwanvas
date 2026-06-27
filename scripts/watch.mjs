#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFileSync, renameSync, statSync, watch, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { extname, isAbsolute, join, relative, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const project = process.argv[2] || 'projects/package-json';
const projectDir = resolve(root, project);
const vaultRoot = resolve(root, '../..');
const port = Number(process.env.PORT || 5173);
const host = '127.0.0.1';
const saveToken = randomUUID();
const clients = new Set();
let timer;

function build() {
  const child = spawn(process.execPath, [join(root, 'scripts/generate.mjs'), project, '--no-pdf'], { cwd: root, stdio: 'inherit' });
  child.on('exit', (code) => {
    if (code === 0) for (const res of clients) res.write('data: reload\n\n');
  });
}

watch(projectDir, { recursive: true }, (_event, file) => {
  if (!file || !/spec\.md$|\.css$/i.test(file)) return;
  clearTimeout(timer);
  timer = setTimeout(build, 80);
});

createServer(async (req, res) => {
  if (req.url === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (req.method === 'POST' && (req.url === '/__save-layout' || req.url === '/__save-images')) {
    try {
      assertLocalRequest(req);
      assertSaveToken(req);
      const body = JSON.parse(await readBody(req));
      let spec = readFileSync(join(projectDir, 'spec.md'), 'utf8');
      for (const slide of body.slides || []) spec = updateSlideElements(spec, slide);
      for (const image of body.images || []) spec = updateSlideImage(spec, image);
      for (const element of body.elements || []) spec = updateSlideTextElement(spec, element);
      writeSpec(spec);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (req.url?.startsWith('/__asset?')) {
    try {
      assertLocalRequest(req);
      const src = new URL(req.url, `http://${host}:${port}`).searchParams.get('src') || '';
      if (!src.startsWith('file:')) throw new Error('Only file URLs are supported');
      const filePath = resolve(fileURLToPath(src));
      if (!isInside(vaultRoot, filePath)) throw new Error('Asset outside vault root');
      if (!['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg'].includes(extname(filePath).toLowerCase())) throw new Error('Unsupported asset type');
      const body = readFileSync(filePath);
      res.writeHead(200, { 'Content-Type': type(filePath), 'Content-Length': statSync(filePath).size });
      res.end(body);
    } catch {
      notFound(res);
    }
    return;
  }

  if (req.url === '/') {
    res.writeHead(302, { Location: '/index.html?live' });
    res.end();
    return;
  }
  const urlPath = req.url.split('?')[0];
  const filePath = resolve(projectDir, `.${urlPath}`);
  if (!filePath.startsWith(projectDir)) return notFound(res);
  try {
    let body = readFileSync(filePath);
    if (filePath === join(projectDir, 'index.html')) body = Buffer.from(body.toString('utf8').replace('</body>', `<script>window.__CAROUSEL_SAVE_TOKEN__=${JSON.stringify(saveToken)}</script></body>`));
    res.writeHead(200, { 'Content-Type': type(filePath), 'Content-Length': body.length });
    res.end(body);
  } catch {
    notFound(res);
  }
}).listen(port, host, () => {
  build();
  console.log(`watch http://${host}:${port}`);
  console.log(`edit ${join(projectDir, 'spec.md')}`);
});

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = '';
    req.on('data', (chunk) => body += chunk);
    req.on('end', () => resolveBody(body));
    req.on('error', reject);
  });
}

function assertLocalRequest(req) {
  const remote = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) throw new Error('Local requests only');
}

function assertSaveToken(req) {
  if (req.headers['x-carousel-save-token'] !== saveToken) throw new Error('Invalid save token');
}

function writeSpec(spec) {
  const specPath = join(projectDir, 'spec.md');
  const tmpPath = join(projectDir, `.spec.${process.pid}.${Date.now()}.tmp`);
  writeFileSync(tmpPath, spec, 'utf8');
  renameSync(tmpPath, specPath);
}

function updateSlideImage(spec, image) {
  return updateSlideYaml(spec, image.slide, (yaml) => updateYamlImage(yaml, image));
}

function updateSlideTextElement(spec, element) {
  return updateSlideYaml(spec, element.slide, (yaml) => updateYamlTextElement(yaml, element));
}

function updateSlideElements(spec, slideState) {
  const slide = Number(slideState.slide);
  const match = spec.match(new RegExp(`^## Slide\\s+${slide}\\b.*$`, 'm'));
  if (!match) throw new Error(`Slide not found: ${slide}`);
  const start = match.index;
  const rest = spec.slice(start + match[0].length);
  const next = rest.search(/^## Slide\s+\d+\b/m);
  const end = next === -1 ? spec.length : start + match[0].length + next;
  const section = spec.slice(start, end);
  const json = JSON.stringify((slideState.elements || []).map(normalizeCanvasElement), null, 2);
  const block = `### Elements\n\n\`\`\`json\n${json}\n\`\`\`\n\n`;
  const existing = section.match(/^### Elements\s*\r?\n\s*```json\r?\n[\s\S]*?```\s*/m);
  const nextSection = section.search(/^###\s+/m);
  const insertAt = nextSection === -1 ? section.length : nextSection;
  const updated = existing
    ? section.slice(0, existing.index) + block + section.slice(existing.index + existing[0].length)
    : section.slice(0, insertAt) + block + section.slice(insertAt);
  return spec.slice(0, start) + updated + spec.slice(end);
}

function updateSlideYaml(spec, slide, updateYaml) {
  const match = spec.match(new RegExp(`^## Slide\\s+${Number(slide)}\\b.*$`, 'm'));
  if (!match) throw new Error(`Slide not found: ${slide}`);
  const start = match.index;
  const rest = spec.slice(start + match[0].length);
  const next = rest.search(/^## Slide\s+\d+\b/m);
  const end = next === -1 ? spec.length : start + match[0].length + next;
  const section = spec.slice(start, end);
  const fence = section.match(/```yaml(\r?\n)([\s\S]*?)```/);
  if (!fence) throw new Error(`YAML block not found for slide ${slide}`);
  const newline = dominantNewline(spec);
  const yamlStart = start + fence.index + '```yaml'.length + fence[1].length;
  const yamlEnd = yamlStart + fence[2].length;
  const sourceYaml = fence[2].replace(/\r\n/g, '\n');
  const updatedYaml = updateYaml(sourceYaml).replace(/\r\n/g, '\n').replace(/\n?$/, '\n').replace(/\n/g, newline);
  return spec.slice(0, yamlStart) + updatedYaml + spec.slice(yamlEnd);
}

function updateYamlImage(yaml, image) {
  const lines = yaml.split('\n');
  let start = lines.findIndex((line) => line.trim() === 'image:');
  if (start === -1) {
    lines.push('image:', '  enabled: true');
    start = lines.length - 2;
  }
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index].trim() && !/^\s/.test(lines[index])) { end = index; break; }
  }
  const block = lines.slice(start, end);
  for (const [key, value] of Object.entries(pickImageFields(image))) upsertYamlKey(block, key, value);
  return [...lines.slice(0, start), ...block, ...lines.slice(end)].join('\n');
}

function updateYamlTextElement(yaml, element) {
  const safe = normalizeTextElement(element);
  const lines = yaml.split('\n');
  for (const [key, value] of Object.entries({
    [`${safe.kind}_x`]: safe.x,
    [`${safe.kind}_y`]: safe.y,
    [`${safe.kind}_width`]: safe.width,
    [`${safe.kind}_height`]: safe.height,
  })) upsertYamlTopKey(lines, key, value);
  return lines.join('\n');
}

function pickImageFields(image) {
  const safe = normalizeImage(image);
  return {
    x: safe.x, y: safe.y, width: safe.width, height: safe.height,
    crop_x: safe.crop_x, crop_y: safe.crop_y, crop_scale: safe.crop_scale,
  };
}

function normalizeImage(image) {
  const width = clamp(number(image.width), 8, 95);
  const height = clamp(number(image.height), 8, 95);
  const x = clamp(number(image.x), width / 2, 100 - width / 2);
  const y = clamp(number(image.y), height / 2, 100 - height / 2);
  const scale = clamp(number(image.crop_scale, 1), 1, 4);
  const maxPan = scale === 1 ? 0 : ((scale - 1) * 50) / scale;
  return {
    x: pct(x), y: pct(y), width: pct(width), height: pct(height),
    crop_x: pct(clamp(number(image.crop_x), -maxPan, maxPan)),
    crop_y: pct(clamp(number(image.crop_y), -maxPan, maxPan)),
    crop_scale: scale.toFixed(2),
  };
}

function normalizeTextElement(element) {
  const kind = String(element.kind || '').trim();
  if (!['title', 'code', 'blocks', 'body', 'note', 'question'].includes(kind)) throw new Error(`Invalid text element kind: ${kind}`);
  const width = clamp(number(element.width), 10, 95);
  const height = clamp(number(element.height), 4, 95);
  const x = clamp(number(element.x), width / 2, 100 - width / 2);
  const y = clamp(number(element.y), height / 2, 100 - height / 2);
  return { kind, x: pct(x), y: pct(y), width: pct(width), height: pct(height) };
}

function normalizeCanvasElement(element) {
  const type = ['text', 'code', 'image'].includes(element.type) ? element.type : 'text';
  const width = clamp(number(element.width), 8, 95);
  const height = clamp(number(element.height), 4, 95);
  const x = clamp(number(element.x), width / 2, 100 - width / 2);
  const y = clamp(number(element.y), height / 2, 100 - height / 2);
  return {
    id: String(element.id || randomUUID()),
    type,
    x: pct(x), y: pct(y), width: pct(width), height: pct(height),
    zIndex: Math.trunc(clamp(number(element.zIndex, 3), 0, 99)),
    text: type === 'image' ? '' : String(element.text || '').slice(0, 8000),
    src: type === 'image' ? String(element.src || '').slice(0, 2_000_000) : '',
    lang: String(element.lang || 'json').replace(/[^\w-]/g, '').slice(0, 24) || 'json',
    fontSize: cssLength(element.fontSize || (type === 'code' ? '22px' : '32px')),
    color: cssColor(element.color || 'var(--text)'),
    bold: Boolean(element.bold),
    italic: Boolean(element.italic),
  };
}
function number(value, fallback = 0) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function pct(value) { return `${Number(value).toFixed(1)}%`; }
function cssLength(value = '0') {
  const text = String(value || '0').trim();
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `${text}px`;
  if (/^-?\d+(?:\.\d+)?(?:px|rem|em|%|cqw|cqh|vw|vh|ch)$/.test(text)) return text;
  return '32px';
}
function cssColor(value = 'var(--text)') {
  const text = String(value || '').trim();
  if (/^#[\da-f]{3,8}$/i.test(text) || /^var\(--[\w-]+\)$/.test(text)) return text;
  return 'var(--text)';
}

function upsertYamlKey(block, key, value) {
  if (!value) return;
  const line = `  ${key}: "${String(value).replaceAll('"', '\\"')}"`;
  const index = block.findIndex((item) => item.trim().startsWith(`${key}:`));
  if (index === -1) block.push(line);
  else block[index] = line;
}

function upsertYamlTopKey(lines, key, value) {
  if (!value) return;
  const line = `${key}: "${String(value).replaceAll('"', '\\"')}"`;
  const index = lines.findIndex((item) => item.trim().startsWith(`${key}:`));
  if (index === -1) lines.push(line);
  else lines[index] = line;
}

function dominantNewline(text) {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/(?<!\r)\n/g) || []).length;
  return crlf > lf ? '\r\n' : '\n';
}

function isInside(parent, child) {
  const rel = relative(parent, child);
  return rel && !rel.startsWith('..') && !isAbsolute(rel);
}

function notFound(res) { res.writeHead(404); res.end('not found'); }
function type(file) {
  return { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' }[extname(file)] || 'application/octet-stream';
}
