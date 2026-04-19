import { parseRegistrationImportText } from './registrationImport';

describe('registration import parser', () => {
  test('parses quoted csv values with commas', () => {
    const input = [
      'Email,Name,Team,Category',
      'alice@example.com,"Alice, Jr.","Thunder, Crew",Adventure',
    ].join('\n');

    const result = parseRegistrationImportText(input);

    expect(result.errors).toEqual([]);
    expect(result.rows).toEqual([
      {
        email: 'alice@example.com',
        name: 'Alice, Jr.',
        team: 'Thunder, Crew',
        category: 'Adventure',
      },
    ]);
  });

  test('parses tsv with czech header aliases', () => {
    const input = [
      'E-mailová adresa\tJméno\tJméno posádky\tKategorie',
      'alice@example.com\tAlice\tThunder Crew\tAdventure',
      'bob@example.com\tBob\tThunder Crew\tAdventure',
    ].join('\n');

    const result = parseRegistrationImportText(input);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[1]).toEqual({
      email: 'bob@example.com',
      name: 'Bob',
      team: 'Thunder Crew',
      category: 'Adventure',
    });
  });

  test('filters out rows missing required email or team', () => {
    const input = [
      'Email,Name,Team,Category',
      'alice@example.com,Alice,,Adventure',
      ',Bob,Thunder Crew,Adventure',
      'carol@example.com,Carol,Thunder Crew,Adventure',
    ].join('\n');

    const result = parseRegistrationImportText(input);

    expect(result.rows).toEqual([
      {
        email: 'carol@example.com',
        name: 'Carol',
        team: 'Thunder Crew',
        category: 'Adventure',
      },
    ]);
  });
});