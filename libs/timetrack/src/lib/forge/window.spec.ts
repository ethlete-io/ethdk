import { describe, expect, it } from 'vitest';
import { FORGE_READ_MAX_WINDOW_MS, FORGE_READ_OVERLAP_MS, forgeReadWindow } from './window';

const AT = new Date('2026-10-09T12:00:00.000Z');

describe('forgeReadWindow', () => {
  it('reads thirty days when nothing of the source is stored', () => {
    expect(forgeReadWindow({ at: AT, newestStored: null })).toEqual({
      from: new Date(AT.getTime() - FORGE_READ_MAX_WINDOW_MS),
      to: AT,
      coveredThrough: null,
    });
  });

  it('resumes a day before the newest stored event, however recently the app started', () => {
    const newestStored = new Date('2026-10-09T08:00:00.000Z');

    expect(forgeReadWindow({ at: AT, newestStored })).toEqual({
      from: new Date(newestStored.getTime() - FORGE_READ_OVERLAP_MS),
      to: AT,
      coveredThrough: newestStored,
    });
  });

  it('reaches back to a week-old newest event, so the days the app was closed still arrive', () => {
    const newestStored = new Date('2026-10-02T08:00:00.000Z');

    expect(forgeReadWindow({ at: AT, newestStored }).from).toEqual(
      new Date(newestStored.getTime() - FORGE_READ_OVERLAP_MS),
    );
  });

  it('never reaches back more than thirty days', () => {
    const newestStored = new Date('2026-06-01T08:00:00.000Z');

    expect(forgeReadWindow({ at: AT, newestStored }).from).toEqual(new Date(AT.getTime() - FORGE_READ_MAX_WINDOW_MS));
  });

  it('never starts later than a day before now, even when the newest event lies ahead of it', () => {
    expect(forgeReadWindow({ at: AT, newestStored: new Date('2026-10-10T08:00:00.000Z') }).from).toEqual(
      new Date(AT.getTime() - FORGE_READ_OVERLAP_MS),
    );
  });
});
