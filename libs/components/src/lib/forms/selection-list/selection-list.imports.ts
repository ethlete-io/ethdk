import { CheckboxGroupSelectAllComponent } from './checkbox-group/checkbox-group-select-all.component';
import { CheckboxGroupComponent } from './checkbox-group/checkbox-group.component';
import { CheckboxOptionComponent } from './checkbox-group/checkbox-option.component';
import { SelectionListControlDirective } from './headless/selection-list-control.directive';
import { SelectionListDirective } from './headless/selection-list.directive';
import { SelectionOptionDirective } from './headless/selection-option.directive';
import { RadioGroupComponent } from './radio-group/radio-group.component';
import { RadioComponent } from './radio-group/radio.component';
import { SegmentedButtonGroupComponent } from './segmented-button-group/segmented-button-group.component';
import { SegmentedButtonComponent } from './segmented-button-group/segmented-button.component';

/**
 * The headless selection engine only (`etSelectionList`, `etSelectionOption`, `etSelectionListControl`) -
 * selection state, roving-tabindex keyboard navigation and the form-field wiring, with no visual opinion.
 * For a ready-made group use {@link CHECKBOX_GROUP_IMPORTS}, {@link RADIO_GROUP_IMPORTS} or
 * {@link SEGMENTED_BUTTON_IMPORTS} instead - they apply these directives themselves.
 */
export const SELECTION_LIST_IMPORTS = [
  SelectionListDirective,
  SelectionOptionDirective,
  SelectionListControlDirective,
] as const;

/**
 * The multi-select group: `et-checkbox-group` with `et-checkbox-option` children, plus the
 * `et-checkbox-group-select-all` toggle for the mixed-state "select all" row.
 */
export const CHECKBOX_GROUP_IMPORTS = [
  CheckboxGroupComponent,
  CheckboxOptionComponent,
  CheckboxGroupSelectAllComponent,
] as const;

/** The single-select radio group: `et-radio-group` with `et-radio` children. */
export const RADIO_GROUP_IMPORTS = [RadioGroupComponent, RadioComponent] as const;

/**
 * The single-select connected button row: `et-segmented-button-group` with `et-segmented-button`
 * children (`variant="tabs"` for the tabs look).
 */
export const SEGMENTED_BUTTON_IMPORTS = [SegmentedButtonGroupComponent, SegmentedButtonComponent] as const;
