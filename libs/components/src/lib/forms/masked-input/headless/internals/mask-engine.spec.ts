import { createCurrencyMask } from '../../masks/currency-mask';
import { applyMaskEdit } from './mask-engine';
import { compilePatternMask } from './pattern-mask';

const date = compilePatternMask('00-00-0000');

describe('applyMaskEdit', () => {
  describe('pattern masks - insertion', () => {
    it('masks appended characters and glides the caret past literals', () => {
      // "3" typed into an empty field
      let result = applyMaskEdit({ spec: date, previousRaw: '', text: '3', caret: 1, inputType: 'insertText' });

      expect(result).toEqual({ raw: '3', display: '3', caret: 1 });

      // "1" appended → the dash renders and the caret glides past it
      result = applyMaskEdit({ spec: date, previousRaw: '3', text: '31', caret: 2, inputType: 'insertText' });

      expect(result).toEqual({ raw: '31', display: '31-', caret: 3 });
    });

    it('re-flows an insertion in the middle', () => {
      // "12-34", caret after "1", user types "9" → element shows "192-34"
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '1234',
        text: '192-34',
        caret: 2,
        inputType: 'insertText',
      });

      expect(result.raw).toBe('19234');
      expect(result.display).toBe('19-23-4');
      // the caret glides past the dash onto the next slot, as it does at the end
      expect(result.caret).toBe(3);
    });

    it('drops rejected characters and keeps the caret in place', () => {
      // "12-34", caret at end, user types "x" → element shows "12-34x"
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '1234',
        text: '12-34x',
        caret: 6,
        inputType: 'insertText',
      });

      expect(result.raw).toBe('1234');
      // the display is a pure function of the raw value - the group's eager dash renders
      expect(result.display).toBe('12-34-');
      expect(result.caret).toBe(6);
    });

    it('extracts pasted junk into the mask', () => {
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '',
        text: '31.12.2024',
        caret: 10,
        inputType: 'insertFromPaste',
      });

      expect(result.raw).toBe('31122024');
      expect(result.display).toBe('31-12-2024');
      expect(result.caret).toBe(10);
    });

    it('ignores overflow beyond the pattern', () => {
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '31122024',
        text: '31-12-20249',
        caret: 11,
        inputType: 'insertText',
      });

      expect(result).toEqual({ raw: '31122024', display: '31-12-2024', caret: 10 });
    });
  });

  describe('pattern masks - deletion', () => {
    it('handles a plain backspace of a content character', () => {
      // "31-12-2024" backspace at end → element "31-12-202"
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '31122024',
        text: '31-12-202',
        caret: 9,
        inputType: 'deleteContentBackward',
      });

      expect(result.raw).toBe('3112202');
      expect(result.display).toBe('31-12-202');
      expect(result.caret).toBe(9);
    });

    it('backspace over a literal deletes the content character before it', () => {
      // "31-|12" backspace → browser removes the dash → "3112", caret 2
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '3112',
        text: '3112',
        caret: 2,
        inputType: 'deleteContentBackward',
      });

      expect(result.raw).toBe('312');
      expect(result.display).toBe('31-2');
      expect(result.caret).toBe(1);
    });

    it('does not glide the caret past literals after a deletion', () => {
      // "31-1" backspace → element "31-"; the caret settles after the last content char
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '311',
        text: '31-',
        caret: 3,
        inputType: 'deleteContentBackward',
      });

      expect(result.raw).toBe('31');
      expect(result.display).toBe('31-');
      expect(result.caret).toBe(2);
    });

    it('forward-delete over a literal deletes the content character after it', () => {
      // "31|-12" delete → browser removes the dash → "3112", caret 2
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '3112',
        text: '3112',
        caret: 2,
        inputType: 'deleteContentForward',
      });

      expect(result.raw).toBe('312');
      expect(result.display).toBe('31-2');
      expect(result.caret).toBe(2);
    });

    it('clearing the field resets everything', () => {
      const result = applyMaskEdit({
        spec: date,
        previousRaw: '31122024',
        text: '',
        caret: 0,
        inputType: 'deleteContentBackward',
      });

      expect(result).toEqual({ raw: '', display: '', caret: 0 });
    });
  });

  describe('guide display', () => {
    const guided = compilePatternMask('00-00', { placeholderChar: '_' });

    it('renders unfilled slots while editing and stops the caret at them', () => {
      const result = applyMaskEdit({
        spec: guided,
        previousRaw: '',
        text: '1__-__',
        caret: 1,
        inputType: 'insertText',
        guide: true,
      });

      expect(result.display).toBe('1_-__');
      expect(result.caret).toBe(1);
    });

    it('glides past the literal onto the next slot, not past placeholders', () => {
      const result = applyMaskEdit({
        spec: guided,
        previousRaw: '1',
        text: '12_-__',
        caret: 2,
        inputType: 'insertText',
        guide: true,
      });

      expect(result.display).toBe('12-__');
      expect(result.caret).toBe(3);
    });
  });

  describe('end-anchored masks (currency)', () => {
    const currency = createCurrencyMask();

    it('keeps the caret anchored to the content after it while grouping shifts', () => {
      // "1.234", caret after "1.2", user types "9" → "1.29 34"? element "1.2934"
      const result = applyMaskEdit({
        spec: currency,
        previousRaw: '1234',
        text: '1.2934',
        caret: 4,
        inputType: 'insertText',
      });

      expect(result.raw).toBe('12934');
      expect(result.display).toBe('12.934');
      // two content chars ("34") remain after the caret
      expect(result.caret).toBe(4);
    });

    it('appends digits with regrouping', () => {
      const result = applyMaskEdit({
        spec: currency,
        previousRaw: '123',
        text: '1234',
        caret: 4,
        inputType: 'insertText',
      });

      expect(result).toEqual({ raw: '1234', display: '1.234', caret: 5 });
    });

    it('backspace over a group separator deletes the digit before it', () => {
      // "1.234", caret after ".", backspace → browser removes "." → "1234", caret 1
      const result = applyMaskEdit({
        spec: currency,
        previousRaw: '1234',
        text: '1234',
        caret: 1,
        inputType: 'deleteContentBackward',
      });

      expect(result.raw).toBe('234');
      expect(result.display).toBe('234');
      expect(result.caret).toBe(0);
    });

    it('keeps the caret before a suffix', () => {
      const suffixed = createCurrencyMask({ suffix: ' €' });

      const result = applyMaskEdit({
        spec: suffixed,
        previousRaw: '123',
        text: '1234 €',
        caret: 4,
        inputType: 'insertText',
      });

      expect(result.display).toBe('1.234 €');
      expect(result.caret).toBe(5);
    });

    it('does not overshoot the caret on a deletion that regroups', () => {
      // "12.345", caret after "2", backspace → element "1.345", caret 1
      const result = applyMaskEdit({
        spec: currency,
        previousRaw: '12345',
        text: '1.345',
        caret: 1,
        inputType: 'deleteContentBackward',
      });

      expect(result.raw).toBe('1345');
      expect(result.display).toBe('1.345');
      expect(result.caret).toBe(1);
    });

    it('typing the decimal separator shows it immediately', () => {
      const result = applyMaskEdit({
        spec: currency,
        previousRaw: '1234',
        text: '1.234,',
        caret: 6,
        inputType: 'insertText',
      });

      expect(result.raw).toBe('1234,');
      expect(result.display).toBe('1.234,');
      expect(result.caret).toBe(6);
    });
  });
});
