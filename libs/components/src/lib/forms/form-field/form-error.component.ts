import { Component, input, ViewEncapsulation } from '@angular/core';
import { ValidationError } from '@angular/forms/signals';

@Component({
  selector: 'et-form-error',
  template: '{{ error().message }}',
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-form-error',
  },
})
export class FormErrorComponent {
  public error = input.required<ValidationError.WithOptionalFieldTree>();
}
