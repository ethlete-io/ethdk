import { de } from 'date-fns/locale';
import { deriveTimeFormatSpec, generateSteppedValues, getTimeParts } from './time-format';

describe('deriveTimeFormatSpec', () => {
  it('detects a 24-hour format without seconds', () => {
    expect(deriveTimeFormatSpec({ format: 'HH:mm' })).toEqual({ hourCycle: 24, showSeconds: false });
  });

  it('detects seconds', () => {
    expect(deriveTimeFormatSpec({ format: 'HH:mm:ss' })).toEqual({ hourCycle: 24, showSeconds: true });
  });

  it('detects a 12-hour format', () => {
    expect(deriveTimeFormatSpec({ format: 'h:mm a' })).toEqual({ hourCycle: 12, showSeconds: false });
  });

  it('expands localized tokens per locale', () => {
    // 'p' is locale-defined: 12-hour in the en-US default, 24-hour in de
    expect(deriveTimeFormatSpec({ format: 'p' })).toEqual({ hourCycle: 12, showSeconds: false });
    expect(deriveTimeFormatSpec({ format: 'p', locale: de })).toEqual({ hourCycle: 24, showSeconds: false });
    expect(deriveTimeFormatSpec({ format: 'pp', locale: de })).toEqual({ hourCycle: 24, showSeconds: true });
  });
});

describe('generateSteppedValues', () => {
  it('generates stepped values below the end', () => {
    expect(generateSteppedValues({ end: 60, step: 15 })).toEqual([0, 15, 30, 45]);
  });

  it('splices an off-step selection in at its sorted position', () => {
    expect(generateSteppedValues({ end: 60, step: 15, include: 32 })).toEqual([0, 15, 30, 32, 45]);
  });

  it('does not duplicate an on-step selection', () => {
    expect(generateSteppedValues({ end: 60, step: 15, include: 30 })).toEqual([0, 15, 30, 45]);
  });

  it('ignores an include outside the generated range', () => {
    expect(generateSteppedValues({ end: 60, step: 15, include: -5 })).toEqual([0, 15, 30, 45]);
    expect(generateSteppedValues({ end: 60, step: 15, include: 60 })).toEqual([0, 15, 30, 45]);
  });
});

describe('getTimeParts', () => {
  it('splits a date into 24-hour parts', () => {
    expect(getTimeParts(new Date(2026, 6, 17, 14, 35, 57), 24)).toEqual({
      hour: 14,
      minute: 35,
      second: 57,
      period: 1,
    });
  });

  it('splits a date into 12-hour parts', () => {
    expect(getTimeParts(new Date(2026, 6, 17, 14, 35, 57), 12)).toEqual({ hour: 2, minute: 35, second: 57, period: 1 });
    expect(getTimeParts(new Date(2026, 6, 17, 0, 5, 0), 12)).toEqual({ hour: 0, minute: 5, second: 0, period: 0 });
  });
});
