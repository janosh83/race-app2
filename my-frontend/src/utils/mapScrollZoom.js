// Leaflet zooms on every mouse wheel turn over the map, which hijacks page
// scrolling. With this, the wheel scrolls the page and Ctrl + wheel (⌘ on a
// Mac) zooms; a plain wheel over the map briefly shows `hintText`. Touch
// pinch-zoom is unaffected. Returns a cleanup function.
export const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

export function requireModifierToScrollZoom(map, hintText) {
  const container = map.getContainer?.();
  if (!container) return () => {};
  const hint = document.createElement('div');
  hint.className = 'map-scroll-hint';
  hint.textContent = hintText;
  Object.assign(hint.style, {
    position: 'absolute',
    inset: '0',
    zIndex: '1000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    textAlign: 'center',
    background: 'rgba(0, 0, 0, 0.45)',
    color: '#fff',
    fontSize: '1.05rem',
    pointerEvents: 'none',
    opacity: '0',
    transition: 'opacity 0.2s',
  });
  container.appendChild(hint);

  let hideTimer = null;
  // Capture phase on the container runs before Leaflet's own wheel handler.
  const onWheel = (event) => {
    if (event.ctrlKey || event.metaKey) {
      hint.style.opacity = '0';
      return; // Leaflet zooms and prevents the browser's page zoom.
    }
    event.stopPropagation();
    hint.style.opacity = '1';
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => { hint.style.opacity = '0'; }, 1200);
  };
  container.addEventListener('wheel', onWheel, { capture: true });

  return () => {
    clearTimeout(hideTimer);
    container.removeEventListener('wheel', onWheel, { capture: true });
    hint.remove();
  };
}
