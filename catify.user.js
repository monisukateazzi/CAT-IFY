// ==UserScript==
// @name         Cat-ify
// @namespace    https://github.com/monisukateazzi/cat-ify
// @version      4.0.0
// @description  Catified image, lol!
// @author       Moni
// @match        *://*/*
// @noframes
// @grant        GM_xmlhttpRequest
// @connect      cataas.com
// @connect      loremflickr.com
// @connect      placecats.com
// @connect      api.thecatapi.com
// @connect      cdn2.thecatapi.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const DONE_ATTR = 'data-catified';
  const MIN_SIZE = 16;
  const MIN_BG_SIZE = 80;
  const MAX_REAPPLY = 6;

  const rand = () => Math.random().toString(36).slice(2, 10);

  function directSources(w, h) {
    return [
      `https://cataas.com/cat?width=${w}&height=${h}&t=${rand()}`,
      `https://loremflickr.com/${w}/${h}/cat?lock=${Math.floor(Math.random() * 100000)}`,
      `https://placecats.com/${w}/${h}?r=${rand()}`,
    ];
  }

  function gmGet(url, responseType) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        responseType,
        onload: (r) => (r.status >= 200 && r.status < 300 ? resolve(r.response) : reject(new Error(r.status))),
        onerror: reject,
        ontimeout: reject,
      });
    });
  }

  async function gmDataUrl(url) {
    const blob = await gmGet(url, 'blob');
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(blob);
    });
  }

  let pool = [];
  async function nextPoolUrl() {
    if (!pool.length) {
      const text = await gmGet('https://api.thecatapi.com/v1/images/search?limit=10', 'text');
      pool = JSON.parse(text).map((d) => d.url);
    }
    return pool.pop();
  }

  const style = document.createElement('style');
  style.textContent = `
    img[${DONE_ATTR}] {
      object-fit: cover !important;
      transition: transform 0.2s ease;
    }
    img[${DONE_ATTR}]:hover { transform: rotate(-2deg) scale(1.03); }
    [${DONE_ATTR}="bg"] {
      background-size: cover !important;
      background-position: center !important;
    }
  `;
  document.head.appendChild(style);

  const mine = new WeakMap();
  const reapplied = new WeakMap();
  function setCat(img, url) {
    mine.set(img, url);
    img.src = url;
  }

  function loadCat(img, w, h, original) {
    const sources = directSources(w, h);
    let i = 0;

    const restore = () => {
      img.onerror = null;
      img.removeAttribute(DONE_ATTR);
      mine.delete(img);
      if (original.srcset) img.srcset = original.srcset;
      img.src = original.src;
    };

    const viaGM = async () => {
      try {
        const catUrl = await nextPoolUrl();
        img.onerror = restore;
        setCat(img, await gmDataUrl(catUrl));
      } catch (e) {
        restore();
      }
    };

    img.onerror = () => {
      i++;
      if (i < sources.length) setCat(img, sources[i]);
      else viaGM();
    };
    setCat(img, sources[0]);
  }

  function catify(img) {
    if (img.hasAttribute(DONE_ATTR)) return;

    const rect = img.getBoundingClientRect();
    let w = Math.round(rect.width);
    let h = Math.round(rect.height);
    const measured = w > 0 && h > 0;

    if (!measured) {
      w = Math.round(img.naturalWidth || parseInt(img.getAttribute('width'), 10) || 300);
      h = Math.round(img.naturalHeight || parseInt(img.getAttribute('height'), 10) || 200);
    }
    if (w < MIN_SIZE || h < MIN_SIZE) return;

    const original = { src: img.src, srcset: img.getAttribute('srcset') };

    if (measured) {
      img.style.width = w + 'px';
      img.style.height = h + 'px';
    }

    ['srcset', 'sizes', 'data-src', 'data-srcset', 'data-lazy-src', 'data-original'].forEach((a) =>
      img.removeAttribute(a)
    );
    const picture = img.closest('picture');
    if (picture) picture.querySelectorAll('source').forEach((s) => s.remove());

    img.setAttribute(DONE_ATTR, 'true');
    img.loading = 'eager';
    img.alt = 'Seekor kucing lucu';
    loadCat(img, w, h, original);
  }

  function catifyBackground(el) {
    if (el.hasAttribute(DONE_ATTR)) return;
    const bg = getComputedStyle(el).backgroundImage;
    if (!bg || bg === 'none' || !bg.includes('url(')) return;

    const rect = el.getBoundingClientRect();
    const w = Math.round(rect.width);
    const h = Math.round(rect.height);
    if (w < MIN_BG_SIZE || h < MIN_BG_SIZE) return;

    el.setAttribute(DONE_ATTR, 'bg');
    el.style.setProperty('background-image', `url("${directSources(w, h)[0]}")`, 'important');
  }

  function scan(root) {
    if (root.tagName === 'IMG') catify(root);
    root.querySelectorAll('img').forEach(catify);
    root.querySelectorAll('div, section, header, a, span, figure').forEach(catifyBackground);
  }

  scan(document.body);

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === 'attributes') {
        const img = m.target;
        if (img.tagName !== 'IMG' || !img.hasAttribute(DONE_ATTR) || !mine.has(img)) continue;

        if (m.attributeName === 'srcset' && img.hasAttribute('srcset')) {
          img.removeAttribute('srcset');
        } else if (m.attributeName === 'src' && img.getAttribute('src') !== mine.get(img)) {
          const n = reapplied.get(img) || 0;
          if (n < MAX_REAPPLY) {
            reapplied.set(img, n + 1);
            img.src = mine.get(img);
          }
        }
      } else {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) scan(node);
        });
      }
    }
  });
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src', 'srcset'],
  });

  console.log('[Cat-ify] aktif di', location.hostname);
  const badge = document.createElement('div');
  badge.textContent = '🐱 Cat-ify aktif';
  badge.style.cssText =
    'position:fixed;right:12px;bottom:12px;z-index:2147483647;padding:6px 12px;' +
    'background:#ff69b4;color:#fff;font:600 13px sans-serif;border-radius:999px;' +
    'box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:none;';
  document.body.appendChild(badge);
  setTimeout(() => badge.remove(), 3000);
})();
