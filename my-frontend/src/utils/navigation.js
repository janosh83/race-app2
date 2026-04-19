function normalizeCoordinate(value) {
  if (value == null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getNavigationTarget(point, runtime = {}) {
  const latitude = normalizeCoordinate(point?.latitude ?? point?.lat);
  const longitude = normalizeCoordinate(point?.longitude ?? point?.lng);

  if (latitude == null || longitude == null) {
    return null;
  }

  const userAgent = runtime.userAgent ?? globalThis?.navigator?.userAgent ?? '';
  const label = String(point?.label ?? point?.title ?? point?.name ?? '').trim();
  const coordinatePair = `${latitude},${longitude}`;
  const geoQuery = encodeURIComponent(label ? `${coordinatePair}(${label})` : coordinatePair);

  if (/iPad|iPhone|iPod/i.test(userAgent)) {
    const search = new URLSearchParams({
      daddr: coordinatePair,
      dirflg: 'd',
    });
    if (label) {
      search.set('q', label);
    }

    return {
      url: `https://maps.apple.com/?${search.toString()}`,
      launchMode: 'same-tab',
    };
  }

  if (/Android/i.test(userAgent)) {
    return {
      url: `geo:0,0?q=${geoQuery}`,
      launchMode: 'same-tab',
    };
  }

  const search = new URLSearchParams({
    api: '1',
    destination: coordinatePair,
    travelmode: 'driving',
  });

  return {
    url: `https://www.google.com/maps/dir/?${search.toString()}`,
    launchMode: 'new-tab',
  };
}

export function openNavigationTarget(point, runtime = {}) {
  const target = getNavigationTarget(point, runtime);
  if (!target) {
    return false;
  }

  const locationRef = runtime.location ?? globalThis?.window?.location;
  const openRef = runtime.open ?? globalThis?.window?.open;

  if (target.launchMode === 'new-tab' && typeof openRef === 'function') {
    openRef(target.url, '_blank', 'noopener,noreferrer');
    return true;
  }

  if (locationRef) {
    locationRef.href = target.url;
    return true;
  }

  return false;
}