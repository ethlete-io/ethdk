import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN } from '../../../../directives';
import { SlideToggleDirective, SLIDE_TOGGLE_TOKEN } from '../../directives';

@Component({
  selector: 'et-slide-toggle',
  templateUrl: './slide-toggle.component.html',
  styleUrls: ['./slide-toggle.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-slide-toggle',
  },
  imports: [NgClass, AsyncPipe],
  hostDirectives: [SlideToggleDirective, InputDirective],
})
export class SlideToggleComponent {
  protected readonly slideToggle = inject(SLIDE_TOGGLE_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  constructor() {
    this.input._setControlType('et-control--slide-toggle');
  }
}
