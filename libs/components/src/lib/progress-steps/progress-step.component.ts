import { Component, ElementRef, ViewEncapsulation, computed, effect, inject, input } from '@angular/core';
import { ProvideColorDirective, mountVisuallyHidden } from '@ethlete/core';
import { FocusRingDirective } from '../focus-ring';
import {
  CHECK_ICON,
  IconDirective,
  RegisteredIconName,
  TIMES_ICON,
  TRIANGLE_EXCLAMATION_ICON,
  provideIcons,
} from '../icon';
import { injectSemanticThemes } from '../internals/semantic-theme';
import { injectProgressStepLabels } from './progress-step-labels';

export const PROGRESS_STEP_STATES = {
  COMPLETE: 'complete',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export type ProgressStepState = (typeof PROGRESS_STEP_STATES)[keyof typeof PROGRESS_STEP_STATES];

const INTERACTIVE_HOSTS = /* @__PURE__ */ new Set(['A', 'BUTTON']);

const STATE_ICONS: Partial<Record<ProgressStepState, RegisteredIconName>> = {
  complete: 'et-check',
  success: 'et-check',
  warning: 'et-triangle-exclamation',
  error: 'et-times',
};

/**
 * One step in an `et-progress-steps` row: a numbered marker that becomes an icon once resolved, plus
 * a label. `state` is yours to set per step - nothing is derived from position, so a skipped or
 * out-of-order step is exactly as easy to render as a strictly linear one.
 *
 * `complete` marks a step as done in the surrounding color theme; `success`, `warning` and `error`
 * mark it as done with an outcome and recolor the step in the app's matching semantic theme, each
 * with its own icon so the outcome does not rest on color alone.
 *
 * Project `[etProgressStepDescription]` for a second, muted line under the label - what the step
 * covers, what it produced, why it failed:
 *
 * @example
 * <et-progress-step state="current">
 *   Payment
 *   <span etProgressStepDescription>Card ending 4242</span>
 * </et-progress-step>
 *
 * Write the step as a link or a button to make it interactive - the attribute selector puts the step
 * on the consumer's own element, so `routerLink`, `href` and click handlers all stay where they
 * belong, and the whole step becomes the target:
 *
 * @example
 * <a [routerLink]="['/checkout/account']" state="complete" et-progress-step>Account</a>
 */
@Component({
  selector: 'et-progress-step, [et-progress-step]',
  templateUrl: './progress-step.component.html',
  styleUrl: './progress-step.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  viewProviders: [provideIcons(CHECK_ICON, TIMES_ICON, TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [ProvideColorDirective, FocusRingDirective],
  host: {
    class: 'et-progress-step',
    '[attr.data-state]': 'state()',
    '[attr.aria-current]': 'ariaCurrent()',
    '[attr.role]': 'role',
  },
})
export class ProgressStepComponent {
  private provideColor = inject(ProvideColorDirective);
  private semanticThemes = injectSemanticThemes();
  private labels = injectProgressStepLabels();

  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);

  public state = input<ProgressStepState>(PROGRESS_STEP_STATES.UPCOMING);

  protected role = INTERACTIVE_HOSTS.has(this.elementRef.nativeElement.nodeName) ? null : 'listitem';

  protected markerIcon = computed(() => STATE_ICONS[this.state()] ?? null);
  protected stateLabel = computed(() => {
    const state = this.state();

    return state === PROGRESS_STEP_STATES.CURRENT || state === PROGRESS_STEP_STATES.UPCOMING
      ? null
      : this.labels()[state];
  });
  protected ariaCurrent = computed(() => (this.state() === PROGRESS_STEP_STATES.CURRENT ? 'step' : null));

  constructor() {
    mountVisuallyHidden();

    effect(() => {
      const state = this.state();
      const theme =
        state === PROGRESS_STEP_STATES.SUCCESS ||
        state === PROGRESS_STEP_STATES.WARNING ||
        state === PROGRESS_STEP_STATES.ERROR
          ? this.semanticThemes[state]()
          : null;

      if (!theme) {
        this.provideColor.clearForcedColor();

        return;
      }

      this.provideColor.forceColor(theme);
    });
  }
}
