import { Directive, computed, input, numberAttribute, signal } from '@angular/core';
import { signalHostElementDimensions } from '@ethlete/core';
import { ProgressStepDirective } from './progress-step.directive';
import { PROGRESS_STEPS_REGISTRY_TOKEN, ProgressStepsRegistry } from './progress-steps.tokens';

export const PROGRESS_STEPS_ORIENTATIONS = {
  HORIZONTAL: 'horizontal',
  VERTICAL: 'vertical',
  AUTO: 'auto',
} as const;

export type ProgressStepsOrientation = (typeof PROGRESS_STEPS_ORIENTATIONS)[keyof typeof PROGRESS_STEPS_ORIENTATIONS];

export type ResolvedProgressStepsOrientation = Exclude<ProgressStepsOrientation, 'auto'>;

/**
 * The behavior of a group of progress steps, with no look: the `list` role, the step registry, and the
 * orientation. In `auto` the row turns into a column once a step would get less than `minStepSize` pixels,
 * so the steps never need to scroll sideways. The resolved orientation is on `data-orientation`.
 *
 * @example
 * <ol etProgressSteps #steps="etProgressSteps">
 *   <li etProgressStep stepState="complete">Account</li>
 *   <li etProgressStep stepState="current">Shipping</li>
 * </ol>
 */
@Directive({
  selector: '[etProgressSteps]',
  exportAs: 'etProgressSteps',
  providers: [{ provide: PROGRESS_STEPS_REGISTRY_TOKEN, useExisting: ProgressStepsDirective }],
  host: {
    role: 'list',
    '[attr.data-orientation]': 'resolvedOrientation()',
  },
})
export class ProgressStepsDirective implements ProgressStepsRegistry {
  public orientation = input<ProgressStepsOrientation>(PROGRESS_STEPS_ORIENTATIONS.AUTO);

  /** In `auto`, the narrowest a step may get, in pixels, before the steps stack into a column. */
  public minStepSize = input(96, { transform: (value: unknown) => numberAttribute(value, 96) });

  private dimensions = signalHostElementDimensions();
  private registeredSteps = signal<readonly ProgressStepDirective[]>([]);

  public steps = this.registeredSteps.asReadonly();

  public resolvedOrientation = computed<ResolvedProgressStepsOrientation>(() => {
    const orientation = this.orientation();

    if (orientation !== PROGRESS_STEPS_ORIENTATIONS.AUTO) {
      return orientation;
    }

    const width = this.dimensions().client?.width;

    if (!width) {
      return PROGRESS_STEPS_ORIENTATIONS.HORIZONTAL;
    }

    return width < this.registeredSteps().length * this.minStepSize()
      ? PROGRESS_STEPS_ORIENTATIONS.VERTICAL
      : PROGRESS_STEPS_ORIENTATIONS.HORIZONTAL;
  });

  /** @internal */
  public registerStep(step: ProgressStepDirective) {
    this.registeredSteps.update((steps) => [...steps, step]);
  }

  /** @internal */
  public unregisterStep(step: ProgressStepDirective) {
    this.registeredSteps.update((steps) => steps.filter((s) => s !== step));
  }
}
