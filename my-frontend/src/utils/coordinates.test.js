import { formatCoordinates, parseCoordinates } from './coordinates';

describe('parseCoordinates', () => {
  it.each([
    ['50.0755, 14.4378', 50.0755, 14.4378],
    ['50.0755,14.4378', 50.0755, 14.4378],
    ['50.0755 14.4378', 50.0755, 14.4378],
    ['50.0755N, 14.4378E', 50.0755, 14.4378],
    ['N 50.0755, E 14.4378', 50.0755, 14.4378],
    ['14.4378E 50.0755N', 50.0755, 14.4378],
    ['50,0755 14,4378', 50.0755, 14.4378],
    ['50,0755, 14,4378', 50.0755, 14.4378],
    ['33.9S, 18.4E', -33.9, 18.4],
    ['40.7128, -74.006', 40.7128, -74.006],
    ['  50.1°N 14.5°E ', 50.1, 14.5],
  ])('reads %s', (text, latitude, longitude) => {
    expect(parseCoordinates(text)).toEqual({ latitude, longitude });
  });

  it.each(['', 'abc', '50.1', '50.1, 14.2, 3', '95, 14', '50, 200', '14E, 50E'])('rejects %s', (text) => {
    expect(parseCoordinates(text)).toBeNull();
  });
});

describe('formatCoordinates', () => {
  it('rounds to six decimals without trailing zeros', () => {
    expect(formatCoordinates(50.123456789, 14.5)).toBe('50.123457, 14.5');
  });

  it('is empty without a position', () => {
    expect(formatCoordinates(null, 14)).toBe('');
  });

  it('parses back to the same position', () => {
    expect(parseCoordinates(formatCoordinates(50.0755, 14.4378))).toEqual({ latitude: 50.0755, longitude: 14.4378 });
  });
});
