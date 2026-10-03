import { fullness, HANDOFF_AT, sessionKey, storedSessions, TURN_LIMIT, withTurn, writeSessions } from './sessions';

const KEY = 'ethlete-studio.sessions';

describe('sessions', () => {
  afterEach(() => localStorage.clear());

  it('keys a session by CLI and slug', () => {
    expect(sessionKey({ slug: 'shop/cart', cli: 'claude' })).toBe('claude shop/cart');
  });

  it('measures fullness against the context limit', () => {
    expect(fullness(null)).toBe(0);
    expect(fullness({ id: null, tokens: 200_000, turns: [] })).toBe(1);
    expect(fullness({ id: null, tokens: 140_000, turns: [] })).toBe(HANDOFF_AT);
  });

  it('opens a session for the first turn and caps the turns', () => {
    expect(withTurn(null, { kind: 'ask', text: 'hi' })).toEqual({
      id: null,
      tokens: 0,
      turns: [{ kind: 'ask', text: 'hi' }],
    });

    let session = withTurn(null, { kind: 'note', text: '0' });

    for (let index = 1; index <= TURN_LIMIT; index++) session = withTurn(session, { kind: 'note', text: `${index}` });

    expect(session.turns).toHaveLength(TURN_LIMIT);
    expect(session.turns[0]).toEqual({ kind: 'note', text: '1' });
  });

  it('round-trips a table', () => {
    const table = {
      'claude a': { id: 'x', tokens: 5, turns: [{ kind: 'act' as const, action: 'edit', detail: 'f.ts' }] },
    };

    writeSessions(table);

    expect(storedSessions()).toEqual(table);
  });

  it('reads nothing from missing, corrupt or non-object storage', () => {
    expect(storedSessions()).toEqual({});

    localStorage.setItem(KEY, '{nope');
    expect(storedSessions()).toEqual({});

    localStorage.setItem(KEY, '42');
    expect(storedSessions()).toEqual({});
  });

  it('upgrades a bare session id and drops entries it cannot read', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: 'sid', b: 7, c: null, d: { id: 3 }, e: {} }));

    expect(storedSessions()).toEqual({
      a: { id: 'sid', tokens: 0, turns: [] },
      e: { id: null, tokens: 0, turns: [] },
    });
  });

  it('drops turns whose fields are missing', () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        a: {
          id: null,
          turns: [
            { kind: 'ask' },
            { kind: 'act', action: 'x' },
            { kind: 'say', text: 'ok' },
            { kind: 'bogus', text: '' },
            null,
          ],
        },
      }),
    );

    expect(storedSessions()['a']?.turns).toEqual([{ kind: 'say', text: 'ok' }]);
  });

  it('reads a token count that is not a finite number as zero', () => {
    localStorage.setItem(KEY, JSON.stringify({ a: { id: null, tokens: '9' } }));

    expect(storedSessions()['a']?.tokens).toBe(0);
  });
});
