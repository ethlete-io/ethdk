import { Component, ViewEncapsulation, input, signal } from '@angular/core';
import { AnimatedIfDirective } from '../../animated-if.directive';
import { AnimatedLifecycleDirective, AnimatedLifecycleState } from '../../animated-lifecycle.directive';

@Component({
  selector: 'et-sb-animated-lifecycle',
  template: `
    <div class="flex flex-col gap-4 p-8 font-sans">
      <button (click)="shown.set(!shown())" type="button">Toggle</button>

      <div
        [style.--et-sb-lifecycle-duration.ms]="durationMs()"
        (stateChange)="onStateChange($event)"
        class="et-sb-lifecycle"
        data-testid="lifecycle"
        etAnimatedLifecycle
      >
        <p *etAnimatedIf="shown()" data-testid="content">Animated content</p>
      </div>

      <output data-testid="state">{{ state() }}</output>
      <output data-testid="history">{{ history().join(' ') }}</output>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [AnimatedLifecycleDirective, AnimatedIfDirective],
  styles: `
    .et-sb-lifecycle {
      opacity: 0;
      padding: 1.6rem;
      border-radius: 0.8rem;
      background: rgb(255 255 255 / 0.1);
    }

    .et-sb-lifecycle.et-animation-enter-active,
    .et-sb-lifecycle.et-animation-leave-active {
      transition: opacity var(--et-sb-lifecycle-duration) linear;
    }

    .et-sb-lifecycle.et-animation-enter-to,
    .et-sb-lifecycle.et-animation-enter-done,
    .et-sb-lifecycle.et-animation-leave-from {
      opacity: 1;
    }

    @media (prefers-reduced-motion: reduce) {
      .et-sb-lifecycle.et-animation-enter-active,
      .et-sb-lifecycle.et-animation-leave-active {
        transition: none;
      }
    }
  `,
})
export class AnimatedLifecycleStorybookComponent {
  durationMs = input(600);

  protected shown = signal(false);
  protected state = signal<AnimatedLifecycleState>('init');
  protected history = signal<AnimatedLifecycleState[]>([]);

  protected onStateChange(state: AnimatedLifecycleState) {
    this.state.set(state);
    this.history.update((history) => [...history, state]);
  }
}
