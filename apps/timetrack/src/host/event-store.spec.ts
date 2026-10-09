import { describe, expect, it } from 'vitest';
import { reviveCursor, toStoredCursor } from './event-store';

describe('the stored agent-log cursor', () => {
  it('keeps the parse rules a log was read under across a write and a read', () => {
    const cursor = { id: 'log-a', nextLine: 12, parserVersion: 2, session: { titleIsCustom: true } };

    expect(reviveCursor(toStoredCursor(cursor, 'agent-session'))).toEqual(cursor);
  });

  it('keeps the parse rules of a cursor that holds no session state', () => {
    const cursor = { id: 'log-a', nextLine: 12, parserVersion: 2 };

    expect(reviveCursor(toStoredCursor(cursor, 'agent-session'))).toEqual(cursor);
  });

  it('reads a row written before the parse rules were recorded as carrying none', () => {
    const revived = reviveCursor({
      ...toStoredCursor({ id: 'log-a', nextLine: 12 }, 'agent-session'),
      sessionJson: '{"sessionId":"s-1"}',
    });

    expect(revived.parserVersion).toBeUndefined();
    expect(revived.session?.sessionId).toBe('s-1');
  });
});
