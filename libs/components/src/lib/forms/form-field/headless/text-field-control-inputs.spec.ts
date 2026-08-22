import '../../../../test-helpers';
import { ColorInputComponent } from '../../color-input/color-input.component';
import { InputComponent } from '../../input/input.component';
import { NumberInputComponent } from '../../input/number-input.component';
import { PasswordInputComponent } from '../../input/password-input.component';
import { expectWrapperExposesBaseInputs } from '../../testing/wrapper-inputs';
import { TextareaComponent } from '../../textarea/textarea.component';
import { TEXT_FIELD_CONTROL_INPUTS } from './text-field-control.directive';

const WRAPPERS = [
  { selector: 'et-input', component: InputComponent },
  { selector: 'et-number-input', component: NumberInputComponent },
  { selector: 'et-password-input', component: PasswordInputComponent },
  { selector: 'et-textarea', component: TextareaComponent },
  { selector: 'et-color-input', component: ColorInputComponent },
];

describe('text field shell wrappers', () => {
  for (const wrapper of WRAPPERS) {
    it(`${wrapper.selector} exposes every input of its base directive`, () => {
      expectWrapperExposesBaseInputs(wrapper, TEXT_FIELD_CONTROL_INPUTS);
    });
  }
});
