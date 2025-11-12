import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  ViewEncapsulation,
  computed,
  contentChild,
  inject,
} from '@angular/core';
import { IntersectionObserverEntryWithDetails, signalHostClasses } from '@ethlete/core';
import { RICH_FILTER_BUTTON_TOKEN } from '../../directives/rich-filter-button';
import { RICH_FILTER_BUTTON_SLOT_TOKEN } from '../../directives/rich-filter-button-slot';
import { RICH_FILTER_CONTENT_TOKEN } from '../../directives/rich-filter-content';
import { RICH_FILTER_TOP_TOKEN, RichFilterTopDirective } from '../../directives/rich-filter-top';

export const signalVisibilityChangeClasses = (cfg: {
  name: string;
  signal: Signal<IntersectionObserverEntryWithDetails | null | undefined>;
}) => ({
  [`${cfg.name}--is-left`]: computed(() => cfg.signal()?.isLeft),
  [`${cfg.name}--is-right`]: computed(() => cfg.signal()?.isRight),
  [`${cfg.name}--is-above`]: computed(() => cfg.signal()?.isAbove),
  [`${cfg.name}--is-below`]: computed(() => cfg.signal()?.isBelow),
  [`${cfg.name}--is-visible`]: computed(() => cfg.signal()?.isVisible),
});

@Component({
  selector: 'et-rich-filter-host, [et-rich-filter-host]',
  styleUrls: ['./rich-filter-host.component.scss'],
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'et-rich-filter-host',
  },
  hostDirectives: [RichFilterTopDirective],
})
export class RichFilterHostComponent {
  implicitTop = inject(RICH_FILTER_TOP_TOKEN);

  button = contentChild(RICH_FILTER_BUTTON_TOKEN);
  buttonSlot = contentChild(RICH_FILTER_BUTTON_SLOT_TOKEN);
  content = contentChild(RICH_FILTER_CONTENT_TOKEN);
  explicitTop = contentChild(RICH_FILTER_TOP_TOKEN);

  top = computed(() => this.explicitTop() ?? this.implicitTop);

  constructor() {
    signalHostClasses({
      ...signalVisibilityChangeClasses({
        name: 'et-rich-filter-host-button',
        signal: computed(() => this.buttonSlot()?.intersection()[0]),
      }),
      ...signalVisibilityChangeClasses({
        name: 'et-rich-filter-host-content',
        signal: computed(() => this.content()?.intersection()[0]),
      }),
    });
  }

  scrollToTop(options?: ScrollIntoViewOptions): void {
    this.top()?.elementRef.nativeElement?.scrollIntoView(options);
  }
}
