import { describe, expect, it } from 'vitest';
import {
  CallNaming,
  callDurationBand,
  callFeaturesOf,
  callNamingKey,
  matchCallNaming,
  rememberCallNaming,
} from './call-naming';

const at = (hour: number, minute = 0) => new Date(2026, 7, 10, hour, minute);

const features = (overrides: Partial<ReturnType<typeof callFeaturesOf>> = {}) => ({
  ...callFeaturesOf({ appId: 'com.hnc.Discord', from: at(9, 40), to: at(10, 10), after: 'series-mome' }),
  ...overrides,
});

const naming = (overrides: Partial<CallNaming> = {}): CallNaming => ({
  ...features(),
  issueKey: 'ABC-1',
  label: 'Open Room #1',
  createdAt: at(9),
  ...overrides,
});

describe('callDurationBand', () => {
  it('puts two lengths of the same weekly call in one band', () => {
    expect(callDurationBand(22 * 60_000)).toBe(callDurationBand(28 * 60_000));
  });

  it('names the band a settings list can show', () => {
    expect(callDurationBand(5 * 60_000)).toBe('0-15');
    expect(callDurationBand(45 * 60_000)).toBe('30-60');
    expect(callDurationBand(4 * 60 * 60_000)).toBe('120+');
  });
});

describe('callFeaturesOf', () => {
  it('lowercases the application and reads the local weekday and start minute', () => {
    const read = callFeaturesOf({ appId: '  Com.HNC.Discord ', from: at(9, 40), to: at(10, 10) });

    expect(read.appId).toBe('com.hnc.discord');
    expect(read.weekday).toBe(at(9, 40).getDay());
    expect(read.startMinute).toBe(9 * 60 + 40);
    expect(read.after).toBeUndefined();
  });
});

describe('matchCallNaming', () => {
  it('names a call that repeats after the same meeting', () => {
    const found = matchCallNaming({ features: features(), namings: [naming()] });

    expect(found?.naming.issueKey).toBe('ABC-1');
    expect(found?.match).toBe('likely');
  });

  it('still names it when the call ran longer than the week it was named in', () => {
    const longer = features({ ...callFeaturesOf({ appId: 'com.hnc.Discord', from: at(9, 40), to: at(11) }) });
    const found = matchCallNaming({ features: { ...longer, after: 'series-mome' }, namings: [naming()] });

    expect(found?.naming.issueKey).toBe('ABC-1');
    expect(found?.match).toBe('likely');
  });

  it('never names a call in another application', () => {
    const other = features({ appId: 'com.google.chrome' });

    expect(matchCallNaming({ features: other, namings: [naming()] })).toBeUndefined();
  });

  it('never names a call that followed something else', () => {
    const elsewhere = features({ after: 'series-other' });

    expect(matchCallNaming({ features: elsewhere, namings: [naming()] })).toBeUndefined();
  });

  it('never names a call that followed nothing', () => {
    const alone = features({ after: undefined });

    expect(matchCallNaming({ features: alone, namings: [naming()] })).toBeUndefined();
  });

  it('names a call that always stands alone from the weekday, the length and the clock', () => {
    const standing = naming({ after: undefined, issueKey: 'ABC-3' });
    const found = matchCallNaming({ features: features({ after: undefined }), namings: [standing] });

    expect(found?.naming.issueKey).toBe('ABC-3');
    expect(found?.match).toBe('likely');
  });

  it('names nothing on the weekday alone', () => {
    const standing = naming({ after: undefined, durationBand: '120+', startMinute: 18 * 60 });

    expect(matchCallNaming({ features: features({ after: undefined }), namings: [standing] })).toBeUndefined();
  });

  it('separates two records that score the same by the clock', () => {
    const morning = naming({ issueKey: 'ABC-1', startMinute: 9 * 60 + 45, durationBand: '120+' });
    const evening = naming({ issueKey: 'ABC-2', startMinute: 10 * 60 + 5, durationBand: '120+' });
    const found = matchCallNaming({ features: features({ startMinute: 9 * 60 + 40 }), namings: [evening, morning] });

    expect(found?.naming.issueKey).toBe('ABC-1');
  });
});

describe('rememberCallNaming', () => {
  it('replaces the answer for the same features and keeps the rest', () => {
    const other = naming({ appId: 'com.google.chrome', issueKey: 'ABC-9' });
    const written = rememberCallNaming({
      namings: [other, naming()],
      features: features(),
      issueKey: ' abc-2 ',
      label: 'Open Room #1',
      at: at(12),
    });

    expect(written).toHaveLength(2);
    expect(written.find((entry) => callNamingKey(entry) === callNamingKey(features()))?.issueKey).toBe('ABC-2');
    expect(written).toContain(other);
  });
});
