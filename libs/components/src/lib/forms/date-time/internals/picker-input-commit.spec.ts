import { resolvePickerCommit } from './picker-input-commit';

const INSTANT = new Date(2026, 7, 22, 14, 30);

const options = (overrides: Partial<Parameters<typeof resolvePickerCommit>[1]> = {}) => ({
  displayValue: '',
  parseError: false,
  interactive: true,
  parse: () => INSTANT,
  ...overrides,
});

describe('resolvePickerCommit', () => {
  it('skips a commit on a disabled or readonly control', () => {
    expect(resolvePickerCommit('22.08.2026', options({ interactive: false }))).toBeNull();
  });

  it('skips a commit whose text still matches the display value', () => {
    expect(resolvePickerCommit('22.08.2026', options({ displayValue: '22.08.2026' }))).toBeNull();
  });

  it('runs a commit whose text differs from the display value', () => {
    expect(resolvePickerCommit('23.08.2026', options({ displayValue: '22.08.2026' }))).toEqual({
      parsed: INSTANT,
      text: '',
    });
  });

  it('runs an erase that matches the empty display value of an unparseable field', () => {
    expect(resolvePickerCommit('', options({ parseError: true }))).toEqual({ parsed: null, text: '' });
  });

  it('clears on empty and on whitespace-only text', () => {
    expect(resolvePickerCommit('', options({ displayValue: '22.08.2026' }))).toEqual({ parsed: null, text: '' });
    expect(resolvePickerCommit('   ', options({ displayValue: '22.08.2026' }))).toEqual({ parsed: null, text: '' });
  });

  it('keeps the raw text when the parse fails', () => {
    expect(resolvePickerCommit('not a date', options({ parse: () => null }))).toEqual({
      parsed: null,
      text: 'not a date',
    });
  });

  it('drops the raw text when the parse succeeds', () => {
    expect(resolvePickerCommit('22.08.2026', options())).toEqual({ parsed: INSTANT, text: '' });
  });
});
