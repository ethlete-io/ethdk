import { DesignQueue } from '../../host/design-queue';
import { RECENT_FAILURE_MS, failuresOf, queueLineOf } from './queue-status';

const idle: DesignQueue = { queued: 0, rendering: 0, oldestMs: null, failedTotal: 0, failed: [] };

describe('queueLineOf', () => {
  it('names the queued and rendering draws and the age of the oldest', () => {
    expect(queueLineOf({ ...idle, queued: 3, rendering: 1, oldestMs: 12400 })).toBe('3 queued · 1 rendering · 12 s');
    expect(queueLineOf({ ...idle, rendering: 2, oldestMs: 800 })).toBe('2 rendering · 0 s');
  });

  it('is empty while the queue is idle or unread', () => {
    expect(queueLineOf(idle)).toBe('');
    expect(queueLineOf(null)).toBe('');
  });
});

describe('failuresOf', () => {
  const now = Date.parse('2026-10-31T10:00:00Z');

  it('lists the recent failed shots and the frames that show an error', () => {
    const queue: DesignQueue = {
      ...idle,
      failedTotal: 2,
      failed: [
        {
          part: 'sdk/components/button',
          state: 'solid',
          status: 504,
          message: 'timed out\nstack',
          at: '2026-10-31T09:59:00Z',
        },
        {
          part: 'sdk/components/card',
          state: 'rest',
          status: 500,
          message: 'old',
          at: new Date(now - RECENT_FAILURE_MS).toISOString(),
        },
      ],
    };
    const frame = JSON.stringify(['[]', 'product=sdk&part=components%2Fmenu&state=open']);

    expect(failuresOf({ queue, failingFrames: [frame], now })).toEqual([
      'sdk/components/button · solid · 504 timed out',
      'sdk/components/menu · open · frame shows an error',
    ]);
  });
});
