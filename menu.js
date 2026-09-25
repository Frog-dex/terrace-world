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
      }else if(event.data?.type==='spirit-menu-select'){
        const link=links.find(item=>item.dataset.destination===event.data.destination);
        if(link)openPage(link);
      }
      return;
    }
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data && event.data.type === 'spirit-strikers-close') closePage();
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
