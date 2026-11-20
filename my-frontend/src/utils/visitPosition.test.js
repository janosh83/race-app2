import { assessVisitPosition, POSITION_THRESHOLD_KM } from './visitPosition';

describe('assessVisitPosition', () => {
  test('flags a visit without any position as missing', () => {
    expect(assessVisitPosition({ image_distance_km: null, user_distance_km: null }))
      .toEqual({ status: 'missing', source: null, distanceKm: null });
    expect(assessVisitPosition({})).toEqual({ status: 'missing', source: null, distanceKm: null });
  });

  test('uses the only available position', () => {
    expect(assessVisitPosition({ image_distance_km: 0.05, user_distance_km: null }))
      .toEqual({ status: 'ok', source: 'image', distanceKm: 0.05 });
    expect(assessVisitPosition({ image_distance_km: null, user_distance_km: 0.5 }))
      .toEqual({ status: 'far', source: 'user', distanceKm: 0.5 });
  });

  test('prefers the photo position when both are available', () => {
    // Device far away (logged later), photo taken at the checkpoint -> ok.
    expect(assessVisitPosition({ image_distance_km: 0.02, user_distance_km: 3 }))
      .toEqual({ status: 'ok', source: 'image', distanceKm: 0.02 });
    // Device at the checkpoint, photo taken elsewhere -> flagged.
    expect(assessVisitPosition({ image_distance_km: 1.4, user_distance_km: 0.01 }))
      .toEqual({ status: 'far', source: 'image', distanceKm: 1.4 });
  });

  test('treats exactly the threshold as ok and ignores non-numeric values', () => {
    expect(assessVisitPosition({ user_distance_km: POSITION_THRESHOLD_KM }).status).toBe('ok');
    expect(assessVisitPosition({ image_distance_km: NaN, user_distance_km: 0.1 }).source).toBe('user');
  });
});
