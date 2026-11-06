// ==UserScript==
// @name         Cat-ify
// @namespace    https://github.com/monisukateazzi/cat-ify
// @version      1.0.0
// @description  Replace all images on a webpage with adorable cat images from placecats.com.
// @author       Moni
// @match        *://*/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==


(function () {
  'use strict';

  const CAT_API = 'https://placecats.com';
  const DEFAULT_SIZE = { w: 300, h: 200 };
  const MIN_SIZE = 16; 
  const DONE_ATTR = 'data-catified';

  const style = document.createElement('style');
  style.textContent = `
    img[${DONE_ATTR}] {
      border: 3px dashed #ff69b4 !important;
      border-radius: 8px !important;
      box-sizing: border-box !important;
      object-fit: cover !important;
      transition: transform 0.2s ease;
    }
    img[${DONE_ATTR}]:hover {
      transform: rotate(-2deg) scale(1.03);
    }
  `;
  document.head.appendChild(style);

  function getSize(img) {
    const rect = img.getBoundingClientRect();
    let w = Math.round(rect.width || img.naturalWidth || parseInt(img.getAttribute('width'), 10) || 0);
    let h = Math.round(rect.height || img.naturalHeight || parseInt(img.getAttribute('height'), 10) || 0);

    if (!w && !h) return { ...DEFAULT_SIZE };
    if (!w) w = Math.round(h * 1.5);
    if (!h) h = Math.round(w / 1.5);
    return { w, h };
  }

  function catify(img) {
    if (img.hasAttribute(DONE_ATTR)) return;

    const { w, h } = getSize(img);
    if (w < MIN_SIZE || h < MIN_SIZE) return;

    img.style.width = w + 'px';
    img.style.height = h + 'px';

    img.removeAttribute('srcset');
    img.removeAttribute('sizes');
    const picture = img.closest('picture');
    if (picture) picture.querySelectorAll('source').forEach((s) => s.remove());

    img.setAttribute(DONE_ATTR, 'true');
    img.loading = 'eager';
    img.src = `${CAT_API}/${w}/${h}`;
    img.alt = 'Catified image!';
  }

  function catifyAll(root = document) {
    root.querySelectorAll('img').forEach(catify);
  }

  catifyAll();


  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'IMG') catify(node);
        else catifyAll(node);
      });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();