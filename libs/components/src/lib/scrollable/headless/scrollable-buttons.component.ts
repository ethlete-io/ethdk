import { Component, inject, input, ViewEncapsulation } from '@angular/core';
import { BUTTON_SIZES, ButtonSize } from '../../button/button.types';
import { IconButtonComponent } from '../../button/icon-button.component';
import { CHEVRON_ICON } from '../../icon/headless/chevron-icon';
import { provideIcons } from '../../icon/headless/icon-provider';
import { IconDirective } from '../../icon/headless/icon.directive';
import { mountScrollableFooterStyles } from './scrollable-footer-styles.component';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableButtonPosition } from './scrollable.types';

@Component({
  selector: 'et-scrollable-buttons, [et-scrollable-buttons]',
  template: `
    <button
      [disabled]="scrollable.isAtStart()"
      [size]="size()"
      (click)="scrollable.scrollToStartDirection()"
      class="et-scrollable-button et-scrollable-button--start"
      et-icon-button
      aria-hidden="true"
      type="button"
      tabindex="-1"
    >
      <i etIcon="et-chevron"></i>
    </button>
    <button
      [disabled]="scrollable.isAtEnd()"
      [size]="size()"
      (click)="scrollable.scrollToEndDirection()"
      class="et-scrollable-button et-scrollable-button--end"
      et-icon-button
      aria-hidden="true"
      type="button"
      tabindex="-1"
    >
      <i etIcon="et-chevron"></i>
    </button>
  `,
  styleUrl: './scrollable-buttons.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [IconDirective, IconButtonComponent],
  providers: [provideIcons(CHEVRON_ICON)],
  host: {
    class: 'et-scrollable-buttons',
    '[class.et-scrollable-buttons--inside]': 'position() === "inside"',
    '[class.et-scrollable-buttons--footer]': 'position() === "footer"',
  },
})
export class ScrollableButtonsComponent {
  protected scrollable = inject(ScrollableDirective);

  public position = input<ScrollableButtonPosition>('inside');
  public size = input<ButtonSize>(BUTTON_SIZES.XS);

  constructor() {
    mountScrollableFooterStyles();
  }
}
