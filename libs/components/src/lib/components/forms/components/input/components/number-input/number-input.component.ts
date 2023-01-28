import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN, NativeInputRefDirective, NATIVE_INPUT_REF_TOKEN } from '../../../../directives';
import { NumberInputDirective, NUMBER_INPUT_TOKEN } from '../../directives';

@Component({
  selector: 'et-number-input',
  templateUrl: './number-input.component.html',
  styleUrls: ['./number-input.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-number-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [NumberInputDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class NumberInputComponent implements OnInit {
  protected readonly numberInput = inject(NUMBER_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN, { static: true })
  protected readonly nativeInputRef!: NativeInputRefDirective;

  ngOnInit(): void {
    this.input._setNativeInputRef(this.nativeInputRef);
  }
}
