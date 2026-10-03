// Prepared by: Codex. Reader routing on the GitHub Pages collection.
(() => {
  const backMenu = document.getElementById('back-menu');
  if (window.parent !== window) backMenu.addEventListener('click', event => { event.preventDefault(); window.parent.postMessage({type:'spirit-strikers-close'}, location.origin); });
  const sections = [...document.querySelectorAll('.collection')];
  const links = [...document.querySelectorAll('[data-section]')];
  const reader = document.getElementById('reader');
  const frame = document.getElementById('book-frame');
  const title = document.getElementById('reader-title');
  const external = document.getElementById('external-reader');
  let returnFocus = null;
  function select(id) {
    if (!sections.some(s => s.id === id)) id = 'books';
    sections.forEach(s => s.hidden = s.id !== id);
    links.forEach(a => { a.classList.toggle('active', a.dataset.section === id); a.setAttribute('aria-current', a.dataset.section === id ? 'page' : 'false'); });
  }
  links.forEach(a => a.addEventListener('click', () => select(a.dataset.section)));
  addEventListener('hashchange', () => select(location.hash.slice(1)));
  select(location.hash.slice(1));
  function close() {
    reader.hidden = true; document.body.classList.remove('reading'); frame.src = 'about:blank';
    returnFocus?.focus();
  }
  document.getElementById('close-reader').addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !reader.hidden) close(); });
  document.querySelectorAll('[data-pdf]').forEach(button => button.addEventListener('click', () => {
    if (button.dataset.locked === 'true') { window.open('https://spiritstriker.app/library.html', '_blank', 'noopener'); return; }
    returnFocus = button;
    const url = new URL('https://spiritstriker.app/flipbook.html');
    url.searchParams.set('pdf', button.dataset.pdf);
    url.searchParams.set('title', button.dataset.title);
    title.textContent = button.dataset.title; external.href = url.href;
    frame.src = url.href; reader.hidden = false; document.body.classList.add('reading');
    document.getElementById('close-reader').focus();
  }));
  addEventListener('message', e => {
    if (e.origin === 'https://spiritstriker.app' && e.source === frame.contentWindow && e.data === 'flipbook-close') close();
  });
})();
