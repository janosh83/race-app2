import { getNavigationTarget, openNavigationTarget } from './navigation';

describe('navigation utils', () => {
  test('returns null for invalid coordinates', () => {
    expect(getNavigationTarget({ latitude: '', longitude: 14.4 })).toBeNull();
    expect(getNavigationTarget({ latitude: 50.1, longitude: null })).toBeNull();
  });

  test('builds Apple Maps directions URL for iOS', () => {
    const target = getNavigationTarget(
      { latitude: 50.123456, longitude: 14.654321, title: 'Finish' },
      { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)' }
    );

    expect(target).toEqual({
      url: 'https://maps.apple.com/?daddr=50.123456%2C14.654321&dirflg=d&q=Finish',
      launchMode: 'same-tab',
    });
  });

  test('builds geo URL for Android', () => {
    const target = getNavigationTarget(
      { latitude: 50.123456, longitude: 14.654321, title: 'Checkpoint 1' },
      { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }
    );

    expect(target).toEqual({
      url: 'geo:0,0?q=50.123456%2C14.654321(Checkpoint%201)',
      launchMode: 'same-tab',
    });
  });

  test('builds desktop web directions URL', () => {
    const target = getNavigationTarget(
      { latitude: 50.123456, longitude: 14.654321 },
      { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    );

    expect(target).toEqual({
      url: 'https://www.google.com/maps/dir/?api=1&destination=50.123456%2C14.654321&travelmode=driving',
      launchMode: 'new-tab',
    });
  });

  test('opens same-tab targets through location', () => {
    const location = { href: '' };

    const opened = openNavigationTarget(
      { latitude: 50.1, longitude: 14.1, title: 'Bivak 1' },
      {
        userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
        location,
      }
    );

    expect(opened).toBe(true);
    expect(location.href).toBe('geo:0,0?q=50.1%2C14.1(Bivak%201)');
  });

  test('opens desktop targets in a new tab', () => {
    const open = vi.fn();

    const opened = openNavigationTarget(
      { latitude: 50.1, longitude: 14.1, title: 'Bivak 1' },
      {
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        open,
      }
    );

    expect(opened).toBe(true);
    expect(open).toHaveBeenCalledWith(
      'https://www.google.com/maps/dir/?api=1&destination=50.1%2C14.1&travelmode=driving',
      '_blank',
      'noopener,noreferrer'
    );
  });
});