import { Signal, computed, effect, inject } from '@angular/core';
import { ProvideColorDirective } from '@ethlete/core';
import { CHECK_ICON, MINUS_ICON, RegisteredIconName, TIMES_ICON, TRIANGLE_EXCLAMATION_ICON } from '../icon';
import { injectSemanticThemes } from '../internals/semantic-theme';
import { ProgressStepState } from './headless/progress-step.directive';
import { injectProgressStepLabels } from './progress-step-labels';

const STATE_ICONS: Partial<Record<ProgressStepState, RegisteredIconName>> = {
  complete: 'et-check',
  success: 'et-check',
  warning: 'et-triangle-exclamation',
  error: 'et-times',
  skipped: 'et-minus',
};

export const PROGRESS_STATE_ICONS = [CHECK_ICON, MINUS_ICON, TIMES_ICON, TRIANGLE_EXCLAMATION_ICON] as const;

export const injectProgressStateVisuals = (state: Signal<ProgressStepState | null>) => {
  const provideColor = inject(ProvideColorDirective);
  const semanticThemes = injectSemanticThemes();
  const labels = injectProgressStepLabels();

  effect(() => {
    const current = state();
    const theme =
      current === 'success' || current === 'warning' || current === 'error' ? semanticThemes[current]() : null;

    if (theme) {
      provideColor.forceColor(theme);
    } else {
      provideColor.clearForcedColor();
    }
  });

  return {
    icon: computed(() => {
      const current = state();

      return current ? (STATE_ICONS[current] ?? null) : null;
    }),
    label: computed(() => {
      const current = state();

      return !current || current === 'current' || current === 'upcoming' ? null : labels()[current];
    }),
  };
};
