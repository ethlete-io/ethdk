import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN, NativeInputRefDirective, NATIVE_INPUT_REF_TOKEN } from '../../../../directives';
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
export class SlideToggleComponent implements OnInit {
  protected readonly slideToggle = inject(SLIDE_TOGGLE_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN, { static: true })
  protected readonly nativeInputRef!: NativeInputRefDirective;

  constructor() {
    this.input._setControlType('et-control--slide-toggle');
    this.input._setControlGroupType('et-control-group--slide-toggle');
  }

  ngOnInit(): void {
    this.input._setNativeInputRef(this.nativeInputRef);
  }
}
