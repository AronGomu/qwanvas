#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const vaultRoot = resolve(root, '../..');
const projectDir = resolve(root, process.argv[2] || 'projects/package-json');
const noPdf = process.argv.includes('--no-pdf');
const specPath = join(projectDir, 'spec.md');
const htmlPath = join(projectDir, 'index.html');
const pdfPath = join(projectDir, 'carousel.pdf');
const TEXT_KINDS = ['title', 'code', 'blocks', 'body', 'note', 'question'];

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();

async function main() {
  if (!existsSync(specPath)) throw new Error(`Missing spec: ${specPath}`);
  mkdirSync(projectDir, { recursive: true });

  const spec = readFileSync(specPath, 'utf8');
  const css = readFileSync(join(root, 'styles/carousel.css'), 'utf8');
  const client = readFileSync(join(root, 'scripts/client.js'), 'utf8');
  const deck = parseSpec(spec);
  writeFileSync(htmlPath, renderHtml(deck, css, client), 'utf8');
  console.log(`html ${htmlPath}`);

  if (!noPdf) {
    const browser = findBrowser();
    if (!browser) {
      console.warn('pdf skipped: set BROWSER_PATH to Chrome/Edge to enable --print-to-pdf');
    } else {
      await printPdf(browser, htmlPath, pdfPath);
      console.log(`pdf  ${pdfPath}`);
    }
  }
}

export function parseSpec(markdown) {
  const body = markdown.replace(/^---[\s\S]*?---\s*/u, '');
  const title = pick(body.match(/title:\s*"([^"]+)"/i)?.[1], body.match(/^#\s+(.+)$/m)?.[1], 'LinkedIn carousel');
  const slideHeadings = [...body.matchAll(/^## Slide\s+(\d+).*$/gm)];
  const slides = slideHeadings.map((heading) => {
    const start = heading.index + heading[0].length;
    const rest = body.slice(start);
    const nextHeading = rest.search(/^##\s+/m);
    return parseSlide(Number(heading[1]), nextHeading === -1 ? rest : rest.slice(0, nextHeading));
  });
  return { title, slides };
}

function parseSlide(number, markdown) {
  const yaml = markdown.match(/```yaml\r?\n([\s\S]*?)```/u)?.[1] || '';
  const meta = Object.fromEntries([...yaml.matchAll(/^([a-z_]+):\s*"?([^"\n]+)"?\s*$/gmi)].map((m) => [m[1], m[2]]));
  const fields = sections(markdown.replace(/```yaml\r?\n[\s\S]*?```/u, ''));
  const codeMatch = fields.Code?.match(/```(\w+)?\n([\s\S]*?)```/u);
  const blocks = (fields.Blocks || '').split('\n').map((line) => line.replace(/^\s*-\s*/, '').trim()).filter(Boolean);
  const image = parseImage(yaml);
  const avatar = parseAvatar(yaml);
  return {
    number,
    page: meta.page_number || `${String(number).padStart(2, '0')} / ??`,
    centerY: meta.content_center_y || (meta.full_height === 'true' ? '50%' : '33.333%'),
    final: meta.full_height === 'true' || meta.layout === 'full_height_cta',
    title: clean(fields.Title),
    body: clean(fields.Body),
    code: codeMatch && { lang: codeMatch[1] || '', value: codeMatch[2].trim() },
    blocks,
    note: clean(fields.Note),
    question: clean(fields.Question),
    text: parseTextLayout(meta),
    textPositions: parseTextPositions(meta),
    image,
    avatar,
    elements: parseElements(fields.Elements),
  };
}

function sections(markdown) {
  const out = {};
  const parts = markdown.split(/^###\s+(.+)$/gm);
  for (let i = 1; i < parts.length; i += 2) out[parts[i].trim()] = stripRules(parts[i + 1].trim());
  return out;
}

function parseElements(value = '') {
  const source = value.match(/```json\r?\n([\s\S]*?)```/u)?.[1] || value.trim();
  if (!source) return [];
  try {
    const parsed = JSON.parse(source);
    return Array.isArray(parsed) ? parsed.map(normalizeElement).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function normalizeElement(element = {}) {
  const type = ['text', 'code', 'image'].includes(element.type) ? element.type : 'text';
  const width = clamp(num(element.width || (type === 'image' ? '55%' : '70%')), 8, 95);
  const height = clamp(num(element.height || (type === 'image' ? '35%' : '12%')), 4, 95);
  return {
    id: String(element.id || `${type}-${Math.random().toString(36).slice(2, 8)}`),
    type,
    x: pct(clamp(num(element.x || '50%'), width / 2, 100 - width / 2)),
    y: pct(clamp(num(element.y || '50%'), height / 2, 100 - height / 2)),
    width: pct(width),
    height: pct(height),
    zIndex: Math.trunc(clamp(num(element.zIndex || '3'), 0, 99)),
    text: String(element.text || ''),
    src: String(element.src || ''),
    lang: String(element.lang || 'json'),
    fontSize: cssLength(element.fontSize || (type === 'code' ? '2.05cqw' : '3cqw')),
    color: cssColor(element.color || 'var(--text)'),
    bold: Boolean(element.bold),
    italic: Boolean(element.italic),
  };
}

function parseImage(yaml) {
  const get = nestedGetter(yaml, 'image');
  if (!get || get('enabled', 'false') !== 'true') return null;
  return normalizeImageSpec({
    src: get('src', ''), x: get('x', '50%'), y: get('y', '72%'), width: get('width', '62%'), height: get('height', '30%'),
    cropX: get('crop_x', '0%'), cropY: get('crop_y', '0%'), cropScale: get('crop_scale', '1'),
  });
}

function parseAvatar(yaml) {
  const get = nestedGetter(yaml, 'avatar');
  if (!get || get('enabled', 'false') !== 'true') return null;
  return { src: get('src', ''), size: get('size', 'large') };
}

function parseTextLayout(meta) {
  return {
    blocks: textLayout(meta.blocks_align || meta.text_align, meta.blocks_padding_left || meta.text_padding_left),
    body: textLayout(meta.body_align || meta.text_align, meta.body_padding_left || meta.text_padding_left),
    note: textLayout(meta.note_align || meta.body_align || meta.text_align, meta.note_padding_left || meta.body_padding_left || meta.text_padding_left),
    question: textLayout(meta.question_align || meta.text_align, meta.question_padding_left || meta.text_padding_left),
  };
}

function textLayout(alignValue, paddingLeftValue) {
  const align = ['left', 'center', 'right'].includes(String(alignValue || '').trim()) ? String(alignValue).trim() : 'center';
  return { align, paddingLeft: cssLength(paddingLeftValue) };
}

function parseTextPositions(meta) {
  return Object.fromEntries(TEXT_KINDS.map((kind) => [kind, textPosition(meta, kind)]));
}

function textPosition(meta, kind) {
  if (!meta[`${kind}_x`] || !meta[`${kind}_y`] || !meta[`${kind}_width`]) return null;
  const width = clamp(num(meta[`${kind}_width`]), 10, 95);
  const height = clamp(num(meta[`${kind}_height`] || '8'), 4, 95);
  const x = clamp(num(meta[`${kind}_x`]), width / 2, 100 - width / 2);
  const y = clamp(num(meta[`${kind}_y`]), height / 2, 100 - height / 2);
  return { x: pct(x), y: pct(y), width: pct(width), height: pct(height) };
}

function nestedGetter(yaml, name) {
  const lines = yaml.split('\n');
  const start = lines.findIndex((line) => line.trim() === `${name}:`);
  if (start === -1) return null;
  const block = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !/^\s/.test(line)) break;
    block.push(line);
  }
  const text = block.join('\n');
  return (key, fallback) => text.match(new RegExp(`${key}:\\s*"?([^"\\n]+)"?`))?.[1] || fallback;
}

function renderHtml(deck, css, client) {
  const slides = deck.slides.map((slide, index) => renderSlide(slide, index === 0)).join('\n');
  return `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(deck.title)}</title>
  <style>${css}</style>
</head>
<body>
  <main class="viewer" aria-label="${esc(deck.title)}">
    <button class="nav" data-prev aria-label="Slide précédente">‹</button>
    <section class="deck">${slides}</section>
    <button class="nav" data-next aria-label="Slide suivante">›</button>
  </main>
  <div class="hint">←/→ naviguer · edit spec.md puis refresh/live reload</div>
  <script>${client}</script>
</body>
</html>
`;
}

function renderSlide(slide, active) {
  const custom = slide.elements.length ? renderCanvasElements(slide) : '';
  const flow = custom ? '' : (slide.final ? renderFinalContent(slide, false) : renderStandardContent(slide, false));
  const positioned = custom ? '' : (slide.final ? renderFinalContent(slide, true) : renderStandardContent(slide, true));
  return `<article class="slide${active ? ' active' : ''}${slide.final ? ' final' : ''}" data-slide="${slide.number}" style="--center-y:${esc(slide.centerY)}">
  <div class="page-number">${esc(slide.page)}</div>
  ${flow ? `<div class="content">${flow}</div>` : ''}
  ${custom || positioned}
  ${!custom && slide.image?.src ? `<div class="image-slot editable-box" data-type="image" style="left:${esc(slide.image.x)};top:${esc(slide.image.y)};width:${esc(slide.image.width)};height:${esc(slide.image.height)};--crop-x:${esc(slide.image.cropX)};--crop-y:${esc(slide.image.cropY)};--crop-scale:${esc(slide.image.cropScale)}"><img src="${esc(assetSrc(slide.image.src))}" alt=""></div><div class="print-image" style="left:${edge(slide.image.x, slide.image.width)}%;top:${edge(slide.image.y, slide.image.height)}%;width:${num(slide.image.width)}%;height:${num(slide.image.height)}%;--crop-x:${esc(slide.image.cropX)};--crop-y:${esc(slide.image.cropY)};--crop-scale:${esc(slide.image.cropScale)}"><img src="${esc(assetSrc(slide.image.src))}" alt=""></div>` : ''}
</article>`;
}

function renderCanvasElements(slide) {
  return slide.elements.map((element) => renderCanvasElement(element, slide.number)).join('');
}

function renderCanvasElement(element, slideNumber) {
  const attrs = `class="canvas-element editable-box ${element.type === 'image' ? 'image-slot' : 'editable-text is-positioned'} ${element.type === 'code' ? 'code-element' : ''}" data-element-id="${esc(element.id)}" data-type="${esc(element.type)}" data-slide="${esc(slideNumber)}" style="${elementStyle(element)}"`;
  if (element.type === 'image') return `<div ${attrs}><img src="${esc(assetSrc(element.src))}" alt=""></div>`;
  if (element.type === 'code') return `<pre ${attrs} data-lang="${esc(element.lang)}" contenteditable="true" spellcheck="false"><code>${highlightCode(element.text, element.lang)}</code></pre>`;
  return `<div ${attrs} contenteditable="true" spellcheck="false">${inline(element.text)}</div>`;
}

function elementStyle(element) {
  return [
    `left:${esc(element.x)}`,
    `top:${esc(element.y)}`,
    `width:${esc(element.width)}`,
    `height:${esc(element.height)}`,
    `z-index:${esc(element.zIndex)}`,
    `font-size:${esc(element.fontSize)}`,
    `color:${esc(element.color)}`,
    `font-weight:${element.bold ? '800' : '400'}`,
    `font-style:${element.italic ? 'italic' : 'normal'}`,
  ].join(';');
}

function renderStandardContent(slide, positionedOnly = false) {
  return [
    slide.title && renderTextElement(slide, 'title', `<h1${textDataAttrs(slide, 'title')}>${inline(slide.title)}</h1>`, positionedOnly),
    slide.code && renderTextElement(slide, 'code', `<pre${textDataAttrs(slide, 'code')} data-lang="${esc(slide.code.lang || 'code')}"><code>${highlightCode(slide.code.value, slide.code.lang)}</code></pre>`, positionedOnly),
    slide.blocks.length && renderTextElement(slide, 'blocks', `<ul${textDataAttrs(slide, 'blocks')}${textAttrs(slide.text.blocks)}>${slide.blocks.map((item) => `<li><span>${inline(item)}</span></li>`).join('')}</ul>`, positionedOnly),
    slide.body && renderBodyElement(slide, '', positionedOnly),
    slide.note && renderTextElement(slide, 'note', `<p${textDataAttrs(slide, 'note', 'note')}${textAttrs(slide.text.note)}>${inline(slide.note)}</p>`, positionedOnly),
    slide.question && renderTextElement(slide, 'question', `<p${textDataAttrs(slide, 'question', 'question')}${textAttrs(slide.text.question)}>${inline(slide.question)}</p>`, positionedOnly),
  ].filter(Boolean).join('');
}

function renderFinalContent(slide, positionedOnly = false) {
  return [
    slide.title && renderTextElement(slide, 'title', `<h1${textDataAttrs(slide, 'title', 'cta-title')}>${inline(slide.title)}</h1>`, positionedOnly),
    slide.body && renderBodyElement(slide, 'cta-copy', positionedOnly),
    slide.question && renderTextElement(slide, 'question', `<div${textDataAttrs(slide, 'question', 'question-block')}${textAttrs(slide.text.question)}>${inline(slide.question)}</div>`, positionedOnly),
    !positionedOnly && slide.avatar?.src && `<div class="cta-avatar cta-avatar-${esc(slide.avatar.size)}"><img src="${esc(assetSrc(slide.avatar.src))}" alt="Portrait de Nathan Flachaire"></div>`,
  ].filter(Boolean).join('');
}

function renderTextElement(slide, kind, html, positionedOnly) {
  const position = slide.textPositions[kind];
  if (positionedOnly !== Boolean(position)) return '';
  if (!position) return html;
  return addElementAttrs(html, `is-positioned`, `left:${esc(position.x)};top:${esc(position.y)};width:${esc(position.width)};height:${esc(position.height)}`);
}

function textDataAttrs(slide, kind, className = '') {
  return ` class="${esc(['editable-text', className].filter(Boolean).join(' '))}" data-kind="${esc(kind)}" data-slide="${esc(slide.number)}"`;
}
function addElementAttrs(html, className, style) {
  let out = html.includes(' class="') ? html.replace(' class="', ` class="${className} `) : html.replace(/^(<[a-z0-9-]+)/i, `$1 class="${className}"`);
  out = out.includes(' style="') ? out.replace(' style="', ` style="${style};`) : out.replace(/^(<[a-z0-9-]+[^>]*)/i, `$1 style="${style}"`);
  return out;
}

function renderBodyElement(slide, className, positionedOnly) {
  const html = `<div${textDataAttrs(slide, 'body', ['body-block', className].filter(Boolean).join(' '))}${textAttrs(slide.text.body)}>${paragraphs(slide.body, className)}</div>`;
  return renderTextElement(slide, 'body', html, positionedOnly);
}

function paragraphs(text, className = '') {
  const attr = className ? ` class="${esc(className)}"` : '';
  return text.split(/\n{2,}/).map((p) => `<p${attr}>${inline(p.replace(/\n/g, '<br>'))}</p>`).join('');
}
function highlightCode(value = '', lang = '') {
  if (lang !== 'json') return esc(value);
  const token = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?|[{}[\],:]/g;
  let html = '';
  let last = 0;
  for (const match of value.matchAll(token)) {
    html += esc(value.slice(last, match.index));
    const text = match[0];
    const cls = text.startsWith('"') && value.slice(match.index + text.length).match(/^\s*:/) ? 'key'
      : text.startsWith('"') ? 'string'
      : /^[{}[\],:]$/.test(text) ? 'punct'
      : 'number';
    html += `<span class="tok-${cls}">${esc(text)}</span>`;
    last = match.index + text.length;
  }
  return html + esc(value.slice(last));
}
function stripRules(value = '') { return value.replace(/^\s*---\s*$/gm, '').trim(); }
function clean(value = '') { return stripRules(value).replace(/^`([\s\S]*)`$/u, '$1'); }
function inline(value = '') {
  return esc(value)
    .replace(/\{brand:([^{}]+)\}/g, '<span class="text-brand">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
}
function textAttrs(layout = textLayout()) {
  const styles = [];
  if (layout.align !== 'center') styles.push(`text-align:${layout.align}`);
  if (layout.paddingLeft !== '0') styles.push(`padding-left:${layout.paddingLeft}`);
  return styles.length ? ` style="${esc(styles.join(';'))}"` : '';
}
function cssLength(value = '0') {
  const text = String(value || '0').trim();
  if (text === '0') return '0';
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return `${text}cqw`;
  if (/^-?\d+(?:\.\d+)?(?:px|rem|em|%|cqw|cqh|vw|vh|ch)$/.test(text)) return text;
  return '0';
}
function cssColor(value = 'var(--text)') {
  const text = String(value || '').trim();
  if (/^#[\da-f]{3,8}$/i.test(text) || /^var\(--[\w-]+\)$/.test(text) || /^oklch\([\w\s.%/-]+\)$/.test(text)) return text;
  return 'var(--text)';
}
function esc(value = '') { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function normalizeImageSpec(image) {
  const width = clamp(num(image.width), 8, 95);
  const height = clamp(num(image.height), 8, 95);
  const x = clamp(num(image.x), width / 2, 100 - width / 2);
  const y = clamp(num(image.y), height / 2, 100 - height / 2);
  const scale = clamp(num(image.cropScale || '1'), 1, 4);
  const maxPan = scale === 1 ? 0 : ((scale - 1) * 50) / scale;
  return {
    ...image,
    x: pct(x), y: pct(y), width: pct(width), height: pct(height),
    cropX: pct(clamp(num(image.cropX), -maxPan, maxPan)),
    cropY: pct(clamp(num(image.cropY), -maxPan, maxPan)),
    cropScale: scale.toFixed(2),
  };
}
function num(value = '') { return Number.parseFloat(value) || 0; }
function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function pct(value) { return `${Number(value).toFixed(1)}%`; }
function edge(center = '', size = '') { return (num(center) - num(size) / 2).toFixed(3); }
function assetSrc(src = '') {
  const local = src.replaceAll('\\\\', '\\');
  if (/^[A-Za-z]:[\\/]/.test(local)) return encodeURI(`file:///${local.replaceAll('\\', '/')}`);
  if (local.startsWith('file:')) return local;
  if (/^[a-z]+:/i.test(local)) return local;
  if (isAbsolute(local)) return pathToFileURL(local).href;
  const projectAsset = resolve(projectDir, local);
  if (existsSync(projectAsset)) return pathToFileURL(projectAsset).href;
  const vaultAsset = resolve(vaultRoot, local);
  if (existsSync(vaultAsset)) return pathToFileURL(vaultAsset).href;
  return local;
}
function pick(...values) { return values.find((value) => value && value.trim())?.trim(); }

function findBrowser() {
  if (process.env.BROWSER_PATH && existsSync(process.env.BROWSER_PATH)) return process.env.BROWSER_PATH;
  const env = process.env;
  const candidates = [
    join(env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe'),
    join(env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Google/Chrome/Application/chrome.exe'),
    join(env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
    join(env.PROGRAMFILES || 'C:/Program Files', 'Microsoft/Edge/Application/msedge.exe'),
    join(env['PROGRAMFILES(X86)'] || 'C:/Program Files (x86)', 'Microsoft/Edge/Application/msedge.exe'),
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ];
  return candidates.find((candidate) => candidate && existsSync(candidate));
}

function printPdf(browser, html, pdf) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(browser, [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--allow-file-access-from-files',
      '--disable-web-security',
      '--window-size=1080,1350',
      '--force-device-scale-factor=1',
      '--run-all-compositor-stages-before-draw',
      '--virtual-time-budget=1500',
      `--print-to-pdf=${pdf}`,
      '--print-to-pdf-no-header',
      pathToFileURL(resolve(html)).href,
    ], { stdio: 'ignore' });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolvePromise() : reject(new Error(`Browser PDF export failed with code ${code}`)));
  });
}
