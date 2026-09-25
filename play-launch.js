/* Prepared by: Codex.
 * A bounded Play transition: portal -> original creature opening -> the game (play-game.html).
 * It deliberately never enters the Earth/town intro or the unfinished game.
 * Optional cx/cy are viewport-normalized; r is normalized to min(width,height).
 */
const $ = id => document.getElementById(id);
const query = new URLSearchParams(location.search);
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));
const number = (key, fallback, min, max) => {
  const value = query.has(key) ? Number(query.get(key)) : fallback;
  return Number.isFinite(value) ? clamp(value, min, max) : fallback;
};
const origin = { x: number('cx', .31, 0, 1), y: number('cy', .3, 0, 1), r: number('r', .13, .025, .45) };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const portal = $('portal'), film = $('portal-film'), frame = $('opening');
const black = $('black'), white = $('white'), loading = $('loading');
// The Play transition has already shown the emblem. Join after the Intro's
// creator signature has cleared, without changing that original Intro.
const openingStart = 2.65;
const openingURL = new URL(`intro-comet.html?mode=opening&cut=earth-energy&t=${openingStart}&autoplay=1&presentation=play`, location.href);
const target = new URL('terrace-world.html', location.href);   // Play now opens the game itself
const durations = { zoom: reduced ? .55 : 2.5, black: .35, creatures: 10.04 - openingStart, white: 1.35 };
const events = [];
let phase = 'loading', ready = false, paused = false, elapsed = 0, last = 0, raf = 0;
let api = null, blobURL = null, disposed = false, failed = '', navigating = false;
const abort = new AbortController();
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const whiteStart = () => durations.zoom + durations.black + durations.creatures;
const total = () => whiteStart() + durations.white;
let aperture = null;

function placePortal(progress, opacity = 1) {
  const width = innerWidth, height = innerHeight;
  const start = origin.r * Math.min(width, height);
  const cx = (origin.x + (.5 - origin.x) * progress) * width;
  const cy = (origin.y + (.5 - origin.y) * progress) * height;
  const end = Math.hypot(width, height) * .52;
  const radius = start + (end - start) * progress;
  // Grow the aperture, not the film's pixels. Once a side reaches the viewport,
  // its image bounds stop there, resolving to the full-resolution widescreen
  // shot instead of magnifying a square thumbnail several times beyond it.
  const left = Math.max(0, cx - radius), top = Math.max(0, cy - radius);
  const filmWidth = Math.min(width, cx + radius) - left;
  const filmHeight = Math.min(height, cy + radius) - top;
  aperture = { cx, cy, radius, left, top, filmWidth, filmHeight };
  portal.style.clipPath = `circle(${radius}px at ${cx}px ${cy}px)`;
  const edge = Math.min(18, radius * .09);
  portal.style.maskImage = `radial-gradient(circle at ${cx}px ${cy}px, #000 ${Math.max(0, radius - edge)}px, rgba(0,0,0,.86) ${radius - edge * .5}px, rgba(0,0,0,.25) ${radius - edge * .14}px, transparent ${radius}px)`;
  portal.style.opacity = String(opacity);
  Object.assign(film.style, { left: `${left}px`, top: `${top}px`, width: `${filmWidth}px`, height: `${filmHeight}px` });
  const mark = $('portal-mark');
  const markSize = Math.min(start * .76, Math.min(width, height) * .20, 200);
  // A physical emblem remains the size of an emblem. It does not grow with
  // the opening or clip against the top/left when the aperture expands.
  Object.assign(mark.style, { left: `${cx}px`, top: `${cy}px`, width: `${markSize}px`, height: `${markSize}px`,
    opacity: String(.88 * (1 - smooth(progress / .72))) });
}

function setPhase(next) {
  if (next === phase) return;
  phase = next;
  events.push({ phase, time: Number(elapsed.toFixed(3)) });
  document.body.dataset.phase = phase;
}

function goToPreview() {
  if (navigating || disposed) return;
  navigating = true;
  film.pause(); api?.pause();
  location.replace(target.href);
}

function setPaused(value) {
  paused = !!value;
  last = performance.now();
  $('pause').textContent = paused ? 'Resume' : 'Pause';
  $('pause').setAttribute('aria-label', paused ? 'Resume opening' : 'Pause opening');
  if (paused) { film.pause(); api?.pause(); }
  else if (ready) {
    if (phase === 'zoom') film.play().catch(showFailure);
    if (phase === 'creatures') api?.play();
  }
}

function paint(time, manual = false) {
  if (!ready || disposed) return;
  const previous = phase;
  const creatureStart = durations.zoom + durations.black;
  const next = time < durations.zoom ? 'zoom' : time < creatureStart ? 'black' : time < whiteStart() ? 'creatures' : 'white';
  setPhase(next);
  document.body.classList.toggle('ending', next === 'white');
  black.style.opacity = '0'; white.style.opacity = '0';
  portal.style.visibility = next === 'zoom' || next === 'black' ? 'visible' : 'hidden';
  frame.hidden = next === 'zoom' || next === 'black';
  $('destination').hidden = next !== 'white';
  if (next === 'zoom' || next === 'black') {
    const progress = smooth(time / durations.zoom);
    placePortal(reduced ? 1 : progress, reduced ? smooth(time / .35) : 1);
    black.style.opacity = String(smooth((time - durations.zoom + .3) / .3));
    if (previous === 'creatures' || previous === 'white') api?.pause();
    if (next === 'zoom' && !paused && film.paused) film.play().catch(showFailure);
    if (next === 'black') film.pause();
  } else if (next === 'creatures') {
    film.pause();
    const localTime = openingStart + time - creatureStart;
    if (previous !== 'creatures' || manual) {
      api.seek(localTime);
      if (!paused) api.play();
    }
    // A short emergence from black joins the portal footage without another
    // flash, star field, planet, school scene, or regenerated character art.
    black.style.opacity = String(1 - smooth((time - creatureStart) / .35));
  } else {
    film.pause(); api?.pause();
    if (previous !== 'white' || manual) api?.seek(10.04);
    white.style.opacity = String(1 - smooth((time - whiteStart() - .16) / (durations.white - .16)));
  }
}

function tick(now) {
  if (ready && !paused && !document.hidden && !navigating) {
    const nextTime = Math.min(total(), elapsed + Math.max(0, (now - last) / 1000));
    // Present every join at least once even if a busy tab delivers one long
    // frame. A delayed callback must not jump over the requested black breath
    // or the white handoff altogether.
    const boundary = phase === 'zoom' ? durations.zoom : phase === 'black'
      ? durations.zoom + durations.black : phase === 'creatures' ? whiteStart() : total();
    elapsed = Math.min(nextTime, boundary);
    paint(elapsed);
    if (elapsed >= total()) goToPreview();
  }
  last = now;
  if (!disposed) raf = requestAnimationFrame(tick);
}

function showFailure(cause) {
  if (disposed || navigating || failed) return;
  failed = cause?.message || String(cause || 'Animation unavailable');
  setPaused(true); setPhase('error');
  loading.hidden = false;
  $('message').textContent = 'The opening could not play. You can still continue to the game or return to the menu.';
  $('pause').disabled = true;
  console.warn('Play opening:', failed);
}

function waitForOpening() {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    const poll = () => {
      if (disposed || abort.signal.aborted) return reject(new Error('Opening cancelled'));
      try {
        const candidate = frame.contentWindow?.introStudy;
        if (candidate?.getState().ready) return resolve(candidate);
        const error = frame.contentDocument?.getElementById('error')?.textContent;
        if (error) return reject(new Error(error));
      } catch (cause) { return reject(cause); }
      if (performance.now() - start > 35000) return reject(new Error('The original creature opening timed out.'));
      setTimeout(poll, 100);
    };
    poll();
  });
}

async function loadPortal() {
  const response = await fetch('assets/intro-earth-energy-v1/portal-approved-web.mp4', { signal: abort.signal });
  if (!response.ok) throw new Error(`Portal footage returned HTTP ${response.status}.`);
  blobURL = URL.createObjectURL(new Blob([await response.arrayBuffer()], { type: 'video/mp4' }));
  film.src = blobURL;
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Portal video decode timed out.')), 20000);
    film.onloadeddata = () => {
      film.onloadeddata = null;
      // Start in the already-established swirl, not the source's black lead-in.
      film.onseeked = () => { clearTimeout(timer); film.onseeked = null; resolve(); };
      film.currentTime = 2.1;
    };
    film.onerror = () => { clearTimeout(timer); reject(new Error('Portal video could not decode.')); };
    film.load();
  });
}

function skip(event) {
  event?.preventDefault();
  // Skip remains a real link if JavaScript fails before this handler starts.
  if (!ready || failed) return goToPreview();
  elapsed = whiteStart(); setPaused(false); paint(elapsed);
}
$('skip').addEventListener('click', skip);
$('fallback-link').addEventListener('click', skip);
$('pause').addEventListener('click', () => setPaused(!paused));
$('back').addEventListener('click', event => {
  if (parent !== window && query.get('embed') === 'menu') {
    event.preventDefault(); film.pause(); api?.pause();
    parent.postMessage({ type: 'spirit-strikers-close' }, location.origin);
  }
});
addEventListener('message', event => {
  if (event.origin !== location.origin || event.source !== frame.contentWindow) return;
  if (event.data?.type !== 'toga:intro-next' || event.data?.source !== 'creature-opening') return;
  // A valid sender is still only allowed to finish the creature stage, never
  // redirect the parent or name an arbitrary URL.
  if (phase !== 'creatures' || (api?.getState().time || 0) < 9.9) return;
  elapsed = whiteStart(); paint(elapsed);
});
addEventListener('resize', () => paint(elapsed));
document.addEventListener('visibilitychange', () => {
  last = performance.now();
  if (document.hidden) { film.pause(); api?.pause(); }
  else if (!paused && ready) {
    if (phase === 'zoom') film.play().catch(showFailure);
    if (phase === 'creatures') api?.play();
  }
});
addEventListener('pagehide', () => {
  disposed = true; abort.abort(); cancelAnimationFrame(raf);
  film.pause(); api?.pause();
  if (blobURL) URL.revokeObjectURL(blobURL);
});

window.PLAY_LAUNCH = {
  getState: () => ({ phase, ready, paused, elapsed, duration: total(), reduced, origin, failed,
    portal: { readyState: film.readyState, time: film.currentTime, paused: film.paused, error: film.error?.message || '' },
    opening: api?.getState() || null, events: events.map(event => ({ ...event })) }),
  pause: () => setPaused(true), play: () => setPaused(false),
  seek: seconds => { if (!ready) return false; setPaused(true); elapsed = clamp(Number(seconds) || 0, 0, total()); paint(elapsed, true); return true; },
  capture: () => {
    if (phase === 'creatures') return frame.contentWindow?.__captureFrame?.() || null;
    // The destination is live HTML, not a canvas. Use a browser screenshot for
    // the final white dissolve rather than return a misleading old intro frame.
    if (phase === 'white') return null;
    const canvas = document.createElement('canvas'); canvas.width = innerWidth; canvas.height = innerHeight;
    const context = canvas.getContext('2d'); context.fillStyle = '#000'; context.fillRect(0, 0, canvas.width, canvas.height);
    const bounds = film.getBoundingClientRect();
    context.save(); context.beginPath(); context.arc(aperture.cx, aperture.cy, aperture.radius, 0, Math.PI * 2); context.clip();
    if (film.readyState >= 2) {
      const fit = Math.max(bounds.width / film.videoWidth, bounds.height / film.videoHeight);
      const width = film.videoWidth * fit, height = film.videoHeight * fit;
      context.drawImage(film, bounds.x + (bounds.width - width) / 2, bounds.y + (bounds.height - height) / 2, width, height);
    }
    const mark = $('portal-mark'), markBounds = mark.getBoundingClientRect();
    if (mark.complete) {
      context.filter = 'brightness(0) invert(1)';
      context.globalAlpha = Number(getComputedStyle(mark).opacity);
      context.drawImage(mark, markBounds.x, markBounds.y, markBounds.width, markBounds.height);
      context.filter = 'none'; context.globalAlpha = 1;
    }
    context.restore(); context.globalAlpha = Number(black.style.opacity) || 0; context.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/png');
  },
};

// The menu behind this iframe remains visible while its own portal becomes
// the foreground circle. No full-frame black layer is painted before the zoom.
placePortal(0);
portal.style.visibility = 'visible';
loading.hidden = true;
frame.src = openingURL.href;
Promise.all([loadPortal(), waitForOpening()]).then(([, opening]) => {
  if (disposed || navigating) return;
  api = opening; api.seek(openingStart);
  durations.creatures = api.getState().duration - openingStart;
  ready = true; $('pause').disabled = false; loading.hidden = true;
  elapsed = 0; last = performance.now(); paint(0);
  film.play().catch(showFailure);
  raf = requestAnimationFrame(tick);
}).catch(showFailure);
