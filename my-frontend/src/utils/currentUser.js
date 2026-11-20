// The logged-in user as stored at login (id, name, email, is_administrator).
export function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null');
  } catch {
    return null;
  }
}

// "Jan Novák" -> "JN", "eva" -> "E"; for the avatar circle.
export function initialsOf(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const letters = parts.length === 1 ? [parts[0]] : [parts[0], parts[parts.length - 1]];
  return letters.map(part => Array.from(part)[0].toUpperCase()).join('');
}
