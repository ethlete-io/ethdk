import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, OnInit, ViewChild, ViewEncapsulation } from '@angular/core';
import { InputDirective, INPUT_TOKEN, NativeInputRefDirective, NATIVE_INPUT_REF_TOKEN } from '../../../../directives';
import { TextInputDirective, TEXT_INPUT_TOKEN } from '../../directives';

@Component({
  selector: 'et-text-input',
  templateUrl: './text-input.component.html',
  styleUrls: ['./text-input.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-text-input',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [TextInputDirective, { directive: InputDirective, inputs: ['autocomplete', 'placeholder'] }],
})
export class TextInputComponent implements OnInit {
  protected readonly textInput = inject(TEXT_INPUT_TOKEN);
  protected readonly input = inject(INPUT_TOKEN);

  @ViewChild(NATIVE_INPUT_REF_TOKEN, { static: true })
  protected readonly nativeInputRef!: NativeInputRefDirective;

  ngOnInit(): void {
    this.input._setNativeInputRef(this.nativeInputRef);
  }
}
