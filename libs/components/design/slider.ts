import formSupport from '../src/lib/forms/form-field/form-support-styles.component.css?inline';
import label from '../src/lib/forms/form-field/headless/label.directive.css?inline';
import hint from '../src/lib/forms/form-field/hint.component.css?inline';
import rangeSliderBase from '../src/lib/forms/slider/range-slider.component.css?inline';
import sliderBase from '../src/lib/forms/slider/slider.component.css?inline';

/** An interaction a frame forces on a thumb with the `data-et-force` design marker. */
export type SliderMockForce = 'hover' | 'focus-visible' | 'active';

export type SliderMockMark = { value: number; label?: string };

export type SliderMockOptions = {
  /** One number draws `et-slider`, a pair draws `et-range-slider` with two thumbs. */
  value: number | [number, number];
  min?: number;
  max?: number;
  /** `true` draws a tick at every `step`; a list draws the given ticks, with labels where set. */
  marks?: boolean | SliderMockMark[];
  step?: number;
  /** The label, as HTML. */
  label?: string;
  /** The hint, as HTML. Hidden while an `error` shows. */
  hint?: string;
  /** The error message, as HTML. Draws the slider touched and invalid. */
  error?: string;
  /** The color theme name the app registers for errors, e.g. `danger` in Storybook. */
  errorColor?: string;
  /** A color theme name the app registers. */
  color?: string;
  required?: boolean;
  disabled?: boolean;
  /** View-only: the value shows, the thumb takes focus but does not move. */
  readonly?: boolean;
  /** An unresolved bulk-edit value: the thumbs park at the track start. */
  mixed?: boolean;
  mixedLabel?: string;
  orientation?: 'horizontal' | 'vertical';
  /** Draws the value bubble an `etSliderThumbLabel` template renders above each thumb. */
  valueLabel?: boolean;
  /** The thumb index that is being dragged. */
  dragging?: number;
  /** Forced interactions, per thumb index (a single slider uses index 0). */
  force?: Partial<Record<number, SliderMockForce | SliderMockForce[]>>;
  /** Unique per frame: the label and message ids derive from it. */
  id?: string;
};

/** The stylesheets `slider()` draws with: the real `et-slider`, `et-range-slider` and form support CSS. */
export const sliderStyles = /* @__PURE__ */ [label, hint, formSupport, sliderBase, rangeSliderBase].join('\n');

const styled = (css: string) => ` style="${css}"`;

const forceList = (force: SliderMockForce | SliderMockForce[] | undefined) =>
  force === undefined ? [] : Array.isArray(force) ? force : [force];

/** Draws `<et-slider>`, or `<et-range-slider>` for a value pair, as HTML, with the DOM the components render. */
export const slider = (options: SliderMockOptions) => {
  const { id = 'slider', min = 0, max = 100, step = 1, orientation = 'horizontal' } = options;
  const range = Array.isArray(options.value);
  const prefix = range ? 'et-range-slider' : 'et-slider';
  const [start, end] = Array.isArray(options.value) ? options.value : [min, options.value];
  const values = range ? [start, end] : [end];
  const shown = options.mixed ? values.map(() => min) : values;
  const [shownStart, shownEnd] = options.mixed ? [min, min] : [start, end];
  const percent = (value: number) => ((value - min) / (max - min)) * 100;
  const ids = { hint: `et-form-field-hint-${id}`, error: `et-form-field-error-${id}` };
  const labelId = options.label !== undefined ? `et-label-${id}` : null;
  const invalid = options.error !== undefined;
  const supportId = invalid ? ids.error : options.hint !== undefined ? ids.hint : null;
  const colorClass = invalid && options.errorColor ? options.errorColor : (options.color ?? 'inherited');
  const activeRange = options.mixed ? null : { start, end };

  const markList: SliderMockMark[] =
    options.marks === true
      ? Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => ({ value: min + index * step }))
      : options.marks || [];
  const hasMarkLabels = markList.some((mark) => !!mark.label);

  const hostAttributes = [
    `class="${prefix} et-color--${colorClass}"`,
    options.mixed && 'data-mixed="true"',
    `data-orientation="${orientation}"`,
    invalid && 'data-error="true"',
    options.disabled && 'data-disabled="true"',
    options.readonly && 'data-readonly="true"',
    options.dragging !== undefined && 'data-dragging="true"',
    hasMarkLabels && 'data-mark-labels="true"',
  ].filter(Boolean);

  const labelHtml = labelId
    ? `<et-label id="${labelId}"${options.disabled ? ' data-disabled="true"' : ''}><span class="et-label-content">${options.label}</span>${options.required ? '<span aria-hidden="true" class="et-label-required-marker">*</span>' : ''}</et-label>`
    : '';

  const fillStyle = range
    ? `--_et-slider-fill-start: ${percent(shownStart)}; --_et-slider-fill-end: ${percent(shownEnd)};`
    : `--_et-slider-fill-end: ${percent(shownEnd)};`;

  const marksHtml = markList.length
    ? `<div aria-hidden="true" class="${prefix}-marks">${markList
        .map((mark) => {
          const active = activeRange !== null && mark.value >= activeRange.start && mark.value <= activeRange.end;
          const markLabel = mark.label ? `<span class="${prefix}-mark-label">${mark.label}</span>` : '';

          return `<span class="${prefix}-mark"${active ? ' data-active="true"' : ''} data-et-slider-mark-value="${mark.value}"${styled(`--_et-slider-mark-position: ${percent(mark.value)};`)}>${markLabel}</span>`;
        })
        .join('')}</div>`
    : '';

  const thumbs = shown
    .map((value, index) => {
      const forced = forceList(options.force?.[index]);
      const markLabel = markList.find((mark) => mark.value === values[index])?.label;
      const valueText = options.mixed ? (options.mixedLabel ?? 'Mixed') : markLabel;
      const ariaMin = range && index === 1 ? start : min;
      const ariaMax = range && index === 0 ? end : max;
      const attributes = [
        'role="slider"',
        `class="${prefix}-thumb"`,
        `aria-orientation="${orientation}"`,
        `tabindex="${options.disabled ? -1 : 0}"`,
        `aria-valuemin="${ariaMin}"`,
        `aria-valuemax="${ariaMax}"`,
        !options.mixed && `aria-valuenow="${value}"`,
        valueText && `aria-valuetext="${valueText}"`,
        range ? `aria-label="${index === 0 ? 'Minimum' : 'Maximum'}"` : labelId && `aria-labelledby="${labelId}"`,
        supportId && `aria-describedby="${supportId}"`,
        options.disabled && 'aria-disabled="true"',
        options.readonly && 'aria-readonly="true"',
        invalid && 'aria-invalid="true"',
        options.disabled && 'data-disabled="true"',
        options.readonly && 'data-readonly="true"',
        options.dragging === index && 'data-dragging="true"',
        forced.length > 0 && `data-et-force="${forced.join(' ')}"`,
        styled(`--_et-slider-thumb-position: ${percent(value)};`).trim(),
      ].filter(Boolean);
      const bubble = options.valueLabel
        ? `<div aria-hidden="true" class="${prefix}-thumb-value">${values[index]}</div>`
        : '';

      return `<div ${attributes.join(' ')}>${bubble}</div>`;
    })
    .join('');

  const support =
    options.hint === undefined && options.error === undefined
      ? ''
      : `<et-form-support class="et-form-support"><div class="et-form-support-stack">${
          invalid
            ? `<div class="et-form-support-content et-form-support-errors${options.errorColor ? ` et-color--${options.errorColor}` : ''}" id="${ids.error}" aria-atomic="true" aria-live="polite" data-active="true" data-direction="from-below" data-state="active"><et-form-error class="et-form-error">${options.error}</et-form-error></div>`
            : `<div class="et-form-support-content et-form-support-hint" id="${ids.hint}" data-active="true" data-direction="from-above" data-state="active"><et-hint>${options.hint}</et-hint></div>`
        }</div></et-form-support>`;

  return `<${prefix} ${hostAttributes.join(' ')}>${labelHtml}<div class="${prefix}-interaction"><div aria-hidden="true" class="${prefix}-rail"></div><div aria-hidden="true" class="${prefix}-fill"${styled(fillStyle)}></div>${marksHtml}${thumbs}</div>${support}</${prefix}>`;
};
