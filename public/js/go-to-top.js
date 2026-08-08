/**
 * ScrollToTopButton - botón flotante "ARRIBA"
 *
 * Uso:
 *   <script src="/js/go-to-top.js"></script>
 *   <script>ScrollToTopButton.init({ text: 'ARRIBA' });</script>
 *
 * Si no llamas a init(), se monta solo (autoMount).
 * Reutiliza #goToTop si existe; si no, lo crea.
 */
(function (global) {
  'use strict';

  if (global.ScrollToTopButton && global.ScrollToTopButton.__farmav4) {
    return;
  }

  var STYLE_ID = 'scroll-to-top-button-styles-v4';
  var INSTANCE_ATTR = 'data-stt-mounted';
  var DEFAULTS = {
    text: 'ARRIBA',
    label: 'Volver arriba',
    threshold: 120,
    targetId: 'goToTop',
    selector: null,
    autoMount: true
  };

  var CSS = [
    '@keyframes stt-spin { to { transform: rotate(360deg); } }',
    'button.stt-button, button#goToTop.stt-button, .go-to-top.stt-button {',
    '  position: fixed !important;',
    '  bottom: 3rem !important;',
    '  right: 1.5rem !important;',
    '  z-index: 2147483000 !important;',
    '  display: flex !important;',
    '  height: 4.5rem !important;',
    '  width: 4.5rem !important;',
    '  align-items: center !important;',
    '  justify-content: center !important;',
    '  border-radius: 9999px !important;',
    '  border: 1px solid #99f6e4 !important;',
    '  background: #fff !important;',
    '  color: #0f766e !important;',
    '  box-shadow: 0 10px 15px -3px rgba(0,0,0,.15), 0 4px 6px -4px rgba(0,0,0,.1) !important;',
    '  cursor: pointer !important;',
    '  padding: 0 !important;',
    '  margin: 0 !important;',
    '  transition: opacity .25s ease, transform .25s ease, border-color .25s ease, background .25s ease;',
    '  opacity: 0 !important;',
    '  transform: translateY(.75rem) !important;',
    '  pointer-events: none !important;',
    '  visibility: visible !important;',
    '}',
    'button.stt-button.stt-visible, button.stt-button.show,',
    'button#goToTop.stt-button.stt-visible, button#goToTop.stt-button.show,',
    '.go-to-top.stt-button.stt-visible, .go-to-top.stt-button.show {',
    '  opacity: 1 !important;',
    '  transform: translateY(0) !important;',
    '  pointer-events: auto !important;',
    '}',
    'button.stt-button:hover {',
    '  border-color: #14b8a6 !important;',
    '  background: #f0fdfa !important;',
    '  color: #0d9488 !important;',
    '}',
    'button.stt-button .stt-ring {',
    '  position: absolute;',
    '  inset: 0.2rem;',
    '  color: rgba(15, 118, 110, .9);',
    '  animation: stt-spin 14s linear infinite;',
    '  pointer-events: none;',
    '  overflow: hidden;',
    '}',
    'button.stt-button .stt-ring svg { display: block; width: 100%; height: 100%; overflow: visible; }',
    'button.stt-button .stt-ring-text {',
    '  fill: currentColor;',
    '  font-family: system-ui, sans-serif;',
    '  font-size: 13px;',
    '  font-weight: 800;',
    '  letter-spacing: 0.1em;',
    '  text-transform: uppercase;',
    '}',
    'button.stt-button .stt-arrow {',
    '  position: relative; z-index: 10; width: 12px; height: 15px; fill: currentColor;',
    '}',
    '@media (max-width: 768px) {',
    '  button.stt-button { bottom: 1.25rem !important; right: 1.25rem !important; height: 4rem !important; width: 4rem !important; }',
    '  button.stt-button .stt-ring-text { font-size: 14px; }',
    '}'
  ].join('\n');

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  function ringMarkup(text, pathId) {
    var safe = String(text || 'ARRIBA').trim().toUpperCase() || 'ARRIBA';
    // Dos vueltas; radio interior (~38) deja micro-padding respecto al borde del botón
    var loop = safe + ' · ' + safe + ' · ';
    return (
      '<span class="stt-ring" aria-hidden="true">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">' +
      '<defs><path id="' + pathId + '" d="M50,50 m-38,0 a38,38 0 1,1 76,0 a38,38 0 1,1 -76,0" fill="none"/></defs>' +
      '<text class="stt-ring-text" font-size="13" font-weight="800" dominant-baseline="middle">' +
      '<textPath href="#' + pathId + '" startOffset="0%">' + loop + '</textPath></text>' +
      '</svg></span>'
    );
  }

  function arrowMarkup() {
    return (
      '<svg class="stt-arrow" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 27" aria-hidden="true">' +
      '<path d="M19.6,11.1c0.6-0.6,0.6-1.6-0.1-2.2l-8.5-8.5C10.8,0.2,10.4,0,10,0C9.6,0,9.2,0.2,8.9,0.5L0.5,8.9c-0.6,0.6-0.6,1.5,0,2.2c0.3,0.3,0.7,0.5,1.1,0.5c0.4,0,0.8-0.2,1.1-0.5l5.8-5.9v20.1c0,0.9,0.7,1.5,1.5,1.5c0.9,0,1.5-0.7,1.5-1.5v-20l5.9,5.8c0.3,0.3,0.7,0.5,1.1,0.5C18.9,11.5,19.3,11.4,19.6,11.1z"/>' +
      '</svg>'
    );
  }

  function getScrollY() {
    var y = window.pageYOffset || document.documentElement.scrollTop || document.body.scrollTop || 0;
    if (y > 0) return y;
    var nodes = document.querySelectorAll('.main-content, .main-content-wrapper, .sidebar-content, .container-fluid, [data-scroll-root]');
    for (var i = 0; i < nodes.length; i++) {
      if (nodes[i].scrollTop > y) y = nodes[i].scrollTop;
    }
    return y;
  }

  function resolveButton(options) {
    var el = null;
    if (options.selector) el = document.querySelector(options.selector);
    if (!el && options.targetId) el = document.getElementById(options.targetId);
    if (!el) {
      el = document.createElement('button');
      el.id = options.targetId || 'goToTop';
      el.type = 'button';
      document.body.appendChild(el);
    }
    if (!el.getAttribute('type')) el.setAttribute('type', 'button');
    return el;
  }

  function paintButton(button, options) {
    var pathId = 'stt-ring-path-' + (button.id || 'main');
    button.classList.add('stt-button', 'go-to-top');
    button.setAttribute('title', options.label);
    button.setAttribute('aria-label', options.label);
    button.innerHTML = ringMarkup(options.text, pathId) + arrowMarkup();
    button.setAttribute(INSTANCE_ATTR, '1');
  }

  function bindBehavior(button, options) {
    if (button._sttBound) return;
    button._sttBound = true;

    function onScroll() {
      var visible = getScrollY() > options.threshold;
      button.classList.toggle('stt-visible', visible);
      button.classList.toggle('show', visible);
    }

    function scrollToTop(e) {
      if (e) e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      var nodes = document.querySelectorAll('.main-content, .main-content-wrapper, .sidebar-content, [data-scroll-root]');
      for (var i = 0; i < nodes.length; i++) {
        try { nodes[i].scrollTo({ top: 0, behavior: 'smooth' }); } catch (_) { nodes[i].scrollTop = 0; }
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('scroll', onScroll, { passive: true, capture: true });
    button.addEventListener('click', scrollToTop);
    onScroll();
    // Re-check after layout/fonts
    setTimeout(onScroll, 300);
    setTimeout(onScroll, 1000);

    button._sttDestroy = function () {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('scroll', onScroll, true);
      button.removeEventListener('click', scrollToTop);
      button._sttBound = false;
    };
  }

  function init(userOptions) {
    var options = {};
    var key;
    for (key in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, key)) options[key] = DEFAULTS[key];
    }
    if (userOptions) {
      for (key in userOptions) {
        if (Object.prototype.hasOwnProperty.call(userOptions, key)) options[key] = userOptions[key];
      }
    }

    ensureStyles();
    var button = resolveButton(options);
    paintButton(button, options);
    bindBehavior(button, options);
    return button;
  }

  function destroy(selectorOrId) {
    var el =
      typeof selectorOrId === 'string'
        ? document.querySelector(selectorOrId) || document.getElementById(selectorOrId)
        : selectorOrId || document.getElementById(DEFAULTS.targetId);
    if (!el) return;
    if (typeof el._sttDestroy === 'function') el._sttDestroy();
    el.remove();
  }

  var api = {
    init: init,
    destroy: destroy,
    defaults: DEFAULTS,
    __farmav4: true
  };

  global.ScrollToTopButton = api;

  function autoMount() {
    if (document.querySelector('[' + INSTANCE_ATTR + ']')) return;
    init({ text: 'ARRIBA' });
  }

  if (DEFAULTS.autoMount) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', autoMount);
    } else {
      autoMount();
    }
  }
})(typeof window !== 'undefined' ? window : this);
