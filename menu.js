/* Prepared by: Codex. Shared town scene with the existing destination and radio shell. */
(() => {
  'use strict';
  const menu = document.querySelector('.drawn-menu');
  const links = [...menu.querySelectorAll('a[data-destination]')];
  const note = document.getElementById('menu-note');
  const dialog = document.getElementById('destination');
  const contentFrame = document.getElementById('destination-frame');
  const radioFrame = document.getElementById('radio-frame');
  const RADIO_SITE = 'https://wiserockfish.com/';
  const sceneFrame = document.getElementById('menu-scene-frame');
  const sceneStage = document.getElementById('menu-scene-stage');
  const fallback = document.getElementById('menu-fallback');
  const streetViews=[...document.querySelectorAll('[data-street-view]')];
  const motionButton=document.getElementById('sign-motion');
  const reducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
  let signMotionEnabled=false;
  let streetView='sign';
  let sceneReady = false;
  // While the town loads, the screen is a set tuning in: a navy card with the wordmark (or, straight from the intro,
  // the intro's own static). When the town is ready the picture opens like an iris onto it.
  const fromIntro = new URLSearchParams(location.search).get('from') === 'intro';
  const arrival = (() => {
    let cv = null, raf = 0, phase = 'off', openAt = 0, look = 'static';
    const rm = matchMedia('(prefers-reduced-motion: reduce)');
    const wordmark = new Image(), mark = new Image();
    wordmark.src = 'images/brand/spirit-striker-wordmark-original-letter-shapes-v11.png'; mark.src = 'images/striker-symbol-gold.png';
    function start(kind = 'static'){
      if (cv) return; look = kind; cv = document.createElement('canvas'); cv.setAttribute('aria-hidden', 'true');
      Object.assign(cv.style, { position:'fixed', inset:'0', width:'100%', height:'100%', zIndex:'1000', pointerEvents:'none' }); document.body.appendChild(cv);
      phase = look; raf = requestAnimationFrame(draw);
      setTimeout(() => { if (phase !== 'open' && phase !== 'off') open(); }, 15000);           // never hold the menu hostage to a slow load
    }
    const noise = document.createElement('canvas'); noise.width = 192; noise.height = 108; const nx = noise.getContext('2d'), img = nx.createImageData(192, 108);
    const ready = i => i.complete && i.naturalWidth > 0;
    function draw(now){
      const dpr = Math.min(2, devicePixelRatio || 1), w = cv.width = Math.round(innerWidth*dpr/2), h = cv.height = Math.round(innerHeight*dpr/2), g = cv.getContext('2d'), s = Math.min(w, h);
      for (let i = 0; i < img.data.length; i += 4){ const v = Math.random()*255*(0.75 + 0.25*Math.sin(i*0.0007 + now*0.02)); img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      nx.putImageData(img, 0, 0); g.imageSmoothingEnabled = false;
      if (look === 'card'){
        g.fillStyle = '#0c1220'; g.fillRect(0, 0, w, h);
        g.globalAlpha = 0.07; g.drawImage(noise, 0, 0, w, h); g.globalAlpha = 1; g.imageSmoothingEnabled = true;
        const vg = g.createRadialGradient(w/2, h*0.45, s*0.1, w/2, h*0.45, Math.hypot(w, h)*0.6); vg.addColorStop(0, 'rgba(40,52,84,0.45)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)'); g.fillStyle = vg; g.fillRect(0, 0, w, h);
        let below = h*0.42;
        if (ready(wordmark)){ const ww = Math.min(w*0.7, s*1.05), wh = ww*wordmark.naturalHeight/wordmark.naturalWidth; g.drawImage(wordmark, (w - ww)/2, h*0.4 - wh/2, ww, wh); below = h*0.4 + wh/2; }
        if (ready(mark)){ const ms = s*0.13; g.save(); g.translate(w/2, below + ms*0.85); g.rotate(Math.sin(now*0.0011)*0.4); g.globalAlpha = 0.9; g.drawImage(mark, -ms/2, -ms/2, ms, ms); g.restore(); below += ms*1.6; }
        const bw = Math.min(w*0.4, 300*dpr), bh = Math.max(1, Math.round(s*0.004)), bx = (w - bw)/2, by = Math.max(below + s*0.04, h*0.7);
        g.fillStyle = 'rgba(216,179,72,0.18)'; g.fillRect(bx, by, bw, bh);
        const p = (now*0.0004)%1, gx = bx - bw*0.2 + p*bw*1.4, sh = g.createLinearGradient(gx - bw*0.2, 0, gx + bw*0.2, 0);
        sh.addColorStop(0, 'rgba(216,179,72,0)'); sh.addColorStop(0.5, 'rgba(240,206,110,0.95)'); sh.addColorStop(1, 'rgba(216,179,72,0)');
        g.fillStyle = sh; g.fillRect(bx, by, bw, bh);
        g.font = '300 ' + Math.max(9, Math.round(s*0.024)) + 'px "Josefin Sans", Futura, "Avenir Next", sans-serif'; if ('letterSpacing' in g) g.letterSpacing = Math.round(s*0.008) + 'px';
        g.textAlign = 'center'; g.fillStyle = 'rgba(227,214,170,0.66)'; g.fillText('TUNING IN', w/2, by + s*0.06);
      } else {
        g.globalAlpha = 1; g.drawImage(noise, 0, 0, w, h); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, w, h);
      }
      if (phase === 'open'){
        const u = Math.min(1, (now - openAt)/1300), e = 1 - Math.pow(1 - u, 3), R = e*Math.hypot(w, h)*0.56, cx = w/2, cy = h*0.46;
        g.save(); g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(cx, cy, Math.max(0.1, R), 0, Math.PI*2); g.fill(); g.restore();
        if (R > 1){ g.lineWidth = Math.max(2, h*0.012); g.strokeStyle = '#1d2433'; g.beginPath(); g.arc(cx, cy, R + g.lineWidth*0.9, 0, Math.PI*2); g.stroke();
          g.lineWidth = Math.max(1.5, h*0.006); g.strokeStyle = '#d8b348'; g.beginPath(); g.arc(cx, cy, R + g.lineWidth*0.5, 0, Math.PI*2); g.stroke(); }
        if (u >= 1){ cv.remove(); cv = null; phase = 'off'; return; }
      }
      raf = requestAnimationFrame(draw);
    }
    function open(){ if (!cv) return; if (phase !== 'open'){ phase = 'open'; openAt = performance.now(); } if (rm.matches){ cancelAnimationFrame(raf); cv.remove(); cv = null; phase = 'off'; } }
    return { start, open, again(){ start('static'); setTimeout(open, 650); } };
  })();
  arrival.start(fromIntro ? 'static' : 'card');
  if (fromIntro) history.replaceState(null, '', location.pathname);
  function syncMotionControl(){
    motionButton.hidden=!sceneReady||!reducedMotion.matches;
    motionButton.textContent=signMotionEnabled?'Stop sign loop':'Animate sign';
    motionButton.setAttribute('aria-pressed',String(signMotionEnabled));
  }
  function sendMotionChoice(){
    sceneFrame.contentWindow?.postMessage({type:'spirit-menu-motion',enabled:signMotionEnabled},location.origin);
  }
  motionButton.addEventListener('click',()=>{signMotionEnabled=!signMotionEnabled;syncMotionControl();sendMotionChoice();});
  reducedMotion.addEventListener('change',()=>{
    if(reducedMotion.matches){signMotionEnabled=false;sendMotionChoice();}
    syncMotionControl();
  });
  function syncSceneVisibility(){
    sceneFrame.contentWindow?.postMessage({type:'spirit-menu-visibility',visible:!document.hidden&&!dialog.open},location.origin);
  }
  function frameStreet(){
    // The live 3D camera frames the sign or school inside the actual viewport.
    // Do not stretch or scroll an oversized movie-shaped iframe.
    sceneStage.scrollLeft=0;
    sceneFrame.contentWindow?.postMessage({type:'spirit-menu-view',view:streetView},location.origin);
  }
  streetViews.forEach(button=>button.addEventListener('click',()=>{
    streetView=button.dataset.streetView;
    streetViews.forEach(item=>item.setAttribute('aria-pressed',String(item===button)));
    frameStreet();
  }));
  let frame = contentFrame;
  let radioPromise;
  function radioReady(){
    if(!radioPromise)radioPromise=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{radioPromise=null;reject(new Error('Radio did not load. Try again.'));},18000);
      radioFrame.addEventListener('load',()=>{const api=radioFrame.contentWindow?.SnowberryRadio;if(api){clearTimeout(timer);api.setVisible(false);resolve(api);}}, {once:true});
      radioFrame.src='radio-snowberry.html?v=title-motion-13';
    });
    return radioPromise;
  }
  window.MenuRadioUI={ready:radioReady,open:()=>openPage(links.find(link=>link.dataset.destination==='radio'))};
  const status = document.getElementById('destination-status');
  const back = document.getElementById('back-to-menu');
  const navigation = document.getElementById('destination-menu');
  let sourceLink = null;
  let pendingDestination = null;
  let openSequence = 0;
  let loadTimer = 0;
  let routeTimer = 0;

  function closePage() {
    openSequence++;
    clearTimeout(loadTimer);
    clearTimeout(routeTimer);
    dialog.close();
    navigation.open = false;
    contentFrame.src = 'about:blank'; // Unload destination video/WebGL; radio is the shared corner player.
    radioFrame.contentWindow?.SnowberryRadio?.setVisible(false);
    pendingDestination = null;
    syncSceneVisibility();
    if(sceneReady)sceneFrame.focus();
    else if (sourceLink) sourceLink.focus();
  }

  function destinationUrl(link){
    if(link.dataset.destination!=='play'||!sceneReady)return link.getAttribute('href');
    const url=new URL(link.getAttribute('href'),location.href);
    const rect=sceneFrame.getBoundingClientRect();
    const projected=sceneFrame.contentWindow?.SIDEBAR_STUDY?.getPortalBounds?.();
    const circle=projected&&[projected.x,projected.y,projected.radius].every(Number.isFinite)
      ? projected : {x:rect.width*.31,y:rect.height*.30,radius:rect.width*.13};
    // The launcher measures centre against width/height, and radius against
    // the shorter viewport side. Frame offsets include mobile street panning.
    url.searchParams.set('cx',((rect.left+circle.x)/innerWidth).toFixed(6));
    url.searchParams.set('cy',((rect.top+circle.y)/innerHeight).toFixed(6));
    url.searchParams.set('r',(circle.radius/Math.min(innerWidth,innerHeight)).toFixed(6));
    return url.href;
  }

  function openPage(link) {
    if(!link)return;
    if(link.dataset.destination!=='play'&&link.dataset.destination!=='intro')return; // Public GitHub copy: other sections stay closed.
    if(link.dataset.destination==='radio'){location.href=RADIO_SITE;return;}
    sourceLink = link;
    pendingDestination = link.dataset.destination;
    frame=pendingDestination==='radio'?radioFrame:contentFrame;
    contentFrame.hidden=frame!==contentFrame;
    radioFrame.hidden=frame!==radioFrame;
    dialog.dataset.destination = pendingDestination;
    navigation.open = false;
    delete dialog.dataset.loaded;
    const sequence = ++openSequence;
    clearTimeout(loadTimer);
    clearTimeout(routeTimer);
    document.getElementById('destination-title').textContent = link.getAttribute('aria-label');
    frame.title = link.getAttribute('aria-label') + ' · Spirit Striker';
    status.textContent = 'Opening ' + link.getAttribute('aria-label') + '…';
    status.hidden = false;
    if(pendingDestination==='radio')radioReady().then(api=>{if(dialog.open&&pendingDestination==='radio'){api.setVisible(true);status.hidden=true;clearTimeout(loadTimer);dialog.dataset.loaded='radio';}}).catch(e=>{status.textContent=e.message;status.hidden=false;});
    else frame.src = destinationUrl(link);
    dialog.showModal();
    syncSceneVisibility();
    if (pendingDestination !== 'shop') navigation.querySelector('summary').focus();
    loadTimer = setTimeout(() => {
      if (sequence !== openSequence || !dialog.open) return;
      status.textContent = 'Still loading. You can reload this page or return to the menu.';
      status.hidden = false;
    }, 18000);
  }

  links.forEach(link => {
    link.setAttribute('role','link');
    link.addEventListener('pointerenter', () => { note.textContent = link.dataset.note; });
    link.addEventListener('focus', () => { note.textContent = link.dataset.note; });
    link.addEventListener('click', event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      openPage(link);
    });
  });
  menu.addEventListener('keydown', event => {
    const index = links.indexOf(document.activeElement);
    if (index < 0) return;
    let next;
    if (event.key === 'ArrowDown') next = (index + 1) % links.length;
    else if (event.key === 'ArrowUp') next = (index + links.length - 1) % links.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = links.length - 1;
    else return;
    event.preventDefault();
    links[next].focus();
  });
  back.addEventListener('click', closePage);
  document.getElementById('reload-page').addEventListener('click', () => {
    if (sourceLink) openPage(sourceLink);
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); closePage(); });
  addEventListener('message', event => {
    if(event.source===sceneFrame.contentWindow&&event.origin===location.origin){
      if(event.data?.type==='spirit-menu-ready'){
        sceneReady=true;
        document.body.classList.add('menu-scene-ready');
        fallback.inert=true;
        sceneFrame.removeAttribute('aria-hidden');
        sceneFrame.removeAttribute('tabindex');
        frameStreet();
        syncSceneVisibility();
        syncMotionControl();
        if(reducedMotion.matches)sendMotionChoice();
        if(fromIntro)sceneFrame.contentWindow?.postMessage({type:'spirit-menu-arrival'},location.origin);
        arrival.open();
      }else if(event.data?.type==='spirit-menu-select'){
        const link=links.find(item=>item.dataset.destination===event.data.destination);
        if(link)openPage(link);
      }
      return;
    }
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data && event.data.type === 'spirit-strikers-close'){
      const wasIntro = dialog.dataset.destination === 'intro'; closePage();
      if (wasIntro && sceneReady){ arrival.again(); sceneFrame.contentWindow?.postMessage({type:'spirit-menu-arrival'},location.origin); }   // the replayed intro hands back the same way
    }
  });
  contentFrame.addEventListener('load', () => {
    if(frame!==contentFrame)return;
    if (!dialog.open || !pendingDestination) return;
    const sequence = openSequence;
    function prepareDestination() { try {
      if (sequence !== openSequence || !dialog.open) return;
      if (frame.contentWindow.location.href === 'about:blank') return;
      status.hidden = true;
      clearTimeout(loadTimer);
      dialog.dataset.loaded = pendingDestination;
    } catch (error) {
      console.warn('Menu destination could not be prepared:', error);
      clearTimeout(loadTimer);
      status.textContent = 'This page could not open here. Try Reload, or return to the menu.';
      status.hidden = false;
    } }
    prepareDestination();
  });
  const requested = new URLSearchParams(location.search).get('section');
  const initialLink = links.find(link => link.dataset.destination === requested);
  if (initialLink) openPage(initialLink);

  addEventListener('resize',frameStreet);
  document.addEventListener('visibilitychange',syncSceneVisibility);
  sceneFrame.addEventListener('load',syncSceneVisibility);
  frameStreet();
})();
