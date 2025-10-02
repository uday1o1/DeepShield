export function setupYouTubeNavigationHooks(onChange) {
  document.addEventListener("yt-navigate-finish", onChange, true);

  const _push = history.pushState;
  const _replace = history.replaceState;
  history.pushState = function() { const r = _push.apply(this, arguments); queueMicrotask(onChange); return r; };
  history.replaceState = function() { const r = _replace.apply(this, arguments); queueMicrotask(onChange); return r; };

  const mo = new MutationObserver(() => onChange());
  mo.observe(document.documentElement, { childList: true, subtree: true });
}
