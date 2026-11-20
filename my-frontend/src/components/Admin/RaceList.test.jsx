import { sortRacesForAdmin } from './RaceList';

describe('sortRacesForAdmin', () => {
  it('sorts races by the end of logging, latest first, races without it last', () => {
    const races = [
      { id: 1, name: 'Spring', end_logging_at: '2026-04-10T18:00:00Z' },
      { id: 2, name: 'No dates' },
      { id: 3, name: 'Autumn', end_logging_at: '2026-10-10T18:00:00Z' },
      { id: 4, name: 'Next year', end_logging_at: '2027-05-01T18:00:00Z' },
    ];

    const order = sortRacesForAdmin(races, Date.parse('2026-11-01T12:00:00Z')).map(({ race }) => race.name);

    expect(order).toEqual(['Next year', 'Autumn', 'Spring', 'No dates']);
  });
});
