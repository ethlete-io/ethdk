import { Component, ViewEncapsulation, inject } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { ChipComponent } from '../../chip';
import { TagInputDirective, TagInputFieldDirective } from './headless';

@Component({
  selector: 'et-tag-input',
  templateUrl: './tag-input.component.html',
  styleUrl: './tag-input.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [ChipComponent, TagInputFieldDirective],
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
        'placeholder',
        'mixedLabel',
        'separators',
        'allowDuplicates',
        'normalizeTag',
        'maxTags',
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-tag-input',
    // chip remove buttons stop propagation — any other click focuses the text field
    '(click)': 'tagInput.activate()',
  },
})
export class TagInputComponent {
  protected tagInput = inject(TagInputDirective);
}
