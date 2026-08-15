import { describe, expect, it } from 'vitest';
import { CollectedEvent, PresenceEvent } from '../model/event';
import { pauseWindows, pausedMs } from './pauses';

const DAY = { from: new Date('2026-08-13T00:00:00Z'), to: new Date('2026-08-14T00:00:00Z') };

const presence = (kind: PresenceEvent['kind'], at: string): CollectedEvent => ({
  at: new Date(at),
  source: 'idle',
  kind,
});

describe('pauseWindows', () => {
  it('pairs a pause with the resume that ended it', () => {
    const windows = pauseWindows({
      events: [presence('pause-start', '2026-08-13T10:00:00Z'), presence('pause-end', '2026-08-13T10:30:00Z')],
      window: DAY,
    });

    expect(windows).toEqual([{ from: new Date('2026-08-13T10:00:00Z'), to: new Date('2026-08-13T10:30:00Z') }]);
  });

  it('reads a resume with nothing open as a pause that started before the window', () => {
    const windows = pauseWindows({ events: [presence('pause-end', '2026-08-13T09:00:00Z')], window: DAY });

    expect(windows).toEqual([{ from: DAY.from, to: new Date('2026-08-13T09:00:00Z') }]);
  });

  it('cuts a pause that is still running off at `through`, never at the end of the day', () => {
    const windows = pauseWindows({
      events: [presence('pause-start', '2026-08-13T09:00:00Z')],
      window: DAY,
      through: new Date('2026-08-13T11:00:00Z'),
    });

    expect(windows).toEqual([{ from: new Date('2026-08-13T09:00:00Z'), to: new Date('2026-08-13T11:00:00Z') }]);
  });

  it('runs an open pause to the end of the window when no `through` is given', () => {
    const windows = pauseWindows({ events: [presence('pause-start', '2026-08-13T09:00:00Z')], window: DAY });

    expect(windows[0]?.to).toEqual(DAY.to);
  });

  it('clips a pause that reaches past the window it was read for', () => {
    const windows = pauseWindows({
      events: [presence('pause-start', '2026-08-12T22:00:00Z'), presence('pause-end', '2026-08-13T01:00:00Z')],
      window: DAY,
    });

    expect(windows).toEqual([{ from: DAY.from, to: new Date('2026-08-13T01:00:00Z') }]);
  });

  it('keeps every pause of a day apart', () => {
    const windows = pauseWindows({
      events: [
        presence('pause-start', '2026-08-13T09:00:00Z'),
        presence('pause-end', '2026-08-13T09:15:00Z'),
        presence('pause-start', '2026-08-13T14:00:00Z'),
        presence('pause-end', '2026-08-13T14:30:00Z'),
      ],
      window: DAY,
    });

    expect(windows).toHaveLength(2);
    expect(pausedMs(windows)).toBe(45 * 60_000);
  });

  it('takes the first of two starts, so a repeated pause cannot shorten itself', () => {
    const windows = pauseWindows({
      events: [
        presence('pause-start', '2026-08-13T09:00:00Z'),
        presence('pause-start', '2026-08-13T09:20:00Z'),
        presence('pause-end', '2026-08-13T09:30:00Z'),
      ],
      window: DAY,
    });

    expect(windows).toEqual([{ from: new Date('2026-08-13T09:00:00Z'), to: new Date('2026-08-13T09:30:00Z') }]);
  });

  it('ignores the presence events the idle notifier produces', () => {
    const windows = pauseWindows({
      events: [presence('idle-start', '2026-08-13T09:00:00Z'), presence('lock', '2026-08-13T10:00:00Z')],
      window: DAY,
    });

    expect(windows).toEqual([]);
  });

  it('drops a pause that ends where it started', () => {
    const windows = pauseWindows({
      events: [presence('pause-start', '2026-08-13T09:00:00Z'), presence('pause-end', '2026-08-13T09:00:00Z')],
      window: DAY,
    });

    expect(windows).toEqual([]);
  });
});
