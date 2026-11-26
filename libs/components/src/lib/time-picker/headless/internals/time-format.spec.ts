import { de } from 'date-fns/locale';
import { deriveTimeFormatSpec } from './time-format';

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
    expect(deriveTimeFormatSpec({ format: 'p' })).toEqual({ hourCycle: 12, showSeconds: false });
    expect(deriveTimeFormatSpec({ format: 'p', locale: de })).toEqual({ hourCycle: 24, showSeconds: false });
    expect(deriveTimeFormatSpec({ format: 'pp', locale: de })).toEqual({ hourCycle: 24, showSeconds: true });
  });
});
