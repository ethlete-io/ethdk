/**
 * Executable contract for the mixed (bulk-edit) state of form controls.
 *
 * A control that exposes `mixed` claims these semantics - every claimant runs this suite
 * from its own spec via {@link describeMixedStateContract} so the semantics cannot drift
 * between controls:
 *
 * 1. While mixed, the raw value is preserved untouched and masked: it is not displayed,
 *    and nothing (option, chip, aria state) reports it as selected. The host exposes
 *    `data-mixed` for styling.
 * 2. The first user commit REPLACES the raw value (it does not toggle against or merge
 *    with the hidden value) and resolves `mixed` to `false`.
 * 3. External / programmatic value writes do NOT resolve mixed - only user interaction
 *    (or the consumer setting `mixed` to `false`) does.
 * 4. A clear affordance, where the control has one, writes the control's empty shape
 *    (`null`, `''`, `[]`, …) and resolves mixed.
 * 5. Keyboard deletion never mass-clears a hidden multi-value selection (covered by
 *    control-specific specs where applicable - see the select's Backspace tests).
 * 6. `mixedLabel` (where the control has a text display slot) is presentation only and
 *    never enters the form value; validation always sees the raw value.
 *
 * Boolean controls (checkbox) express the same concept through the platform-named
 * `indeterminate` / `aria-checked="mixed"` API and are not covered by this kit.
 */
export type MixedStateContractHarness = {
  /** Establishes a representative raw value, then turns mixed on. Must leave the view stable. */
  enterMixed: () => void | Promise<void>;
  /** The raw value `enterMixed` established - asserted to survive masking untouched. */
  rawValue: () => unknown;
  /** The value as the consumer's two-way binding currently sees it. */
  value: () => unknown;
  /** The mixed flag as the consumer's two-way binding currently sees it. */
  mixed: () => boolean;
  /** The element carrying the `data-mixed` attribute. */
  hostElement: () => HTMLElement;
  /** Simulates an external write (e.g. server data arriving) while mixed. Must leave the view stable. */
  writeValueExternally: () => void | Promise<void>;
  /** The value `writeValueExternally` wrote. */
  externallyWrittenValue: () => unknown;
  /** Sets the consumer's `mixed` binding to `false` without any user interaction. Must leave the view stable. */
  resolveMixedFromConsumer: () => void | Promise<void>;
  /** Performs a real user commit interaction (pointer/keyboard). Must leave the view stable. */
  commit: () => void | Promise<void>;
  /** The value expected after `commit` - replace semantics, no merging with the hidden raw value. */
  committedValue: () => unknown;
  /** Control-specific masking assertions run while mixed (display text, aria, chips, …). */
  assertMasked?: () => void;
  /** The `mixedLabel` the host binds - required together with `mixedDisplayText`. */
  mixedLabel?: () => string;
  /** The control's text display slot (field placeholder, trigger text, `aria-valuetext`, …), never `null`. */
  mixedDisplayText?: () => string;
  /** Drives the control's clear affordance, if it has one. Must leave the view stable. */
  clear?: () => void | Promise<void>;
  /** The control's empty value shape - required when `clear` is provided. */
  emptyValue?: () => unknown;
};

export const describeMixedStateContract = (
  setup: () => MixedStateContractHarness | Promise<MixedStateContractHarness>,
) => {
  describe('mixed state contract', () => {
    it('masks the raw value without changing it and exposes data-mixed', async () => {
      const harness = await setup();

      await harness.enterMixed();

      expect(harness.mixed()).toBe(true);
      expect(harness.value()).toEqual(harness.rawValue());
      expect(harness.hostElement().getAttribute('data-mixed')).toBe('true');
      harness.assertMasked?.();
    });

    it('preserves mixed across external value writes', async () => {
      const harness = await setup();

      await harness.enterMixed();
      await harness.writeValueExternally();

      expect(harness.mixed()).toBe(true);
      expect(harness.value()).toEqual(harness.externallyWrittenValue());
      expect(harness.hostElement().getAttribute('data-mixed')).toBe('true');
    });

    it('resolves mixed when the consumer clears the flag, keeping the raw value', async () => {
      const harness = await setup();

      await harness.enterMixed();
      await harness.resolveMixedFromConsumer();

      expect(harness.mixed()).toBe(false);
      expect(harness.value()).toEqual(harness.rawValue());
      expect(harness.hostElement().hasAttribute('data-mixed')).toBe(false);
    });

    it('resolves mixed on the first user commit, replacing the raw value', async () => {
      const harness = await setup();

      await harness.enterMixed();
      await harness.commit();

      expect(harness.mixed()).toBe(false);
      expect(harness.value()).toEqual(harness.committedValue());
      expect(harness.hostElement().hasAttribute('data-mixed')).toBe(false);
    });

    it('displays mixedLabel while mixed and keeps it out of the value', async (ctx) => {
      const harness = await setup();

      if (!harness.mixedLabel && !harness.mixedDisplayText) {
        ctx.skip('the control has no text display slot for mixedLabel');
      }

      if (!harness.mixedLabel || !harness.mixedDisplayText) {
        throw new Error('mixed state contract: mixedLabel and mixedDisplayText must be provided together');
      }

      await harness.enterMixed();

      const label = harness.mixedLabel();

      expect(label).not.toBe('');
      expect(harness.mixedDisplayText()).toContain(label);
      expect(harness.value()).toEqual(harness.rawValue());

      await harness.commit();

      expect(harness.mixedDisplayText()).not.toContain(label);
      expect(harness.value()).toEqual(harness.committedValue());
    });

    it('clears to the empty shape and resolves mixed', async (ctx) => {
      const harness = await setup();

      if (!harness.clear && !harness.emptyValue) {
        ctx.skip('the control has no clear affordance');
      }

      if (!harness.clear || !harness.emptyValue) {
        throw new Error('mixed state contract: clear and emptyValue must be provided together');
      }

      await harness.enterMixed();
      await harness.clear();

      expect(harness.mixed()).toBe(false);
      expect(harness.value()).toEqual(harness.emptyValue());
      expect(harness.hostElement().hasAttribute('data-mixed')).toBe(false);
    });
  });
};
