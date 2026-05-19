import { ChangeDetectionStrategy, Component, inject, input, ViewEncapsulation } from '@angular/core';
import { IconButtonComponent } from '../../button/icon-button.component';
import { CHEVRON_ICON } from '../../icon/headless/chevron-icon';
import { provideIcons } from '../../icon/headless/icon-provider';
import { IconDirective } from '../../icon/headless/icon.directive';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableButtonPosition } from './scrollable.types';

@Component({
  selector: 'et-scrollable-buttons, [et-scrollable-buttons]',
  template: `
    <button
      [disabled]="scrollable.isAtStart()"
      (click)="scrollable.scrollToStartDirection()"
      class="et-scrollable-button et-scrollable-button--start"
      et-icon-button
      size="xs"
      aria-hidden="true"
      type="button"
      tabindex="-1"
    >
      <i etIcon="et-chevron"></i>
    </button>
    <button
      [disabled]="scrollable.isAtEnd()"
      (click)="scrollable.scrollToEndDirection()"
      class="et-scrollable-button et-scrollable-button--end"
      et-icon-button
      size="xs"
      aria-hidden="true"
      type="button"
      tabindex="-1"
    >
      <i etIcon="et-chevron"></i>
    </button>
  `,
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconDirective, IconButtonComponent],
  providers: [provideIcons(CHEVRON_ICON)],
  host: {
    class: 'et-scrollable-buttons',
    '[class.et-scrollable-buttons--inside]': 'position() === "inside"',
    '[class.et-scrollable-buttons--footer]': 'position() === "footer"',
  },
  styles: `
    .et-scrollable-buttons {
      grid-row: 1 / 1;
      grid-column: 1 / 1;
      pointer-events: none;

      .et-scrollable-button {
        position: absolute;
        opacity: 0;
      }
    }
  `,
})
export class ScrollableButtonsDirective {
  protected scrollable = inject(ScrollableDirective);

  public position = input<ScrollableButtonPosition>('inside');

  constructor() {
    this.scrollable.buttonsDirective.set(this);
  }
}
