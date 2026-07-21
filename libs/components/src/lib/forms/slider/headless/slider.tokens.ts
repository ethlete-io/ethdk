import { InjectionToken, Signal, TemplateRef, WritableSignal } from '@angular/core';

export type SliderThumbLabelContext = {
  /** The value the thumb currently represents. */
  $implicit: number;
  /** The thumb's index in registration order (`0` = start, `1` = end for ranges). */
  index: number;
};

export type SliderThumbLabelBase = {
  templateRef: TemplateRef<SliderThumbLabelContext>;
};

export type SliderThumbBase = {
  focused: Signal<boolean>;
  focus(): void;
};

/**
 * The contract both `[etSlider]` and `[etRangeSlider]` provide under `SLIDER_TOKEN`,
 * letting the thumb/track/label sub-directives compose with either parent.
 */
export type SliderHostBase = {
  effectiveMin: Signal<number>;
  effectiveMax: Signal<number>;
  step: Signal<number>;
  /** Bulk-edit view state — while set, thumbs park at the track start and hide their value from ARIA. */
  mixed: Signal<boolean>;
  /** `aria-valuetext` the thumbs announce while `mixed` is set. */
  mixedLabel: Signal<string>;
  disabled: Signal<boolean>;
  readonly: Signal<boolean>;
  interactive: Signal<boolean>;
  shouldDisplayError: Signal<boolean>;
  labelId: Signal<string | null>;
  describedBy: Signal<string | null>;
  /** The thumb currently being dragged via the track, or `null` — set by the track directive. */
  draggingThumbIndex: WritableSignal<number | null>;
  /** Current thumb values in thumb order — already clamped and snapped for display. */
  thumbValues: Signal<readonly number[]>;
  /** `thumbValues` as 0–100 track percentages, for positioning. */
  thumbPercents: Signal<readonly number[]>;
  /** Registered thumbs in registration order — a thumb's index is its position in this list. */
  thumbs: Signal<readonly SliderThumbBase[]>;
  registeredThumbLabelTemplate: WritableSignal<SliderThumbLabelBase | null>;
  /** The ARIA value bounds of a thumb — in range mode each thumb is bounded by its sibling. */
  thumbAriaBounds(index: number): { min: number; max: number };
  /** Clamps + snaps `value` and commits it to the thumb at `index`. */
  commitThumbValue(index: number, value: number): void;
  markTouched(): void;
  registerThumb(thumb: SliderThumbBase): void;
  unregisterThumb(thumb: SliderThumbBase): void;
};

export const SLIDER_TOKEN = new InjectionToken<SliderHostBase>('SLIDER_TOKEN');
