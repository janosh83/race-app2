// Short date ranges for admin lists, in the browser locale like the other
// admin dates: no seconds, the year only when it is not the current one, and
// the day written once when the range starts and ends on the same day,
// e.g. "28. 10. 20:32 – 5. 11. 20:32" or "1. 11. 14:00 – 18:00".
const toDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const sameDay = (a, b) => a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

export function formatShortDateTime(value, { now = new Date(), locale } = {}) {
  const date = toDate(value);
  if (!date) return '—';
  const options = { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' };
  if (date.getFullYear() !== now.getFullYear()) options.year = 'numeric';
  return date.toLocaleString(locale, options);
}

export function formatDateRange(start, end, { now = new Date(), locale } = {}) {
  const from = toDate(start);
  const to = toDate(end);
  if (!from && !to) return '—';
  if (!from || !to) {
    return `${formatShortDateTime(from, { now, locale })} – ${formatShortDateTime(to, { now, locale })}`;
  }
  const endText = sameDay(from, to)
    ? to.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
    : formatShortDateTime(to, { now, locale });
  return `${formatShortDateTime(from, { now, locale })} – ${endText}`;
}
