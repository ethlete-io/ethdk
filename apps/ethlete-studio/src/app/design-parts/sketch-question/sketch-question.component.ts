import { Component, input, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'ethlete-sketch-question',
  template: `{{ question() }}`,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'm-0 block truncate text-ui-md font-ui-medium text-et-surface',
    'data-sk-question': '',
  },
})
export class SketchQuestionComponent {
  public question = input.required<string>();
}
