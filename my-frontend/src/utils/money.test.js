import { amountToCents, centsToAmount, formatMoney } from './money';

describe('money', () => {
  test('converts stored cents to the main unit', () => {
    expect(centsToAmount(50000)).toBe(500);
    expect(centsToAmount(1250)).toBe(12.5);
    expect(centsToAmount(undefined)).toBe(0);
  });

  test('converts a typed amount to whole cents', () => {
    expect(amountToCents('500')).toBe(50000);
    expect(amountToCents('12.5')).toBe(1250);
    expect(amountToCents('0.07')).toBe(7);
    expect(amountToCents('19.99')).toBe(1999);
  });

  test('rejects amounts that are not money', () => {
    expect(amountToCents('')).toBeNaN();
    expect(amountToCents('abc')).toBeNaN();
    expect(amountToCents('1.005')).toBeNaN();
  });

  test('formats cents as currency, without decimals for whole amounts', () => {
    expect(formatMoney(50000, 'czk', 'en').replace(/\s/g, ' ')).toBe('CZK 500');
    expect(formatMoney(1250, 'eur', 'en')).toBe('€12.50');
  });

  test('falls back to plain text for an unknown currency code', () => {
    expect(formatMoney(50000, 'x', 'en')).toBe('500 X');
  });
});
