import { Directive, TemplateRef, afterNextRender, inject } from '@angular/core';
import { registerSingleton } from '../../form-field/headless';
import { RuntimeError } from '@ethlete/core';
import { PHONE_INPUT_ERROR_CODES } from '../phone-input-errors';
import { PhoneInputDirective } from './phone-input.directive';

export type PhoneInputFlagCountry = {
  /** Lower-cased ISO 3166-1 alpha-2 code (`'de'`, `'us'`, …). */
  iso2: string;
  /** Dial code without the leading `+` (`'49'`). */
  dialCode: string;
  /** The default emoji flag - render it to keep the built-in look for some countries. */
  flag: string;
};

export type PhoneInputFlagContext = {
  $implicit: PhoneInputFlagCountry;
};

/**
 * Replaces the emoji flags of `et-phone-input` (in the country trigger and the option list)
 * with custom art:
 *
 * ```html
 * <et-phone-input>
 *   <ng-template etPhoneInputFlag let-country>
 *     <img [src]="'/flags/' + country.iso2 + '.svg'" [alt]="''" />
 *   </ng-template>
 * </et-phone-input>
 * ```
 */
@Directive({ selector: 'ng-template[etPhoneInputFlag]' })
export class PhoneInputFlagDirective {
  private phoneInput = inject(PhoneInputDirective, { optional: true });
  public templateRef = inject<TemplateRef<PhoneInputFlagContext>>(TemplateRef);

  constructor() {
    registerSingleton(this.phoneInput?.registeredFlagTemplate, this);

    if (ngDevMode) {
      afterNextRender(() => {
        if (!this.phoneInput) {
          throw new RuntimeError(
            PHONE_INPUT_ERROR_CODES.FLAG_TEMPLATE_OUTSIDE_PHONE_INPUT,
            '[PhoneInputFlagDirective] etPhoneInputFlag must be placed inside an [etPhoneInput] element.',
          );
        }
      });
    }
  }
}
