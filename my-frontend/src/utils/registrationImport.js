import Papa from 'papaparse';

const FIELD_ALIASES = {
  email: ['E-mailová adresa', 'E-mail', 'Email', 'email'],
  name: ['Tvoje jméno', 'Jméno', 'Name', 'name'],
  team: ['Jméno posádky', 'Team', 'Tým', 'team', 'posádka'],
  category: ['kategorie', 'Kategorie', 'category', 'race_category'],
};

function normalizeHeaderName(value) {
  return String(value || '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase();
}

function trimCell(value) {
  return typeof value === 'string' ? value.trim() : String(value || '').trim();
}

function resolveFieldKeys(fields = []) {
  const byNormalizedHeader = new Map(fields.map((field) => [normalizeHeaderName(field), field]));

  return Object.fromEntries(
    Object.entries(FIELD_ALIASES).map(([fieldName, aliases]) => {
      const matchedKey = aliases
        .map((alias) => byNormalizedHeader.get(normalizeHeaderName(alias)))
        .find(Boolean) || null;

      return [fieldName, matchedKey];
    })
  );
}

export function parseRegistrationImportText(text) {
  const result = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    delimiter: '',
    delimitersToGuess: [',', '\t', ';', '|'],
    transformHeader: (header) => String(header || '').replace(/^\uFEFF/, '').trim(),
  });

  const resolvedKeys = resolveFieldKeys(result.meta?.fields || []);
  const rows = (result.data || [])
    .map((row) => {
      const email = trimCell(resolvedKeys.email ? row[resolvedKeys.email] : '');
      const name = trimCell(resolvedKeys.name ? row[resolvedKeys.name] : '');
      const team = trimCell(resolvedKeys.team ? row[resolvedKeys.team] : '');
      const category = trimCell(resolvedKeys.category ? row[resolvedKeys.category] : '');

      return { email, name, team, category };
    })
    .filter((row) => row.email && row.team);

  return {
    rows,
    errors: (result.errors || []).map((error) => {
      const rowNumber = typeof error.row === 'number' ? error.row + 2 : null;
      return rowNumber
        ? `Row ${rowNumber}: ${error.message}`
        : error.message;
    }),
    fields: result.meta?.fields || [],
    resolvedKeys,
  };
}