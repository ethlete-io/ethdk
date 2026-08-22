import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../../../test-helpers';
import { ColorInputComponent } from '../../color-input/color-input.component';
import { InputComponent } from '../../input/input.component';
import { NumberInputComponent } from '../../input/number-input.component';
import { PasswordInputComponent } from '../../input/password-input.component';
import { TextareaComponent } from '../../textarea/textarea.component';
import { TEXT_FIELD_CONTROL_INPUTS } from './text-field-control.directive';

const CASES = [
  { selector: 'et-input', component: InputComponent },
  { selector: 'et-number-input', component: NumberInputComponent },
  { selector: 'et-password-input', component: PasswordInputComponent },
  { selector: 'et-textarea', component: TextareaComponent },
  { selector: 'et-color-input', component: ColorInputComponent },
];

describe('text field shell wrappers', () => {
  for (const { selector, component } of CASES) {
    it(`${selector} exposes every input of its base directive`, () => {
      const bindings = TEXT_FIELD_CONTROL_INPUTS.map((name) => `[${name}]="v"`).join(' ');

      const Host = Component({ template: `<${selector} ${bindings} />`, imports: [component] })(
        class {
          v = null;
        },
      );

      TestBed.configureTestingModule({ imports: [Host] });
      const fixture = TestBed.createComponent(Host);

      expect(() => fixture.detectChanges()).not.toThrow();
    });
  }
});
