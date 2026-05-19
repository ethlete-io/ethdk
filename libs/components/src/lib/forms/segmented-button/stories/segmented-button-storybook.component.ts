import { ChangeDetectionStrategy, Component, computed, signal, ViewEncapsulation } from '@angular/core';
import { form, FormField } from '@angular/forms/signals';
import { CHOICE_FIELD_IMPORTS } from '../../choice-field';
import { SegmentedButtonGroupDirective } from '../../segmented-button-group';
import { SEGMENTED_BUTTON_IMPORTS } from '../segmented-button.imports';

@Component({
  selector: 'et-sb-segmented-button-single',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <div [formField]="demoForm.size" class="flex" etSegmentedButtonGroup>
        <et-segmented-button value="sm">Small</et-segmented-button>
        <et-segmented-button value="md">Medium</et-segmented-button>
        <et-segmented-button value="lg">Large</et-segmented-button>
      </div>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...SEGMENTED_BUTTON_IMPORTS, SegmentedButtonGroupDirective, FormField],
})
export class SegmentedButtonSingleStorybookComponent {
  private formModel = signal({
    size: 'md' as string | null,
  });

  public demoForm = form(this.formModel);

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-segmented-button-multiple',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <div [multiple]="true" [formField]="demoForm.toppings" class="flex" etSegmentedButtonGroup>
        <et-segmented-button value="cheese">Cheese</et-segmented-button>
        <et-segmented-button value="pepperoni">Pepperoni</et-segmented-button>
        <et-segmented-button value="mushrooms">Mushrooms</et-segmented-button>
        <et-segmented-button value="olives">Olives</et-segmented-button>
      </div>

      <pre class="rounded bg-et-surface-bg p-2 text-xs">{{ debugInfo() }}</pre>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...CHOICE_FIELD_IMPORTS, ...SEGMENTED_BUTTON_IMPORTS, SegmentedButtonGroupDirective, FormField],
})
export class SegmentedButtonMultipleStorybookComponent {
  private formModel = signal({
    toppings: [] as string[],
  });

  public demoForm = form(this.formModel);

  public debugInfo = computed(() => JSON.stringify(this.formModel(), null, 2));
}

@Component({
  selector: 'et-sb-segmented-button-disabled',
  template: `
    <div class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <div [disabled]="true" class="flex" value="md" etSegmentedButtonGroup>
        <et-segmented-button value="sm">Small</et-segmented-button>
        <et-segmented-button [checked]="true" value="md">Medium</et-segmented-button>
        <et-segmented-button value="lg">Large</et-segmented-button>
      </div>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [...SEGMENTED_BUTTON_IMPORTS, SegmentedButtonGroupDirective],
})
export class SegmentedButtonDisabledStorybookComponent {}
