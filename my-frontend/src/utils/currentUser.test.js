import { initialsOf, readStoredUser } from './currentUser';

describe('initialsOf', () => {
  test('takes the first and last name initials', () => {
    expect(initialsOf('Jan Novák')).toBe('JN');
    expect(initialsOf('Jan Petr Novák')).toBe('JN');
  });

  test('handles a single name, accents and blanks', () => {
    expect(initialsOf('eva')).toBe('E');
    expect(initialsOf('  Šárka   Řeháková ')).toBe('ŠŘ');
    expect(initialsOf('')).toBe('?');
    expect(initialsOf(null)).toBe('?');
  });
});

describe('readStoredUser', () => {
  afterEach(() => localStorage.clear());

  test('returns the stored user or null', () => {
    expect(readStoredUser()).toBeNull();
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Jan' }));
    expect(readStoredUser()).toEqual({ id: 1, name: 'Jan' });
    localStorage.setItem('user', '{broken');
    expect(readStoredUser()).toBeNull();
  });
});
