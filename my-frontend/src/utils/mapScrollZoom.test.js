import { requireModifierToScrollZoom } from './mapScrollZoom';

describe('requireModifierToScrollZoom', () => {
  const setup = () => {
    const container = document.createElement('div');
    const inner = document.createElement('div');
    container.appendChild(inner);
    document.body.appendChild(container);
    const leafletHandler = vi.fn();
    container.addEventListener('wheel', leafletHandler); // like Leaflet's own listener
    const stop = requireModifierToScrollZoom({ getContainer: () => container }, 'Use Ctrl + scroll to zoom the map');
    return { container, inner, leafletHandler, stop };
  };

  it('keeps a plain wheel from the map and shows the hint', () => {
    const { container, inner, leafletHandler, stop } = setup();

    inner.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100 }));

    expect(leafletHandler).not.toHaveBeenCalled();
    expect(container.querySelector('.map-scroll-hint').style.opacity).toBe('1');
    stop();
    expect(container.querySelector('.map-scroll-hint')).toBeNull();
  });

  it('lets Ctrl + wheel and ⌘ + wheel through to the map', () => {
    const { inner, leafletHandler, stop } = setup();

    inner.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100, ctrlKey: true }));
    inner.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 100, metaKey: true }));

    expect(leafletHandler).toHaveBeenCalledTimes(2);
    stop();
  });
});
