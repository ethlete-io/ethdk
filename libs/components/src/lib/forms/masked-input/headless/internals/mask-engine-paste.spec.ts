import { applyMaskEdit } from './mask-engine';
import { compilePatternMask } from './pattern-mask';

const date = compilePatternMask('00-00-0000');

describe('applyMaskEdit - paste and cut', () => {
  it('formats a pasted value that already carries the literals', () => {
    const result = applyMaskEdit({
      spec: date,
      previousRaw: '',
      text: '31-12-2024',
      caret: 10,
      inputType: 'insertFromPaste',
    });

    expect(result).toEqual({ raw: '31122024', display: '31-12-2024', caret: 10 });
  });

  it('drops the overflow of a paste longer than the mask', () => {
    const result = applyMaskEdit({
      spec: date,
      previousRaw: '',
      text: '311220249999',
      caret: 12,
      inputType: 'insertFromPaste',
    });

    expect(result.raw).toBe('31122024');
    expect(result.display).toBe('31-12-2024');
    expect(result.caret).toBe(10);
  });

  it('drops rejected characters of a paste and keeps the caret after the pasted content', () => {
    const result = applyMaskEdit({
      spec: date,
      previousRaw: '',
      text: '3a1/1b2',
      caret: 7,
      inputType: 'insertFromPaste',
    });

    expect(result.raw).toBe('3112');
    expect(result.display).toBe('31-12-');
    expect(result.caret).toBe(6);
  });

  it('places the caret after a paste into the middle', () => {
    // "12-|34" ← "99" pasted at the caret
    const result = applyMaskEdit({
      spec: date,
      previousRaw: '1234',
      text: '12-9934',
      caret: 5,
      inputType: 'insertFromPaste',
    });

    expect(result.raw).toBe('129934');
    expect(result.display).toBe('12-99-34');
    expect(result.caret).toBe(6);
  });

  it('keeps every digit when a cut removes only a literal', () => {
    // "12-34" with only the dash selected and cut
    const result = applyMaskEdit({
      spec: date,
      previousRaw: '1234',
      text: '1234',
      caret: 2,
      inputType: 'deleteByCut',
    });

    expect(result.raw).toBe('1234');
    expect(result.display).toBe('12-34-');
  });

  it('places the caret at the start after cutting everything', () => {
    const result = applyMaskEdit({ spec: date, previousRaw: '1234', text: '', caret: 0, inputType: 'deleteByCut' });

    expect(result).toEqual({ raw: '', display: '', caret: 0 });
  });
});
