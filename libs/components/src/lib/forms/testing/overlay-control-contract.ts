import { ExpandedStateHarness, describeExpandedStateContract } from './expanded-contract';

/**
 * Executable contract for a form control whose picker is a detached, non-modal overlay opened from
 * a combobox trigger - select, cascader. Beyond the expanded state (delegated to
 * {@link describeExpandedStateContract}, which every claimant of this contract also claims), such a
 * control owes its consumer four behaviours:
 *
 * 1. `touched` is set when focus leaves the *closed* field, and NOT when the panel opens. Opening a
 *    panel that takes focus itself blurs the trigger, so a naive blur handler marks the field
 *    touched before the user has done anything - and a `required` field paints its error while its
 *    own picker is still up.
 * 2. Escape closes the panel.
 * 3. A pointerdown outside the panel and its trigger closes the panel.
 * 4. Closing the panel hands DOM focus back to the trigger. Focus that sat inside the pane falls to
 *    `<body>` when the pane is removed, and the control's single tab stop is the only place it can
 *    go without stranding the user at the top of the document.
 */
export type OverlayControlContractHarness = ExpandedStateHarness & {
  /** The control's `open` state, read through its own model rather than the DOM. */
  isOpen: () => boolean;
  /** `touched` as the consumer's two-way binding currently sees it. */
  touched: () => boolean;
  /** Moves real DOM focus onto the trigger, the way tabbing into the field does. */
  focusTrigger: () => void;
  /** Takes real DOM focus off the trigger, the way tabbing out of the field does. */
  blurTrigger: () => void;
  /** Presses Escape on the document, where the panel's key handler listens. */
  escape: () => void;
  /** Fires a pointerdown on `<body>`, outside both the pane and the trigger. */
  pointerDownOutside: () => void;
  /** Runs the frames plus change detection a jsdom overlay close needs to finish. */
  settle: () => Promise<void>;
};

export const describeOverlayControlContract = (setup: () => OverlayControlContractHarness) => {
  describe('overlay control contract', () => {
    describeExpandedStateContract(setup);

    it('marks touched when focus leaves the closed field', () => {
      const harness = setup();

      expect(harness.touched()).toBe(false);

      harness.focusTrigger();

      expect(document.activeElement, 'the trigger never took DOM focus').toBe(harness.trigger());

      harness.blurTrigger();

      expect(harness.touched()).toBe(true);
    });

    it('does not mark touched while the panel is the thing taking focus', async () => {
      const harness = setup();

      harness.focusTrigger();

      expect(document.activeElement, 'the trigger never took DOM focus').toBe(harness.trigger());

      await harness.open();

      expect(harness.touched(), 'opening the panel marked the field touched').toBe(false);

      harness.blurTrigger();

      expect(document.activeElement, 'DOM focus never left the trigger').not.toBe(harness.trigger());
      expect(harness.touched(), 'focus moving into the open panel marked the field touched').toBe(false);
    });

    it('closes on Escape', async () => {
      const harness = setup();

      await harness.open();

      expect(harness.isOpen()).toBe(true);

      harness.escape();
      await harness.settle();

      expect(harness.isOpen()).toBe(false);
      expect(harness.trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('closes on a pointerdown outside the panel', async () => {
      const harness = setup();

      await harness.open();

      expect(harness.isOpen()).toBe(true);

      harness.pointerDownOutside();
      await harness.settle();

      expect(harness.isOpen()).toBe(false);
      expect(harness.trigger().getAttribute('aria-expanded')).toBe('false');
    });

    it('hands focus back to the trigger once the panel closes', async () => {
      const harness = setup();

      await harness.open();

      expect(
        document.activeElement,
        'the trigger already holds focus - the hand-back cannot be observed from here',
      ).not.toBe(harness.trigger());

      harness.escape();
      await harness.settle();

      expect(document.activeElement).toBe(harness.trigger());
    });
  });
};
