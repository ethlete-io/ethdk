import { Component, computed, input, ViewEncapsulation } from '@angular/core';
import { ColorInteractiveDirective } from '@ethlete/core';
import { injectFormFieldLabels } from '../../form-field/form-field-labels';
import { SelectionListControlDirective } from '../headless';

/**
 * The "select all" row for an `et-checkbox-group`: one control that ticks every option, clears them
 * all, and shows the **mixed** state while only some are picked.
 *
 * Put it inside the group, above the options. The tri-state logic is
 * [`etSelectionListControl`](/components/choice-inputs#select-all)'s, which this composes - the
 * component exists so the row doesn't have to be hand-rolled with its own markup and CSS every time.
 *
 * @example
 * <et-checkbox-group [formField]="form.toppings">
 *   <et-label>Toppings</et-label>
 *   <et-checkbox-group-select-all />
 *   @for (topping of TOPPINGS; track topping) {
 *     <et-checkbox-option [value]="topping">{{ topping }}</et-checkbox-option>
 *   }
 * </et-checkbox-group>
 */
@Component({
  selector: 'et-checkbox-group-select-all',
  template: `
    <span class="et-checkbox-group-select-all-box">
      <svg class="et-checkbox-group-select-all-check" viewBox="0 0 12 10" fill="none" aria-hidden="true">
        <path
          d="M1 5L4.5 8.5L11 1.5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      <span class="et-checkbox-group-select-all-dash" aria-hidden="true"></span>
    </span>
    <span class="et-checkbox-group-select-all-label">{{ resolvedLabel() }}</span>
  `,
  styleUrl: './checkbox-group-select-all.component.css',
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [SelectionListControlDirective, ColorInteractiveDirective],
  host: {
    class: 'et-checkbox-group-select-all',
  },
})
export class CheckboxGroupSelectAllComponent {
  private labels = injectFormFieldLabels();

  /** The row's text. Defaults to the shared `selectAll` label - see {@link provideFormFieldLabels}. */
  public label = input<string | null>(null);

  protected resolvedLabel = computed(() => this.label() ?? this.labels().selectAll);
}
