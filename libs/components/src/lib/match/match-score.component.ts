import { booleanAttribute, Component, computed, input, linkedSignal, signal, ViewEncapsulation } from '@angular/core';

/**
 * One drawn value of a match, which rolls when it changes: the old value leaves upward as the new one
 * arrives from below, with a brief accent flash behind them.
 *
 * Both values are **real elements** for the length of the animation, which is the only honest way to
 * cross them — this library never clones a node to animate it (a clone outlives the component that
 * styled it). The outgoing one is dropped on its own `animationend`, so nothing here runs a timer.
 *
 * A change is anything the bound `value` does after the first render. `animate` gates the movement, not
 * the update: with it off the value simply changes, which is what a finished match wants.
 */
@Component({
  selector: 'et-match-score',
  template: `
    @for (digit of digits(); track digit.key) {
      <span [attr.data-state]="digit.state" (animationend)="settle()" class="et-match-score-digit">
        {{ digit.value }}
      </span>
    }

    @for (flash of flashes(); track flash) {
      <span (animationend)="settleFlash()" class="et-match-score-flash" aria-hidden="true"></span>
    }
  `,
  styleUrl: './match-score.component.css',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-match-score',
  },
})
export class MatchScoreComponent {
  /** The value to draw. Anything printable — a score, table points, a W. */
  public value = input.required<string>();

  /** Roll the value when it changes. @default false */
  public animate = input(false, { transform: booleanAttribute });

  /**
   * The value's history as one number: it goes up on every change, which is what makes `@for` replace the
   * element and the CSS animation run again. `previous` is what the outgoing element draws.
   */
  private revision = linkedSignal<string, { key: number; previous: string | null }>({
    source: () => this.value(),
    computation: (_value, previous) => ({
      key: (previous?.value.key ?? 0) + 1,
      previous: previous ? previous.source : null,
    }),
  });

  /** The revision whose animation has finished — up to date means nothing is moving. */
  private settledKey = signal(0);

  private isRolling = computed(() => {
    const { key, previous } = this.revision();

    return this.animate() && previous !== null && this.settledKey() !== key;
  });

  protected digits = computed(() => {
    const { key, previous } = this.revision();
    const rolling = this.isRolling();
    const current = { key, value: this.value(), state: rolling ? 'in' : 'static' };

    if (!rolling || previous === null) return [current];

    // Negative keys for the outgoing element, so the two never collide in the same `@for`.
    return [{ key: -key, value: previous, state: 'out' }, current];
  });

  protected flashes = computed(() => (this.isRolling() ? [this.revision().key] : []));

  /** The roll is over: drop the outgoing value. Fires once per element, hence the idempotent set. */
  protected settle() {
    this.settledKey.set(this.revision().key);
  }

  protected settleFlash() {
    this.settle();
  }
}
