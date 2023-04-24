import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, ViewEncapsulation } from '@angular/core';
import { InputDirective, NativeInputRefDirective } from '../../../../directives';
import { InputBase } from '../../../../utils';
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
  imports: [NgClass, AsyncPipe, NativeInputRefDirective],
  hostDirectives: [SlideToggleDirective, InputDirective],
})
export class SlideToggleComponent extends InputBase {
  protected readonly slideToggle = inject(SLIDE_TOGGLE_TOKEN);
}
