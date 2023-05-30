import { Directive, InjectionToken } from '@angular/core';

export const COMBOBOX_DIR_TOKEN = new InjectionToken<ComboboxDirective>('ET_COMBOBOX_INPUT_TOKEN');

@Directive({
  standalone: true,
  providers: [
    {
      provide: COMBOBOX_DIR_TOKEN,
      useExisting: ComboboxDirective,
    },
  ],
})
export class ComboboxDirective {}
