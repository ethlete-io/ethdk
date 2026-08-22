import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { createCanAnimateSignal, ProvideColorDirective } from '@ethlete/core';
import { FORM_FIELD_SIZES, FormFieldSize } from '../../form-field/form-field.variants';
import { FormSupportComponent } from '../../form-field/partials/form-support.component';
import { FormFieldDirective, injectFormSupport, provideFormSupport } from '../../form-field/headless';
import { SelectionListDirective } from '../../selection-list/headless';
import { SelectionListOrientation } from '../selection-list.types';
import { ACCESSIBLE_NAME_INPUTS } from '../../form-field/headless';

@Component({
  selector: 'et-radio-group',
  templateUrl: './radio-group.component.html',
  styleUrl: './radio-group.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [FormSupportComponent],
  providers: [provideFormSupport()],
  hostDirectives: [
    FormFieldDirective,
    {
      directive: SelectionListDirective,
      inputs: [
        'value',
        'mixed',
        'touched',
        'disabled',
        'readonly',
        'invalid',
        'errors',
        'required',
        'name',
        ...ACCESSIBLE_NAME_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    { directive: ProvideColorDirective, inputs: ['etProvideColor:color'] },
  ],
  host: {
    class: 'et-radio-group',
    '[attr.data-size]': 'size()',
    '[attr.data-orientation]': 'orientation()',
    '[attr.data-can-animate]': 'canAnimate.state() || null',
    '[attr.data-error]': 'support.displaysError() || null',
    '[attr.data-warning]': 'support.displaysWarning() || null',
  },
})
export class RadioGroupComponent {
  private list = inject(SelectionListDirective);
  public support = injectFormSupport();
  public size = input<FormFieldSize>(FORM_FIELD_SIZES.MD);

  /**
   * Lay the options out in a row instead of a column. Horizontal wraps, and the group's label and its
   * error/hint block keep their own lines above and below - only the options flow.
   *
   * Vertical is the default because it scans better and gives each option a full-width hit area; reach
   * for horizontal only when the options are short (two or three words) and the set is small.
   * All four arrow keys move between options either way, as the ARIA pattern expects.
   */
  public orientation = input<SelectionListOrientation>('vertical');

  public canAnimate = createCanAnimateSignal();

  public focus(options?: FocusOptions) {
    this.list.focus(options);
  }
}
