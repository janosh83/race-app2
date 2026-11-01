// Coordinates typed or pasted by an admin, e.g. from Mapy.com
// ("50.0755N, 14.4378E"), Google Maps ("50.0755, 14.4378") or with decimal
// commas ("50,0755 14,4378"). Returns { latitude, longitude } or null.
export function parseCoordinates(text) {
  if (typeof text !== 'string') return null;
  const input = text.trim().toUpperCase();
  if (!input) return null;

  // A number with an optional hemisphere letter before or after it.
  const pattern = /([NSEW])?\s*(-?\d+(?:[.,]\d+)?)\s*°?\s*([NSEW])?/g;
  // With decimal commas, a comma between the two numbers needs a space after
  // it to be a separator ("50,1 14,2" or "50,1, 14,2"); "50.1,14.2" works too.
  const parts = [...input.matchAll(pattern)]
    .map(([, before, number, after]) => ({ value: Number(number.replace(',', '.')), letter: before || after || null }));
  if (parts.length !== 2 || parts.some(part => !Number.isFinite(part.value))) return null;

  let [first, second] = parts;
  // "14.4378E 50.0755N": put latitude first when the letters say so.
  if ((first.letter === 'E' || first.letter === 'W') && (second.letter === 'N' || second.letter === 'S')) {
    [first, second] = [second, first];
  }
  if (first.letter === 'E' || first.letter === 'W' || second.letter === 'N' || second.letter === 'S') return null;

  const latitude = first.letter === 'S' ? -Math.abs(first.value) : first.value;
  const longitude = second.letter === 'W' ? -Math.abs(second.value) : second.value;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
}

// Six decimals is about 10 cm: plenty, and the same text parses back.
export function formatCoordinates(latitude, longitude) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return '';
  const round = (value) => String(Number(value.toFixed(6)));
  return `${round(latitude)}, ${round(longitude)}`;
}
