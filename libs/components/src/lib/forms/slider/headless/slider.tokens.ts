import { InjectionToken, Signal, TemplateRef, WritableSignal } from '@angular/core';

/** Axis a slider runs along. Vertical sliders run bottom→up and are never mirrored in RTL. */
export type SliderOrientation = 'horizontal' | 'vertical';

/** A tick stop on the track. The optional `label` is presentation-only. */
export type SliderMark = {
  value: number;
  label?: string;
};

/** `true` renders a tick at every `step`; an array renders explicit stops. */
export type SliderMarks = boolean | readonly SliderMark[];

/** A tick stop resolved against the current bounds, ready to render. */
export type SliderMarkStop = SliderMark & {
  /** Position on the track as a 0–100 percentage. */
  percent: number;
  /** Whether the tick sits inside the filled part of the track. */
  active: boolean;
};

/**
 * Attribute a tick element carries so that a pointerdown on it commits that exact
 * value instead of the value under the pointer. The default components set it on
 * every rendered tick; custom markup can opt in the same way.
 */
export const SLIDER_MARK_VALUE_ATTRIBUTE = 'data-et-slider-mark-value';

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
  /** The thumb's own `aria-label`, if the consumer set one instead of a shared `<et-label>`. */
  label: Signal<string>;
  focus(options?: FocusOptions & { origin?: 'pointer' }): void;
};

/**
 * The contract both `[etSlider]` and `[etRangeSlider]` provide under `SLIDER_TOKEN`,
 * letting the thumb/track/label sub-directives compose with either parent.
 */
export type SliderHostBase = {
  effectiveMin: Signal<number>;
  effectiveMax: Signal<number>;
  step: Signal<number>;
  orientation: Signal<SliderOrientation>;
  /** Whether commits snap onto the marks instead of the `step` grid. */
  snapToMarks: Signal<boolean>;
  /** Tick stops to render, in ascending value order. Empty while `marks` is off. */
  markStops: Signal<readonly SliderMarkStop[]>;
  /** Bulk-edit view state - while set, thumbs park at the track start and hide their value from ARIA. */
  mixed: Signal<boolean>;
  /** `aria-valuetext` the thumbs announce while `mixed` is set, after `SLIDER_LABELS` is applied. */
  resolvedMixedLabel: Signal<string>;
  disabled: Signal<boolean>;
  readonly: Signal<boolean>;
  interactive: Signal<boolean>;
  shouldDisplayError: Signal<boolean>;
  labelId: Signal<string | null>;
  describedBy: Signal<string | null>;
  /** The thumb currently being dragged via the track, or `null` - set by the track directive. */
  draggingThumbIndex: WritableSignal<number | null>;
  /** Current thumb values in thumb order - already clamped and snapped for display. */
  thumbValues: Signal<readonly number[]>;
  /** `thumbValues` as 0–100 track percentages, for positioning. */
  thumbPercents: Signal<readonly number[]>;
  /** Registered thumbs in registration order - a thumb's index is its position in this list. */
  thumbs: Signal<readonly SliderThumbBase[]>;
  registeredThumbLabelTemplate: WritableSignal<SliderThumbLabelBase | null>;
  /** The ARIA value bounds of a thumb - in range mode each thumb is bounded by its sibling. */
  thumbAriaBounds(index: number): { min: number; max: number };
  /** `aria-valuetext` for the thumb at `index`, or `null` to announce the raw number. */
  thumbValueText(index: number): string | null;
  /** The value `steps` keyboard steps from `value` - mark-aware while snapping to marks. */
  adjacentValue(value: number, steps: number): number;
  /** Clamps + snaps `value` and commits it to the thumb at `index`. */
  commitThumbValue(index: number, value: number): void;
  markTouched(): void;
  registerThumb(thumb: SliderThumbBase): void;
  unregisterThumb(thumb: SliderThumbBase): void;
};

export const SLIDER_TOKEN = new InjectionToken<SliderHostBase>('SLIDER_TOKEN');
