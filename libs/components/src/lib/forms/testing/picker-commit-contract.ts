/**
 * Executable contract for the blur/Enter commit of the six date-time picker inputs (date, time,
 * date-time and the three ranges). All of them resolve a commit through one core
 * (`forms/date-time/internals/picker-input-commit.ts`), so every control runs this suite from its
 * own spec and the semantics cannot drift apart again:
 *
 * 1. A focus and blur with nothing typed is not an edit. It leaves the wire value alone, so a
 *    display format that carries fewer units than the wire format cannot silently drop the rest.
 * 2. Erasing text that did not parse resets `parseError`, even though an unparseable field renders
 *    no display value and the erase therefore arrives as "the text is unchanged".
 * 3. A readonly (or disabled) control commits nothing at all.
 */
export type PickerCommitContractHarness = {
  /** Commits a representative value the way a user would, and leaves the field unfocused. */
  commitValue: () => void;
  /** The wire value `commitValue` writes - asserted to survive an unedited focus and blur. */
  committedValue: () => unknown;
  /** The control's empty value shape (`null`, `{ start: null, end: null }`, …). */
  emptyValue: () => unknown;
  /** The value as the consumer's two-way binding currently sees it. */
  value: () => unknown;
  /** Whether the control holds text that did not parse. */
  parseError: () => boolean;
  /** Focuses the field under test. Must leave the view stable. */
  focus: () => void;
  /** Blurs the field under test. Must leave the view stable. */
  blur: () => void;
  /** Replaces the field text and blurs. Must leave the view stable. */
  typeAndBlur: (text: string) => void;
  /** Turns `readonly` on. Must leave the view stable. */
  makeReadonly: () => void;
};

export const describePickerCommitContract = (setup: () => PickerCommitContractHarness) => {
  describe('picker commit contract', () => {
    it('leaves the committed value untouched on a focus and blur with nothing typed', () => {
      const harness = setup();

      harness.commitValue();

      expect(harness.value()).toEqual(harness.committedValue());

      harness.focus();
      harness.blur();

      expect(harness.value()).toEqual(harness.committedValue());
      expect(harness.parseError()).toBe(false);
    });

    it('resets the parse error when the unparseable text is erased', () => {
      const harness = setup();

      harness.typeAndBlur('not a date');

      expect(harness.parseError()).toBe(true);

      harness.typeAndBlur('');

      expect(harness.parseError()).toBe(false);
      expect(harness.value()).toEqual(harness.emptyValue());
    });

    it('commits nothing while readonly', () => {
      const harness = setup();

      harness.commitValue();
      harness.makeReadonly();
      harness.typeAndBlur('not a date');

      expect(harness.value()).toEqual(harness.committedValue());
      expect(harness.parseError()).toBe(false);
    });
  });
};
