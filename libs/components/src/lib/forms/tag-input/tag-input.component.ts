import { Component, Injector, ViewEncapsulation, inject } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { CHIP_REMOVE_FOCUS_FALLBACK, CHIP_REMOVE_TAB_STOP, ChipComponent } from '../../chip';
import { TagInputDirective, TagInputFieldDirective } from './headless';
import { ACCESSIBLE_NAME_INPUTS } from '../form-field/headless';
import { FIELD_STATE_INPUTS } from '../form-field/headless/field-state-control.directive';

@Component({
  selector: 'et-tag-input',
  templateUrl: './tag-input.component.html',
  styleUrl: './tag-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ChipComponent, TagInputFieldDirective],
  providers: [
    { provide: CHIP_REMOVE_TAB_STOP, useValue: false },
    {
      provide: CHIP_REMOVE_FOCUS_FALLBACK,
      useFactory: () => {
        const injector = inject(Injector);

        return () => injector.get(TagInputDirective).focus();
      },
    },
  ],
  hostDirectives: [
    {
      directive: TagInputDirective,
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
        'maxLength',
        'pending',
        'placeholder',
        'mixedLabel',
        'separators',
        'allowDuplicates',
        'normalizeValue',
        'maxSelection',
        ...ACCESSIBLE_NAME_INPUTS,
        ...FIELD_STATE_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange', 'touch'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-tag-input',
    // chip remove buttons stop propagation - any other click focuses the text field
    '(click)': 'tagInput.activate()',
  },
})
export class TagInputComponent {
  protected tagInput = inject(TagInputDirective);

  public focus(options?: FocusOptions) {
    this.tagInput.focus(options);
  }
}
