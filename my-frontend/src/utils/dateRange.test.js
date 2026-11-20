import { formatDateRange, formatShortDateTime } from './dateRange';

const now = new Date(2026, 10, 1, 12, 0);
const opts = { now, locale: 'cs-CZ' };

describe('formatShortDateTime', () => {
  it('drops seconds and the current year', () => {
    expect(formatShortDateTime(new Date(2026, 9, 28, 20, 32, 32), opts)).toBe('28. 10. 20:32');
  });

  it('keeps the year of another year', () => {
    expect(formatShortDateTime(new Date(2025, 4, 3, 9, 5), opts)).toMatch(/^3\. 5\. 2025\s09:05$/);
  });

  it('shows a dash without a date', () => {
    expect(formatShortDateTime(null, opts)).toBe('—');
  });
});

describe('formatDateRange', () => {
  it('writes both ends on different days', () => {
    expect(formatDateRange(new Date(2026, 9, 28, 20, 32), new Date(2026, 10, 5, 20, 32), opts))
      .toBe('28. 10. 20:32 – 5. 11. 20:32');
  });

  it('writes the day once within one day', () => {
    expect(formatDateRange(new Date(2026, 10, 1, 14, 0), new Date(2026, 10, 1, 18, 0), opts))
      .toBe('1. 11. 14:00 – 18:00');
  });

  it('handles a missing end', () => {
    expect(formatDateRange(new Date(2026, 10, 1, 14, 0), null, opts)).toBe('1. 11. 14:00 – —');
    expect(formatDateRange(null, null, opts)).toBe('—');
  });
});
