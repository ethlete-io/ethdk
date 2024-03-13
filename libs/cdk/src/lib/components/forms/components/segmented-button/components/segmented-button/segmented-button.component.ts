import { AsyncPipe, NgClass } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  ViewChild,
  ViewEncapsulation,
  inject,
} from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { InputBase } from '../../../../utils';
import { SEGMENTED_BUTTON_TOKEN, SegmentedButtonDirective } from '../../directives/segmented-button';
import { SEGMENTED_BUTTON_GROUP_TOKEN } from '../../directives/segmented-button-group';

@Component({
  selector: 'et-segmented-button',
  templateUrl: './segmented-button.component.html',
  styleUrls: ['./segmented-button.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-segmented-button',
  },
  imports: [AsyncPipe, NgClass, NativeInputRefDirective],
  hostDirectives: [
    { directive: SegmentedButtonDirective, inputs: ['value', 'disabled'] },
    { directive: InputDirective },
  ],
})
export class SegmentedButtonComponent extends InputBase implements OnInit {
  protected readonly segmentedButton = inject(SEGMENTED_BUTTON_TOKEN);
  protected readonly segmentedButtonGroup = inject(SEGMENTED_BUTTON_GROUP_TOKEN);

  @ViewChild('activeIndicator', { static: true })
  activeIndicator?: ElementRef<HTMLElement>;

  ngOnInit() {
    if (!this.activeIndicator) {
      return;
    }

    this.segmentedButton._setActiveIndicatorElement(this.activeIndicator.nativeElement);
  }
}
