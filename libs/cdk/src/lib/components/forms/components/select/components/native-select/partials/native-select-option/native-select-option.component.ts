import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  TemplateRef,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { NativeSelectOptionDirective } from '../../directives/native-select-option';

@Component({
  selector: 'et-native-select-option',
  template: ` <ng-template #textTpl> <ng-content /></ng-template> `,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-native-select-option',
  },
  hostDirectives: [{ directive: NativeSelectOptionDirective, inputs: ['value', 'disabled', 'hidden'] }],
})
export class NativeSelectOptionComponent implements OnInit {
  protected readonly option = inject(NativeSelectOptionDirective);

  readonly textTpl = viewChild<TemplateRef<unknown>>('textTpl');

  ngOnInit(): void {
    this.option._setTextTemplate(this.textTpl() ?? null);
  }
}
