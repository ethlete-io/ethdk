import { AsyncPipe, NgClass } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN, NativeInputRefDirective, NATIVE_INPUT_REF_TOKEN } from '../../../../directives';
import { RadioDirective, RADIO_GROUP_TOKEN, RADIO_TOKEN } from '../../directives';

@Component({
  selector: 'et-radio',
  templateUrl: './radio.component.html',
  styleUrls: ['./radio.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-radio',
  },
  imports: [AsyncPipe, NgClass, NativeInputRefDirective],
  hostDirectives: [
    { directive: RadioDirective, inputs: ['value', 'disabled'] },
    { directive: InputDirective, inputs: ['autocomplete'] },
  ],
})
export class RadioComponent implements OnInit {
  protected readonly radio = inject(RADIO_TOKEN);
  protected readonly radioGroup = inject(RADIO_GROUP_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN, { static: true })
  protected readonly nativeInputRef!: NativeInputRefDirective;

  ngOnInit(): void {
    this.input._setNativeInputRef(this.nativeInputRef);
  }
}
