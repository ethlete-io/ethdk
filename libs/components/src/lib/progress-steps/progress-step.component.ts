import {
  Component,
  Injector,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  runInInjectionContext,
} from '@angular/core';
import { ProvideColorDirective, injectErrorTheme, injectSuccessTheme, injectWarningTheme } from '@ethlete/core';
import {
  CHECK_ICON,
  IconDirective,
  RegisteredIconName,
  TIMES_ICON,
  TRIANGLE_EXCLAMATION_ICON,
  provideIcons,
} from '../icon';

export const PROGRESS_STEP_STATES = {
  COMPLETE: 'complete',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
} as const;

export type ProgressStepState = (typeof PROGRESS_STEP_STATES)[keyof typeof PROGRESS_STEP_STATES];

const STATE_ICONS: Partial<Record<ProgressStepState, RegisteredIconName>> = {
  [PROGRESS_STEP_STATES.COMPLETE]: 'et-check',
  [PROGRESS_STEP_STATES.SUCCESS]: 'et-check',
  [PROGRESS_STEP_STATES.WARNING]: 'et-triangle-exclamation',
  [PROGRESS_STEP_STATES.ERROR]: 'et-times',
};

/**
 * One step in an `et-progress-steps` row: a numbered marker that becomes an icon once resolved, plus
 * a label. `state` is yours to set per step - nothing is derived from position, so a skipped or
 * out-of-order step is exactly as easy to render as a strictly linear one.
 *
 * `complete` marks a step as done in the surrounding color theme; `success`, `warning` and `error`
 * mark it as done with an outcome and recolor the step in the app's matching semantic theme, each
 * with its own icon so the outcome does not rest on color alone.
 */
@Component({
  selector: 'et-progress-step',
  templateUrl: './progress-step.component.html',
  styleUrl: './progress-step.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
  viewProviders: [provideIcons(CHECK_ICON, TIMES_ICON, TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [ProvideColorDirective],
  host: {
    class: 'et-progress-step',
    '[attr.data-state]': 'state()',
  },
})
export class ProgressStepComponent {
  private provideColor = inject(ProvideColorDirective);
  private injector = inject(Injector);

  public state = input<ProgressStepState>(PROGRESS_STEP_STATES.UPCOMING);

  protected markerIcon = computed(() => STATE_ICONS[this.state()] ?? null);

  constructor() {
    // Only the theme actually in use is injected, and only once a step renders in that state: a row
    // that never fails shouldn't force the app to register a `type: 'error'` theme.
    effect(() => {
      const state = this.state();

      const theme = runInInjectionContext(this.injector, () => {
        if (state === PROGRESS_STEP_STATES.SUCCESS) return injectSuccessTheme();
        if (state === PROGRESS_STEP_STATES.WARNING) return injectWarningTheme();
        if (state === PROGRESS_STEP_STATES.ERROR) return injectErrorTheme();
        return null;
      });

      if (!theme) {
        this.provideColor.clearForcedColor();

        return;
      }

      this.provideColor.forceColor(theme);
    });
  }
}
