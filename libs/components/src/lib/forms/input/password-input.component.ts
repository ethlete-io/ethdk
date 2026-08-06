import {
  afterNextRender,
  booleanAttribute,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { EYE_ICON, EYE_SLASH_ICON, IconDirective, provideIcons, TRIANGLE_EXCLAMATION_ICON } from '../../icon';
import { TooltipDirective } from '../../tooltip';
import { PasswordInputDirective } from './headless';
import { injectInputLabels } from '../../forms/input/input-labels';
import { ControlSuffixDirective } from '../form-field/partials';

@Component({
  selector: 'et-password-input',
  templateUrl: './password-input.component.html',
  styleUrl: './password-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ControlSuffixDirective, IconDirective, TooltipDirective],
  providers: [provideIcons(EYE_ICON, EYE_SLASH_ICON, TRIANGLE_EXCLAMATION_ICON)],
  hostDirectives: [
    {
      directive: PasswordInputDirective,
      inputs: [
        'placeholder',
        'autocomplete',
        'value',
        'mixed',
        'mixedLabel',
        'revealed',
        'disabled',
        'readonly',
        'hidden',
        'invalid',
        'errors',
        'required',
        'name',
        'maxLength',
        'pending',
        'aria-label',
        'aria-labelledby',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'revealedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-password-input',
    '(click)': 'passwordDir.activate()',
  },
})
export class PasswordInputComponent {
  private inputLabels = injectInputLabels();

  protected passwordDir = inject(PasswordInputDirective);

  /** Whether the reveal (show/hide) toggle renders. */
  public revealable = input(true, { transform: booleanAttribute });

  /** Accessible name of the reveal toggle while the value is hidden (the "show" action). */
  public revealLabel = input<string | null>(null);

  /** Accessible name of the reveal toggle while the value is shown (the "hide" action). */
  public hideLabel = input<string | null>(null);

  /** Show a warning indicator while the field is focused and Caps Lock is on. */
  public capsLockWarning = input(false, { transform: booleanAttribute });

  /** Text of the Caps Lock warning - announced by the live region and shown as the icon's tooltip. */
  public capsLockLabel = input<string | null>(null);

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

  /** The string in effect: this instance's `revealLabel`, else the domain's label set. */
  protected resolvedRevealLabel = computed(() => this.revealLabel() ?? this.inputLabels().showPassword);

  /** The string in effect: this instance's `hideLabel`, else the domain's label set. */
  protected resolvedHideLabel = computed(() => this.hideLabel() ?? this.inputLabels().hidePassword);

  /** The string in effect: this instance's `capsLockLabel`, else the domain's label set. */
  protected resolvedCapsLockLabel = computed(() => this.capsLockLabel() ?? this.inputLabels().capsLockOn);

  constructor() {
    afterNextRender(() => {
      const nativeInput = this.nativeInput()?.nativeElement ?? null;

      this.passwordDir.focusTarget.set(nativeInput);
      this.passwordDir.nativeControl.set(nativeInput);
    });
  }

  protected showCapsLockWarning() {
    return this.capsLockWarning() && this.passwordDir.capsLockOn() && this.passwordDir.focused();
  }

  public syncNativeValue(event: Event) {
    this.passwordDir.syncFromNativeInput(event.target as HTMLInputElement);
  }
}
