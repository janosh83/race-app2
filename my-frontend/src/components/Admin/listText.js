// The start of a description as plain text for a one-line list preview:
// tags dropped, whitespace collapsed. Never rendered as HTML.
export function plainExcerpt(html, maxLength = 140) {
  if (!html) return '';
  const text = String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}
