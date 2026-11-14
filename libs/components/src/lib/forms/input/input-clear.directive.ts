import {
  booleanAttribute,
  Component,
  computed,
  Directive,
  inject,
  input,
  signal,
  ViewContainerRef,
  ViewEncapsulation,
} from '@angular/core';
import { injectStyleManager } from '@ethlete/core';
import { IconDirective, provideIcons, TIMES_ICON } from '../../icon';
import { FormFieldControlSuffixStylesComponent } from '../form-field/form-field-control-suffix-styles.component';
import { injectFormFieldLabels } from '../form-field/form-field-labels';
import { ControlSuffixDirective } from '../form-field/partials';
import { InputDirective } from './headless';
import { InputComponent } from './input.component';

/**
 * Adds a clear (×) button to an `et-input`'s suffix stack while the focused input holds a value. Clearing empties
 * the value, emits `valueChange` and keeps focus in the input.
 *
 * @example
 * <et-input [formField]="form.search" etInputClear type="search" />
 */
@Directive({ selector: 'et-input[etInputClear]' })
export class InputClearDirective {
  private input = inject(InputComponent);
  private inputDir = inject(InputDirective);
  private formFieldLabels = injectFormFieldLabels();

  /** Shows the button. Bind `false` to hide it without removing the directive. @default true */
  public etInputClear = input(true, { transform: booleanAttribute });

  /** Accessible name of the button. Defaults to the shared `clear` label - see `provideFormFieldLabels`. */
  public clearLabel = input<string | null>(null);

  /** @internal */
  public resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  /** @internal */
  public showClear = computed(
    () =>
      this.etInputClear() &&
      this.inputDir.hasValue() &&
      this.inputDir.focused() &&
      !this.inputDir.disabled() &&
      !this.inputDir.readonly(),
  );

  constructor() {
    injectStyleManager().mount(FormFieldControlSuffixStylesComponent);
    inject(ViewContainerRef).createComponent(InputClearButtonComponent).instance.clear.set(this);
  }

  /** @internal */
  public handleClearClick(event: Event) {
    event.stopPropagation();
    this.input.clear();
    this.inputDir.focus();
  }
}

@Component({
  selector: 'et-input-clear-button',
  template: `
    <ng-template etControlSuffix>
      @if (clear()?.showClear()) {
        <button
          [attr.aria-label]="clear()?.resolvedClearLabel()"
          (click)="clear()?.handleClearClick($event)"
          (mousedown)="$event.preventDefault()"
          class="et-input-clear"
          animate.enter="et-input-clear--enter"
          animate.leave="et-input-clear--leave"
          tabindex="-1"
          type="button"
        >
          <i etIcon="et-times"></i>
        </button>
      }
    </ng-template>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [ControlSuffixDirective, IconDirective],
  providers: [provideIcons(TIMES_ICON)],
})
class InputClearButtonComponent {
  /** @internal */
  public clear = signal<InputClearDirective | null>(null);
}
