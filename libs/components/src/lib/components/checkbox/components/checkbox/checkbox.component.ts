import { NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { CheckboxDirective } from '../../directives';

@Component({
  selector: 'et-checkbox',
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-checkbox',
  },
  imports: [NgClass],
  hostDirectives: [{ directive: CheckboxDirective, inputs: ['checked', 'disabled', 'indeterminate'] }],
})
export class CheckboxComponent {
  protected checkbox = inject(CheckboxDirective);
}
