import { Directive, InjectionToken, inject } from '@angular/core';
import { INPUT_TOKEN, InputDirective } from '../../../../directives/input';

export const SHOW_PICKER_TRIGGER_TOKEN = new InjectionToken<ShowPickerTriggerDirective>('SHOW_PICKER_TRIGGER_TOKEN');

@Directive({
  selector: '[etShowPickerTrigger]',
  standalone: true,
  providers: [
    {
      provide: SHOW_PICKER_TRIGGER_TOKEN,
      useExisting: ShowPickerTriggerDirective,
    },
  ],
  host: {
    '(click)': '_onInputInteraction($event)',
  },
})
export class ShowPickerTriggerDirective {
  readonly input = inject<InputDirective>(INPUT_TOKEN);

  _onInputInteraction(event: Event) {
    event.stopPropagation();
    const el = this.input.nativeInputRef?.element.nativeElement;

    if (el && 'showPicker' in el) {
      //@ts-expect-error showPicker is currently not in the type definition
      // See https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/showPicker
      el.showPicker();
    }
  }
}
