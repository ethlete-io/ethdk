import { AsyncPipe } from '@angular/common';
import { Component, ViewEncapsulation, inject } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { NativeInputRefDirective } from '../../../../directives/native-input-ref';
import { InputBase } from '../../../../utils';
import { SLIDE_TOGGLE_TOKEN, SlideToggleDirective } from '../../directives/slide-toggle';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-slide-toggle',
  templateUrl: './slide-toggle.component.html',
  styleUrls: ['./slide-toggle.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-slide-toggle et-legacy',
  },
  imports: [AsyncPipe, NativeInputRefDirective],
  hostDirectives: [SlideToggleDirective, InputDirective],
})
export class SlideToggleComponent extends InputBase {
  protected readonly slideToggle = inject(SLIDE_TOGGLE_TOKEN);
}
