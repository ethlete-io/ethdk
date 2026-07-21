import { afterNextRender, Component, ElementRef, inject, input, viewChild, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { EYE_ICON, EYE_SLASH_ICON, IconDirective, provideIcons, TRIANGLE_EXCLAMATION_ICON } from '../../icon';
import { PasswordInputDirective } from './headless';

@Component({
  selector: 'et-password-input',
  templateUrl: './password-input.component.html',
  styleUrl: './password-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective],
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
  protected passwordDir = inject(PasswordInputDirective);

  /** Whether the reveal (show/hide) toggle renders. */
  public revealable = input(true);

  /** Accessible name of the reveal toggle while the value is hidden (the "show" action). */
  public revealLabel = input('Show password');

  /** Accessible name of the reveal toggle while the value is shown (the "hide" action). */
  public hideLabel = input('Hide password');

  /** Show a warning indicator while the field is focused and Caps Lock is on. */
  public capsLockWarning = input(false);

  /** Accessible text of the Caps Lock warning. */
  public capsLockLabel = input('Caps Lock is on');

  private nativeInput = viewChild<ElementRef<HTMLInputElement>>('nativeInput');

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
