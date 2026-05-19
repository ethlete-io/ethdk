import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ColorInteractiveDirective, createCanAnimateSignal } from '@ethlete/core';
import { CheckboxDirective } from './headless';

@Component({
  selector: 'et-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.css',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  hostDirectives: [
    {
      directive: CheckboxDirective,
      inputs: ['checked', 'indeterminate', 'disabled', 'invalid', 'errors', 'required', 'name', 'skipGroup'],
      outputs: ['checkedChange', 'indeterminateChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-checkbox',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
  },
})
export class CheckboxComponent {
  private checkboxDir = inject(CheckboxDirective);
  private checkmarkEl = viewChild<ElementRef<HTMLElement>>('checkmark');
  private indeterminateEl = viewChild<ElementRef<HTMLElement>>('indeterminate');

  public canAnimate = createCanAnimateSignal();

  protected frozenCheckmarkColor = signal<string | null>(null);
  protected frozenIndeterminateColor = signal<string | null>(null);

  public isChecked = computed(() => this.checkboxDir.ariaChecked() === true);
  public isIndeterminate = computed(() => this.checkboxDir.ariaChecked() === 'mixed');

  constructor() {
    effect(() => {
      const checked = this.isChecked();
      const checkmarkEl = this.checkmarkEl()?.nativeElement;

      untracked(() => {
        if (checked) {
          this.frozenCheckmarkColor.set(null);
        } else if (checkmarkEl) {
          this.frozenCheckmarkColor.set(getComputedStyle(checkmarkEl).color);
        }
      });
    });

    effect(() => {
      const indeterminate = this.isIndeterminate();
      const indeterminateEl = this.indeterminateEl()?.nativeElement;

      untracked(() => {
        if (indeterminate) {
          this.frozenIndeterminateColor.set(null);
        } else if (indeterminateEl) {
          this.frozenIndeterminateColor.set(getComputedStyle(indeterminateEl).color);
        }
      });
    });
  }
}
