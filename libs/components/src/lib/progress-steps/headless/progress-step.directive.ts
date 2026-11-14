import { DestroyRef, Directive, ElementRef, Signal, computed, inject, input, signal } from '@angular/core';
import { PROGRESS_STEPS_REGISTRY_TOKEN } from './progress-steps.tokens';

export const PROGRESS_STEP_STATES = {
  COMPLETE: 'complete',
  CURRENT: 'current',
  UPCOMING: 'upcoming',
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
  SKIPPED: 'skipped',
} as const;

export type ProgressStepState = (typeof PROGRESS_STEP_STATES)[keyof typeof PROGRESS_STEP_STATES];

const INTERACTIVE_HOSTS = /* @__PURE__ */ new Set(['A', 'BUTTON']);

const RESOLVED_STATES: ReadonlySet<ProgressStepState> = /* @__PURE__ */ new Set<ProgressStepState>([
  'complete',
  'success',
  'warning',
  'error',
  'skipped',
]);

const isResolvedProgressStepState = (state: ProgressStepState) => RESOLVED_STATES.has(state);

/**
 * The behavior of one step, with no look: its state, `aria-current="step"` on the current one, and the
 * `listitem` role unless the host is a link or a button. Put it on any element inside an `etProgressSteps`
 * to render the step yourself; `et-progress-step` is this directive plus the default look.
 *
 * @example
 * <li etProgressStep [stepState]="step.state" #step="etProgressStep">{{ step.label }}</li>
 */
@Directive({
  selector: '[etProgressStep]',
  exportAs: 'etProgressStep',
  host: {
    '[attr.data-state]': 'resolvedState()',
    '[attr.aria-current]': 'ariaCurrent()',
    '[attr.role]': 'role',
  },
})
export class ProgressStepDirective {
  private elementRef = inject<ElementRef<HTMLElement>>(ElementRef);
  private group = inject(PROGRESS_STEPS_REGISTRY_TOKEN, { optional: true });

  public stepState = input<ProgressStepState>(PROGRESS_STEP_STATES.UPCOMING);

  protected role = INTERACTIVE_HOSTS.has(this.elementRef.nativeElement.nodeName) ? null : 'listitem';

  private currentSource = signal<Signal<boolean> | null>(null);

  /** The state the step shows: `current` while a registered current source is active, otherwise `stepState`. */
  public resolvedState = computed(() => (this.currentSource()?.() ? PROGRESS_STEP_STATES.CURRENT : this.stepState()));

  /** Whether the process is past this step. */
  public isResolved = computed(() => isResolvedProgressStepState(this.resolvedState()));

  protected ariaCurrent = computed(() => (this.resolvedState() === PROGRESS_STEP_STATES.CURRENT ? 'step' : null));

  constructor() {
    const group = this.group;

    if (group) {
      group.registerStep(this);
      inject(DestroyRef).onDestroy(() => group.unregisterStep(this));
    }
  }

  /** @internal */
  public registerCurrentSource(source: Signal<boolean>) {
    this.currentSource.set(source);
  }
}
