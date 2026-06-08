import { ChangeDetectionStrategy, Component, input, linkedSignal, ViewEncapsulation } from '@angular/core';
import { disabled, form, FormField, required } from '@angular/forms/signals';
import { ProvideColorDirective } from '@ethlete/core';
import { HintComponent } from '../../../form-field';
import { SegmentedButtonGroupComponent } from '../segmented-button-group.component';
import { SegmentedButtonComponent } from '../segmented-button.component';

@Component({
  selector: 'et-sb-segmented-button-group',
  template: `
    <div [etProvideColor]="color()" class="flex max-w-md flex-col gap-4 p-8 font-sans">
      <et-segmented-button-group [formField]="demoForm.viewMode">
        <span class="et-segmented-button-group-label">{{ label() }}</span>

        @for (option of options(); track option.value) {
          <et-segmented-button [value]="option.value">{{ option.label }}</et-segmented-button>
        }
        @if (hint()) {
          <et-hint>{{ hint() }}</et-hint>
        }
      </et-segmented-button-group>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SegmentedButtonGroupComponent, SegmentedButtonComponent, FormField, ProvideColorDirective, HintComponent],
})
export class SegmentedButtonGroupStorybookComponent {
  public label = input('View mode');
  public hint = input('');
  public disabled = input(false);
  public required = input(false);
  public color = input('brand');

  public options = input([
    { value: 'list', label: 'List' },
    { value: 'grid', label: 'Grid' },
    { value: 'table', label: 'Table' },
  ]);

  private formModel = linkedSignal(() => ({ viewMode: 'list' as string | null }));

  public demoForm = form(this.formModel, (s) => {
    disabled(s, () => this.disabled());
    required(s.viewMode, { when: () => this.required(), message: 'Please select a view mode' });
  });
}
