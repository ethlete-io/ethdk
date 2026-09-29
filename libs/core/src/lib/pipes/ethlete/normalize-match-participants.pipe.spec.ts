import { MatchListView } from '@ethlete/types';
import { normalizeMatchParticipant, normalizeMatchParticipants } from './normalize-match-participants.pipe';

const team = { type: 'team', id: 1 };
const otherTeam = { type: 'team', id: 2 };

const match = (overrides: Record<string, unknown>) =>
  ({
    status: 'published',
    round: { state: 'started' },
    home: team,
    away: otherTeam,
    ...overrides,
  }) as unknown as MatchListView;

describe('normalizeMatchParticipants', () => {
  it('returns null without a match or a resolvable match state', () => {
    expect(normalizeMatchParticipants(null)).toBeNull();
    expect(normalizeMatchParticipants(match({ status: 'created' }))).toBeNull();
  });

  it('wraps both sides as participants', () => {
    expect(normalizeMatchParticipants(match({}))).toEqual({
      home: { type: 'participant', participantType: 'team', data: team },
      away: { type: 'participant', participantType: 'team', data: otherTeam },
    });
  });
});

describe('normalizeMatchParticipant', () => {
  it('returns null without a match or a resolvable match state', () => {
    expect(normalizeMatchParticipant(null, 'home')).toBeNull();
    expect(normalizeMatchParticipant(match({ status: 'created' }), 'home')).toBeNull();
  });

  it.each(['preparing', 'started'])('marks a missing opponent as TBD while the match is %s', (status) => {
    expect(normalizeMatchParticipant(match({ status, away: null }), 'away')).toEqual({
      type: 'tbd',
      participantType: 'team',
      i18n: 'match-participant.tbd',
      text: 'TBD',
      data: null,
    });
  });

  it.each([
    ['published', {}],
    ['finished', {}],
    ['started', { isCompletedByReferee: true }],
  ])('marks a missing opponent as none once the match is %s', (status, extra) => {
    expect(normalizeMatchParticipant(match({ status, away: null, ...extra }), 'away')).toEqual({
      type: 'none',
      participantType: 'team',
      i18n: 'match-participant.none',
      text: 'No opponent',
      data: null,
    });
  });

  it('takes the participant type from the away side when home is missing', () => {
    const result = normalizeMatchParticipant(match({ home: null, away: { type: 'player' } }), 'home');

    expect(result?.participantType).toBe('player');
  });

  it('falls back to an unknown participant type when both sides are missing', () => {
    const result = normalizeMatchParticipant(match({ home: null, away: null }), 'home');

    expect(result?.participantType).toBe('unknown');
  });
});
