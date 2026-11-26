import focusRing from '../src/lib/focus-ring/focus-ring-styles.component.css?inline';
import { CHECK_ICON } from '../src/lib/icon/headless/check-icon';
import { IconDefinition } from '../src/lib/icon/headless/icon-definition';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { TIMES_ICON } from '../src/lib/icon/headless/times-icon';
import { TRIANGLE_EXCLAMATION_ICON } from '../src/lib/icon/headless/triangle-exclamation-icon';
import progressStepBase from '../src/lib/progress-steps/progress-step.component.css?inline';
import progressStepsBase from '../src/lib/progress-steps/progress-steps.component.css?inline';
import { iconMarkup } from './icon';

export type ProgressStepMockState = 'complete' | 'current' | 'upcoming' | 'success' | 'warning' | 'error';

export type ProgressStepMockStep = {
  /** The step label, as HTML. */
  label: string;
  state?: ProgressStepMockState;
  /** The muted second line, as HTML. */
  description?: string;
  /** Draws the step on a link or a button, as `<a et-progress-step>` or `<button et-progress-step>`. */
  as?: 'a' | 'button';
  /**
   * The color theme name the step forces, as the app's semantic theme for `success`, `warning` and `error`
   * resolves. Left out, the step takes the color theme around it.
   */
  color?: string;
  /** Extra attributes on the step, e.g. design markers. */
  attributes?: string;
};

export type ProgressStepsMockOptions = {
  steps: ProgressStepMockStep[];
  orientation?: 'horizontal' | 'vertical';
  /** Extra attributes on the steps, e.g. design markers. */
  attributes?: string;
};

/** The stylesheets `progressSteps()` draws with: the real progress steps, focus ring and icon CSS. */
export const progressStepsStyles = /* @__PURE__ */ [focusRing, iconBase, progressStepsBase, progressStepBase].join(
  '\n',
);

const STATE_ICONS: Partial<Record<ProgressStepMockState, IconDefinition>> = {
  complete: CHECK_ICON,
  success: CHECK_ICON,
  warning: TRIANGLE_EXCLAMATION_ICON,
  error: TIMES_ICON,
};

const step = (item: ProgressStepMockStep) => {
  const state = item.state ?? 'upcoming';
  const tag = item.as ?? 'et-progress-step';
  const icon = STATE_ICONS[state];
  const marker = icon ? iconMarkup(icon) : '<span class="et-progress-step-marker-number"></span>';
  const description = item.description ? `<span etProgressStepDescription>${item.description}</span>` : '';
  const attributes = [
    item.attributes,
    item.as !== undefined && 'et-progress-step=""',
    item.as === 'a' && 'href="#"',
    item.as === 'button' && 'type="button"',
    `class="et-color--${item.color ?? 'inherited'} et-focus-ring et-progress-step"`,
    `data-state="${state}"`,
    state === 'current' && 'aria-current="step"',
    item.as === undefined && 'role="listitem"',
  ].filter(Boolean);

  return `<${tag} ${attributes.join(' ')}><span class="et-progress-step-marker">${marker}</span><span class="et-progress-step-text"><span class="et-progress-step-label">${item.label}</span>${description}</span></${tag}>`;
};

/** Draws an `et-progress-steps` row or column with its `et-progress-step`s as the components render them, as HTML. */
export const progressSteps = (options: ProgressStepsMockOptions) => {
  const attributes = [
    options.attributes,
    'class="et-progress-steps"',
    'role="list"',
    `data-orientation="${options.orientation ?? 'horizontal'}"`,
  ].filter(Boolean);

  return `<et-progress-steps ${attributes.join(' ')}>${options.steps.map(step).join('')}</et-progress-steps>`;
};
