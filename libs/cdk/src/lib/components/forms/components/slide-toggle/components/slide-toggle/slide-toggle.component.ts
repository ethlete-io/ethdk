import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { InputBase } from '../../../../utils';
import { SLIDE_TOGGLE_TOKEN, SlideToggleDirective } from '../../directives/slide-toggle';

@Component({
  selector: 'et-slide-toggle',
  templateUrl: './slide-toggle.component.html',
  styleUrls: ['./slide-toggle.component.scss'],
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
