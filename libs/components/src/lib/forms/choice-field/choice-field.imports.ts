import { FormFieldDirective, LabelDirective } from '../form-field/headless';
import { HintComponent } from '../form-field/hint.component';
import { ChoiceFieldComponent } from './choice-field.component';

export const CHOICE_FIELD_IMPORTS = [ChoiceFieldComponent, FormFieldDirective, LabelDirective, HintComponent] as const;
