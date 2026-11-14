import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  input,
  viewChild,
  untracked,
  ViewEncapsulation,
} from '@angular/core';
import { ColorInteractiveDirective, injectStyleManager } from '@ethlete/core';
import { IconDirective, provideIcons, TIMES_ICON } from '../../icon';
import { FormFieldControlSuffixStylesComponent } from '../form-field/form-field-control-suffix-styles.component';
import { injectFormFieldLabels } from '../form-field/form-field-labels';
import { TEXT_FIELD_CONTROL_INPUTS } from '../form-field/headless/text-field-control.directive';
import { ControlSuffixDirective } from '../form-field/partials';
import { InputDirective } from './headless';

@Component({
  selector: 'et-input',
  templateUrl: './input.component.html',
  styleUrl: './input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ControlSuffixDirective, IconDirective],
  providers: [provideIcons(TIMES_ICON)],
  hostDirectives: [
    {
      directive: InputDirective,
      inputs: ['type', 'placeholder', 'autocomplete', 'textAlign', 'value', ...TEXT_FIELD_CONTROL_INPUTS],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'touch'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-input',
    '(click)': 'inputDir.activate()',
  },
})
export class InputComponent {
  protected inputDir = inject(InputDirective);

  private formFieldLabels = injectFormFieldLabels();

  /** Shows a clear (×) control while the focused input holds a value. Clearing empties the value and keeps focus. */
  public clearable = input(false, { transform: booleanAttribute });
  public clearLabel = input<string | null>(null);

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  protected resolvedClearLabel = computed(() => this.clearLabel() ?? this.formFieldLabels().clear);

  protected showClear = computed(
    () =>
      this.clearable() &&
      this.inputDir.hasValue() &&
      this.inputDir.focused() &&
      !this.inputDir.disabled() &&
      !this.inputDir.readonly(),
  );

  constructor() {
    const styleManager = injectStyleManager();

    effect(() => {
      if (this.clearable()) untracked(() => styleManager.mount(FormFieldControlSuffixStylesComponent));
    });

    afterNextRender(() => {
      const nativeInput = this.nativeInput()?.nativeElement ?? null;

      this.inputDir.focusTarget.set(nativeInput);
      this.inputDir.nativeControl.set(nativeInput);
    });
  }

  /** Empties the value, as the clear control does. A no-op while disabled or readonly. */
  public clear() {
    if (this.inputDir.disabled() || this.inputDir.readonly()) {
      return;
    }

    this.inputDir.mixed.set(false);
    this.inputDir.value.set('');
  }

  protected handleClearClick(event: Event) {
    event.stopPropagation();
    this.clear();
    this.inputDir.focus();
  }

  public focus(options?: FocusOptions) {
    this.inputDir.focus(options);
  }
}
