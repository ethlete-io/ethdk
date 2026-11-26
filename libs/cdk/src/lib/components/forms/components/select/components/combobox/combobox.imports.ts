import { InputPrefixDirective } from '../../../../directives/input-prefix';
import { InputSuffixDirective } from '../../../../directives/input-suffix';
import { LabelComponent } from '../../../label/components/label';
import { SelectFieldComponent } from '../select-field';
import { ComboboxComponent } from './components/combobox';
import { ComboboxBodyEmptyTemplateDirective } from './directives/combobox-body-empty-template';
import { ComboboxBodyErrorTemplateDirective } from './directives/combobox-body-error-template';
import { ComboboxBodyLoadingTemplateDirective } from './directives/combobox-body-loading-template';
import { ComboboxOptionTemplateDirective } from './directives/combobox-option-template';
import { ComboboxSelectedOptionTemplateDirective } from './directives/combobox-selected-option-template';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
export const ComboboxImports = [
  ComboboxComponent,
  SelectFieldComponent,
  InputPrefixDirective,
  InputSuffixDirective,
  LabelComponent,
  ComboboxOptionTemplateDirective,
  ComboboxSelectedOptionTemplateDirective,
  ComboboxBodyErrorTemplateDirective,
  ComboboxBodyLoadingTemplateDirective,
  ComboboxBodyEmptyTemplateDirective,
] as const;
