/* eslint-disable @angular-eslint/no-inputs-metadata-property */
import { AsyncPipe, NgIf } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { LetDirective } from '@ethlete/core';
import { QueryDirective } from '@ethlete/query';
import { ButtonDirective } from '../../directives';

@Component({
  selector: '[et-button]',
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  hostDirectives: [{ directive: ButtonDirective, inputs: ['disabled', 'type'] }],
  imports: [QueryDirective, AsyncPipe, NgIf, LetDirective],
  host: {
    class: 'et-button',
  },
})
export class ButtonComponent {
  protected button = inject(ButtonDirective);
}
