import { AsyncPipe } from '@angular/common';
import { Component, ElementRef, OnInit, ViewEncapsulation, inject, viewChild } from '@angular/core';
import { InputDirective } from '../../../../directives/input';
import { InputBase } from '../../../../utils';
import { SEGMENTED_BUTTON_TOKEN, SegmentedButtonDirective } from '../../directives/segmented-button';
import { SEGMENTED_BUTTON_GROUP_TOKEN } from '../../directives/segmented-button-group';

/**
 * @deprecated `@ethlete/cdk` is in maintenance mode. Use the `@ethlete/components` equivalent instead - see https://ethlete-sdk-docs.web.app/cdk/migration, and run `nx g @ethlete/cdk:migrate-from-cdk` to rewrite the mechanical parts. Intent to remove in v6.
 */
@Component({
  selector: 'et-segmented-button',
  templateUrl: './segmented-button.component.html',
  styleUrls: ['./segmented-button.component.scss'],
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'et-segmented-button et-legacy',
  },
  imports: [AsyncPipe],
  hostDirectives: [
    { directive: SegmentedButtonDirective, inputs: ['value', 'disabled'] },
    { directive: InputDirective },
  ],
})
export class SegmentedButtonComponent extends InputBase implements OnInit {
  protected readonly segmentedButton = inject(SEGMENTED_BUTTON_TOKEN);
  protected readonly segmentedButtonGroup = inject(SEGMENTED_BUTTON_GROUP_TOKEN);

  readonly activeIndicator = viewChild<ElementRef<HTMLElement>>('activeIndicator');

  ngOnInit() {
    const activeIndicator = this.activeIndicator();
    if (!activeIndicator) {
      return;
    }

    this.segmentedButton._setActiveIndicatorElement(activeIndicator.nativeElement);
  }
}
