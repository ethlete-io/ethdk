import { afterNextRender, Component, ElementRef, inject, viewChild, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { TextareaDirective } from './headless';
import { TEXT_FIELD_CONTROL_INPUTS } from '../form-field/headless/text-field-control.directive';

@Component({
  selector: 'et-textarea',
  templateUrl: './textarea.component.html',
  styleUrl: './textarea.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [
    {
      directive: TextareaDirective,
      inputs: [
        'placeholder',
        'autocomplete',
        'rows',
        'autosize',
        'minRows',
        'maxRows',
        'resize',
        'value',
        ...TEXT_FIELD_CONTROL_INPUTS,
      ],
      outputs: ['valueChange', 'mixedChange', 'touchedChange'],
    },
    ColorInteractiveDirective,
  ],
  host: {
    class: 'et-textarea',
    '(click)': 'textareaDir.activate()',
  },
})
export class TextareaComponent {
  protected textareaDir = inject(TextareaDirective);

  private nativeTextarea = viewChild<ElementRef<HTMLTextAreaElement>>('nativeTextarea');

  constructor() {
    afterNextRender(() => {
      const nativeTextarea = this.nativeTextarea()?.nativeElement ?? null;

      this.textareaDir.focusTarget.set(nativeTextarea);
      this.textareaDir.nativeControl.set(nativeTextarea);
    });
  }

  public syncNativeValue(event: Event) {
    this.textareaDir.syncFromNativeInput(event.target as HTMLTextAreaElement);
  }

  public focus(options?: FocusOptions) {
    this.textareaDir.focus(options);
  }
}
