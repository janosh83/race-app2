import { getCheckpointReadOnlyMessage } from './checkpointStatus';

vi.mock('../contexts/TimeContext', () => ({ formatDate: (ts) => `<${ts}>` }));

const t = (key, params) => (params ? `${key} ${params.time}` : key);

describe('getCheckpointReadOnlyMessage', () => {
  test('a visited checkpoint is read-only in any phase', () => {
    for (const state of ['SHOW_ONLY', 'POST_LOG_SHOW']) {
      expect(getCheckpointReadOnlyMessage(t, { visited: true }, { state })).toBe('map.visitLoggedReadOnly');
    }
  });

  test('before logging opens it says when it opens', () => {
    const timeInfo = { state: 'SHOW_ONLY', startLogging: 'start', endLogging: 'end' };
    expect(getCheckpointReadOnlyMessage(t, { visited: false }, timeInfo)).toBe('map.loggingOpensAt <start>');
  });

  test('after logging ended it says when it ended', () => {
    const timeInfo = { state: 'POST_LOG_SHOW', startLogging: 'start', endLogging: 'end' };
    expect(getCheckpointReadOnlyMessage(t, { visited: false }, timeInfo)).toBe('map.loggingEndedAt <end>');
  });
});
