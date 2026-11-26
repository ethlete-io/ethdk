/**
 * Executable contract for a control whose own picker is a detached overlay - select, cascader, the
 * date-time pickers, color input. While that overlay is up, the control has to report `expanded` to
 * its form field: focus has moved into the overlay by then, so the field's `:focus-visible` no
 * longer matches and `[data-expanded]` is the only thing left holding the open field's accent frame
 * and its highlighted label and affixes.
 *
 * `aria-expanded` on the trigger is asserted alongside it, because the two have drifted apart - a
 * control can announce an open popup and still let the field fall back to its resting style.
 */
export type ExpandedStateHarness = {
  /** Opens the control's overlay the way a user would, and settles it. */
  open: () => Promise<void>;
  /** Closes the overlay again, and settles it. */
  close: () => Promise<void>;
  /** The element carrying `aria-expanded` - the control's single tab stop. */
  trigger: () => HTMLElement;
  /** The `et-form-field` element around the control, which has to render an `<et-label>`. */
  field: () => HTMLElement;
};

export const describeExpandedStateContract = (setup: () => ExpandedStateHarness) => {
  describe('expanded state contract', () => {
    it('reports nothing expanded while the overlay is closed', () => {
      const harness = setup();

      expect(harness.trigger().getAttribute('aria-expanded')).toBe('false');
      expect(harness.field().hasAttribute('data-expanded')).toBe(false);
    });

    it('reports expanded on the trigger and the field while the overlay is open', async () => {
      const harness = setup();

      await harness.open();

      expect(harness.trigger().getAttribute('aria-expanded')).toBe('true');
      expect(harness.field().hasAttribute('data-expanded')).toBe(true);
    });

    it('drops it again once the overlay closes', async () => {
      const harness = setup();

      await harness.open();
      await harness.close();

      expect(harness.trigger().getAttribute('aria-expanded')).toBe('false');
      expect(harness.field().hasAttribute('data-expanded')).toBe(false);
    });
  });
};
