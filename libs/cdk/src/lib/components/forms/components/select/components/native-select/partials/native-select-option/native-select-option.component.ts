import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  TemplateRef,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import { NativeSelectOptionDirective } from '../../directives';

@Component({
  selector: 'et-native-select-option',
  template: ` <ng-template #textTpl> <ng-content /></ng-template> `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-native-select-option',
  },
  hostDirectives: [{ directive: NativeSelectOptionDirective, inputs: ['value', 'disabled', 'hidden'] }],
})
export class NativeSelectOptionComponent implements OnInit {
  protected readonly option = inject(NativeSelectOptionDirective);

  @ViewChild('textTpl', { static: true })
  textTpl?: TemplateRef<unknown>;

  ngOnInit(): void {
    this.option._setTextTemplate(this.textTpl ?? null);
  }
}
