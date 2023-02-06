import { AsyncPipe, NgForOf, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN, NativeInputRefDirective, NATIVE_INPUT_REF_TOKEN } from '../../../../directives';
import { NativeSelectInputDirective as NativeSelectDirective, NATIVE_SELECT_INPUT_TOKEN } from '../../directives';

@Component({
  selector: 'et-native-select',
  templateUrl: './native-select.component.html',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-native-select',
  },
  imports: [NativeInputRefDirective, NgForOf, NgTemplateOutlet, AsyncPipe],
  hostDirectives: [NativeSelectDirective, { directive: InputDirective, inputs: ['autocomplete'] }],
})
export class NativeSelectInputComponent implements OnInit {
  protected readonly select = inject(NATIVE_SELECT_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN, { static: true })
  protected readonly nativeInputRef!: NativeInputRefDirective;

  ngOnInit(): void {
    this.input._setNativeInputRef(this.nativeInputRef);
  }
}
