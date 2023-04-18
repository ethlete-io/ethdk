import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { ButtonDirective } from '@ethlete/cdk';

@Component({
  selector: '[et-elevated-button], [et-filled-button], [et-tonal-button], [et-outlined-button], [et-text-button]',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-button',
  },
  hostDirectives: [{ directive: ButtonDirective, inputs: ['disabled', 'type', 'pressed'] }],
})
export class ButtonComponent {
  protected readonly button = inject(ButtonDirective);
}
