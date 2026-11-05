// The Originals gallery. Source drawings are read-only; colour mode reuses the
// opening's own flat mattes (intro-art-colour.js) so both places agree.
import { FLAT_COLOURS, colourOriginal } from './intro-art-colour.js';

const COUNT = 29;
const SRC = n => `assets/intro-originals-v2/card-${String(n).padStart(2, '0')}.png`;
const COLOUR_NAMES = { '#41A8A7': 'Teal', '#9E0303': 'Red', '#41A841': 'Green', '#A9A7A7': 'Grey', '#8E7BC4': 'Violet', '#DF771F': 'Orange', '#E4D34E': 'Yellow' };
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const list = document.getElementById('plates');
const viewer = document.getElementById('viewer');
const viewerPlate = document.getElementById('viewer-plate');
const viewerTitle = document.getElementById('viewer-title');
const viewerCount = document.getElementById('viewer-count');
const modeButtons = [...document.querySelectorAll('[data-mode]')];

// When the Library is open inside the main menu, "← Library" stays in that frame; nothing else to do.
const plates = [];
let mode = 'line';
let current = 0;

function label(i) { return `No. ${String(i + 1).padStart(2, '0')}`; }

function paper(i, eager) {
  const box = document.createElement('div');
  box.className = 'paper';
  const img = new Image();
  img.src = SRC(i + 1);
  img.alt = `Original drawing ${label(i)} by Blu`;
  img.decoding = 'async';
  if (!eager) img.loading = 'lazy';
  box.append(img);
  return { box, img };
}

// Colouring floods each drawing's pixels once; the result is cached per card.
const coloured = new Map();
function colourFor(i, img) {
  if (coloured.has(i)) return coloured.get(i);
  const job = (img.complete && img.naturalWidth ? Promise.resolve() : img.decode().catch(() => new Promise(r => img.addEventListener('load', r, { once: true }))))
    .then(() => colourOriginal(img, FLAT_COLOURS[i]).canvas)
    .catch(err => { console.warn('Could not colour', label(i), err); return null; });
  coloured.set(i, job);
  return job;
}

async function applyColour(i, box, img) {
  if (box.querySelector('canvas')) return;
  const source = await colourFor(i, img);
  if (!source || box.querySelector('canvas')) return;
  const canvas = document.createElement('canvas');
  canvas.width = source.width; canvas.height = source.height;
  canvas.getContext('2d').drawImage(source, 0, 0);
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', img.alt + ', in colour');
  canvas.className = 'ready';
  box.insertBefore(canvas, img);
}

const colourWhenSeen = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting || mode !== 'colour') continue;
    const p = plates[+entry.target.dataset.index];
    colourWhenSeen.unobserve(entry.target);
    (window.requestIdleCallback || setTimeout)(() => applyColour(p.index, p.box, p.img));
  }
}, { rootMargin: '300px' });

const reveal = new IntersectionObserver(entries => {
  for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('shown'); reveal.unobserve(entry.target); }
}, { rootMargin: '0px 0px -40px' });

for (let i = 0; i < COUNT; i++) {
  const li = document.createElement('li');
  li.className = 'plate';
  li.dataset.index = i;
  li.style.transitionDelay = reducedMotion.matches ? '0s' : `${(i % 4) * 70}ms`;
  const button = document.createElement('button');
  button.type = 'button';
  button.setAttribute('aria-label', `Open ${label(i)}`);
  const { box, img } = paper(i, i < 8);
  const cap = document.createElement('div');
  cap.className = 'caption';
  const hex = FLAT_COLOURS[i];
  cap.innerHTML = `<b>${label(i)}</b><span>${COLOUR_NAMES[hex] || ''}<i class="swatch" style="background:${hex}" aria-hidden="true"></i></span>`;
  button.append(box, cap);
  button.addEventListener('click', () => open(i));
  li.append(button);
  list.append(li);
  plates.push({ index: i, li, box, img });
  reveal.observe(li);
}

function setMode(next) {
  mode = next;
  document.body.classList.toggle('colour', mode === 'colour');
  modeButtons.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === mode)));
  if (mode === 'colour') plates.forEach(p => colourWhenSeen.observe(p.li));
  if (viewer.open) show(current);
  try { localStorage.setItem('originals-mode', mode); } catch {}
}
modeButtons.forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
try { if (localStorage.getItem('originals-mode') === 'colour') setMode('colour'); } catch {}

function show(i) {
  current = (i + COUNT) % COUNT;
  const { box, img } = paper(current, true);
  viewerPlate.replaceChildren(box);
  if (mode === 'colour') applyColour(current, box, img);
  viewerTitle.textContent = label(current);
  viewerCount.textContent = `${current + 1} of ${COUNT}`;
}
let returnFocus = null;
function open(i) { returnFocus = document.activeElement; show(i); viewer.showModal(); history.replaceState(null, '', `#${String(i + 1).padStart(2, '0')}`); }
function close() { viewer.close(); }
viewer.addEventListener('close', () => { history.replaceState(null, '', location.pathname + location.search); returnFocus?.focus(); });
document.getElementById('viewer-close').addEventListener('click', close);
document.getElementById('viewer-prev').addEventListener('click', () => show(current - 1));
document.getElementById('viewer-next').addEventListener('click', () => show(current + 1));
viewer.addEventListener('click', e => { if (e.target === viewer || e.target.classList.contains('viewer-plate')) close(); });
viewer.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') { e.preventDefault(); show(current - 1); }
  else if (e.key === 'ArrowRight') { e.preventDefault(); show(current + 1); }
});
let touchX = null;
viewer.addEventListener('touchstart', e => { touchX = e.touches[0].clientX; }, { passive: true });
viewer.addEventListener('touchend', e => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX; touchX = null;
  if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
});

// A link like originals.html#07 opens that drawing.
const deep = parseInt(location.hash.slice(1), 10);
if (deep >= 1 && deep <= COUNT) open(deep - 1);
