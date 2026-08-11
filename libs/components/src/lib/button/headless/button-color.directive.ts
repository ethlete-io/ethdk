import { Directive, effect, inject, input, untracked } from '@angular/core';
import { ColorThemeInput, ProvideColorDirective } from '@ethlete/core';
import { ButtonDirective } from './button.directive';

export const INHERIT_COLOR = 'inherit';

/**
 * A color theme name (or theme object), `surface` for the ambient surface's neutral swatch, or
 * `inherit` for whatever color theme surrounds the button.
 */
export type ButtonColor = ColorThemeInput | typeof INHERIT_COLOR;

@Directive({
  selector: '[etButtonColor]',
  hostDirectives: [ProvideColorDirective],
})
export class ButtonColorDirective {
  private provideColor = inject(ProvideColorDirective);
  private buttonDir = inject(ButtonDirective);

  /**
   * The color theme the button renders in. Defaults to the surrounding one; pass `surface` to take
   * the neutral colors of the surface the button sits on, so a secondary action reads as chrome
   * without a neutral color theme being registered.
   */
  public color = input<ButtonColor | undefined>(undefined);

  /**
   * The color theme to swap to while the button is `pressed` - `inherit` for a toggle that stays
   * neutral until it is active and then picks up the surrounding theme. Defaults to `color`, so a
   * pressed button keeps its resting theme and only its variant changes.
   */
  public pressedColor = input<ButtonColor | undefined>(undefined);

  constructor() {
    effect(() => {
      const pressedColor = this.pressedColor();
      const color = this.buttonDir.pressed() && pressedColor !== undefined ? pressedColor : this.color();

      untracked(() => {
        if (color === undefined) {
          this.provideColor.clearForcedColor();

          return;
        }

        this.provideColor.forceColor(color === INHERIT_COLOR ? null : color);
      });
    });
  }
}
