import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN, NativeInputRefDirective, NATIVE_INPUT_REF_TOKEN } from '../../../../directives';
import { CheckboxDirective, CHECKBOX_TOKEN } from '../../directives';

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
  imports: [NgClass, AsyncPipe, NativeInputRefDirective],
  hostDirectives: [CheckboxDirective, InputDirective],
})
export class CheckboxComponent implements OnInit {
  protected readonly checkbox = inject(CHECKBOX_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN, { static: true })
  protected readonly nativeInputRef!: NativeInputRefDirective;

  constructor() {
    this.input._setControlType('et-control--checkbox');
  }

  ngOnInit(): void {
    this.checkbox.nativeInputRef$.next(this.nativeInputRef);
  }
}
