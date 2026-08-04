import { Component, inject, OnInit, TemplateRef, ViewEncapsulation, viewChild } from '@angular/core';
import { NativeSelectOptionDirective } from '../../directives/native-select-option';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-native-select-option',
  template: ` <ng-template #textTpl> <ng-content /></ng-template> `,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-native-select-option et-legacy',
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
