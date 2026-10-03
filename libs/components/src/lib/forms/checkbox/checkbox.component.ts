import {
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
import { FocusRingDirective } from '../../focus-ring';
import { CheckboxDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';
import { FIELD_STATE_INPUTS } from '../form-field/headless/field-state-control.directive';

@Component({
  selector: 'et-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrl: './checkbox.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: CheckboxDirective,
      inputs: [
        'checked',
        'indeterminate',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['checkedChange', 'indeterminateChange', 'touchedChange', 'touch'],
    },
    ColorInteractiveDirective,
    FocusRingDirective,
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
          this.frozenCheckmarkColor.set(
            checkmarkEl.ownerDocument.defaultView?.getComputedStyle?.(checkmarkEl).color ?? null,
          );
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
          this.frozenIndeterminateColor.set(
            indeterminateEl.ownerDocument.defaultView?.getComputedStyle?.(indeterminateEl).color ?? null,
          );
        }
      });
    });
  }

  public focus(options?: FocusOptions) {
    this.checkboxDir.focus(options);
  }
}
