import { Component, resource, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField, validateAsync } from '@angular/forms/signals';
import { FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS } from '@ethlete/components';
import { firstValueFrom, map, timer } from 'rxjs';

const OUT_OF_STOCK = ['red'];

@Component({
  selector: 'app-radio-group-async-validation-example',
  template: `
    <et-radio-group [formField]="colorForm.color">
      <et-label>Color</et-label>
      @for (option of OPTIONS; track option.value) {
        <et-radio [value]="option.value">{{ option.label }}</et-radio>
      }
      <et-hint>Each pick is checked against stock for about a second; red is out of stock.</et-hint>
    </et-radio-group>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [FORM_FIELD_IMPORTS, RADIO_GROUP_IMPORTS, FormField],
})
export class RadioGroupAsyncValidationExampleComponent {
  protected readonly OPTIONS = [
    { value: 'red', label: 'Red' },
    { value: 'green', label: 'Green' },
    { value: 'blue', label: 'Blue' },
  ];

  private model = signal<{ color: string | null }>({ color: null });

  protected colorForm = form(this.model, (s) => {
    validateAsync(s.color, {
      params: ({ value }) => value() ?? undefined,
      factory: (params) =>
        resource({
          params: () => params(),
          loader: ({ params: color }) => firstValueFrom(timer(1200).pipe(map(() => OUT_OF_STOCK.includes(color)))),
        }),
      onSuccess: (isOutOfStock) =>
        isOutOfStock ? { kind: 'outOfStock', message: 'That color is out of stock' } : null,
      onError: () => null,
    });
  });
}
