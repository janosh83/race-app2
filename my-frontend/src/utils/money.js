// Registration prices are stored in the currency's minor unit (cents,
// haléře), which is what Stripe charges: 50000 CZK cents = 500 Kč.

export function centsToAmount(cents) {
  const value = Number(cents);
  return Number.isFinite(value) ? value / 100 : 0;
}

// Whole cents from an amount typed in the main unit ("500", "12.5"), or NaN.
export function amountToCents(amount) {
  if (amount === '' || amount === null || amount === undefined) return NaN;
  const value = Number(amount);
  if (!Number.isFinite(value)) return NaN;
  const cents = Math.round(value * 100);
  // More than two decimals can't be charged.
  return Math.abs(cents - value * 100) < 1e-6 ? cents : NaN;
}

// "500 Kč", "12,50 €": no decimals for whole amounts.
export function formatMoney(cents, currency, locale) {
  const amount = centsToAmount(cents);
  const code = String(currency || '').toUpperCase();
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  try {
    return new Intl.NumberFormat(locale || undefined, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(amount);
  } catch {
    return `${amount} ${code}`.trim();
  }
}
