import '../../../../test-helpers';
import { ColorInputComponent } from '../../color-input/color-input.component';
import { InputComponent } from '../../input/input.component';
import { NumberInputComponent } from '../../input/number-input.component';
import { PasswordInputComponent } from '../../input/password-input.component';
import { expectWrapperExposesBaseInputs, expectWrapperExposesBaseOutputs } from '../../testing/wrapper-inputs';
import { TextareaComponent } from '../../textarea/textarea.component';
import { ACCESSIBLE_NAME_INPUTS } from './accessible-name-control.directive';
import { TEXT_FIELD_CONTROL_INPUTS } from './text-field-control.directive';

const WRAPPERS = [
  { selector: 'et-input', component: InputComponent },
  { selector: 'et-number-input', component: NumberInputComponent },
  { selector: 'et-password-input', component: PasswordInputComponent },
  { selector: 'et-textarea', component: TextareaComponent },
  { selector: 'et-color-input', component: ColorInputComponent },
];

const TEXT_FIELD_CONTROL_OUTPUTS = ['valueChange', 'mixedChange', 'touchedChange'];

const bindingName = (entry: string) => entry.replace(/:.*$/, '').trim();

describe('hand-copied accessible name inputs', () => {
  it('TEXT_FIELD_CONTROL_INPUTS lists exactly the ACCESSIBLE_NAME_INPUTS naming inputs', () => {
    const copied = TEXT_FIELD_CONTROL_INPUTS.map(bindingName).filter((name) => name.startsWith('aria-'));

    expect(new Set(copied)).toEqual(new Set(ACCESSIBLE_NAME_INPUTS.map(bindingName)));
  });
});

describe('text field shell wrappers', () => {
  for (const wrapper of WRAPPERS) {
    it(`${wrapper.selector} exposes every input of its base directive`, () => {
      expectWrapperExposesBaseInputs(wrapper, TEXT_FIELD_CONTROL_INPUTS);
    });

    it(`${wrapper.selector} exposes every output of its base directive`, () => {
      expectWrapperExposesBaseOutputs(wrapper, TEXT_FIELD_CONTROL_OUTPUTS);
    });
  }
});
