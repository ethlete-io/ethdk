import { ChangeDetectionStrategy, Component, ContentChild, ViewEncapsulation, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostClasses, signalVisibilityChangeClasses } from '@ethlete/core';
import { BehaviorSubject, map, of, switchMap } from 'rxjs';
import { RICH_FILTER_BUTTON_TOKEN, RichFilterButtonDirective } from '../../directives/rich-filter-button';
import { RICH_FILTER_BUTTON_SLOT_TOKEN, RichFilterButtonSlotDirective } from '../../directives/rich-filter-button-slot';
import { RICH_FILTER_CONTENT_TOKEN, RichFilterContentDirective } from '../../directives/rich-filter-content';
import { RICH_FILTER_TOP_TOKEN, RichFilterTopDirective } from '../../directives/rich-filter-top';

@Component({
  selector: 'et-rich-filter-host, [et-rich-filter-host]',
  styleUrls: ['./rich-filter-host.component.scss'],
  template: '<ng-content />',
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  standalone: true,
  host: {
    class: 'et-rich-filter-host',
  },
  hostDirectives: [RichFilterTopDirective],
})
export class RichFilterHostComponent {
  private readonly _implicitTop = inject(RICH_FILTER_TOP_TOKEN);

  @ContentChild(RICH_FILTER_BUTTON_TOKEN)
  private set _button(value: RichFilterButtonDirective | null | undefined) {
    this.button$.next(value ?? null);
  }
  readonly button$ = new BehaviorSubject<RichFilterButtonDirective | null>(null);

  @ContentChild(RICH_FILTER_BUTTON_SLOT_TOKEN)
  private set _buttonSlot(value: RichFilterButtonSlotDirective | null | undefined) {
    this.buttonSlot$.next(value ?? null);
  }
  readonly buttonSlot$ = new BehaviorSubject<RichFilterButtonSlotDirective | null>(null);

  @ContentChild(RICH_FILTER_CONTENT_TOKEN)
  private set _content(value: RichFilterContentDirective | null | undefined) {
    this.content$.next(value ?? null);
  }
  readonly content$ = new BehaviorSubject<RichFilterContentDirective | null>(null);

  @ContentChild(RICH_FILTER_TOP_TOKEN)
  private set _top(value: RichFilterTopDirective | null | undefined) {
    this.top$.next(value ?? this._implicitTop);
  }
  readonly top$ = new BehaviorSubject<RichFilterTopDirective>(this._implicitTop);

  readonly buttonSlotVisibilityChanges$ = this.buttonSlot$.pipe(
    switchMap((buttonSlot) => buttonSlot?.visibilityObserver.currentVisibility$ ?? of(null)),
  );

  readonly contentVisibilityChanges$ = this.content$.pipe(
    switchMap((content) => content?.visibilityObserver.currentVisibility$ ?? of(null)),
  );

  readonly buttonSlotVisibilityChanges = toSignal(this.buttonSlotVisibilityChanges$, { requireSync: true });
  readonly contentVisibilityChanges = toSignal(this.contentVisibilityChanges$, { requireSync: true });
  readonly topElementRef = toSignal(this.top$.pipe(map((top) => top.elementRef)), { requireSync: true });

  constructor() {
    signalHostClasses({
      ...signalVisibilityChangeClasses({
        name: 'et-rich-filter-host-button',
        signal: this.buttonSlotVisibilityChanges,
      }),
      ...signalVisibilityChangeClasses({
        name: 'et-rich-filter-host-content',
        signal: this.contentVisibilityChanges,
      }),
    });
  }

  scrollToTop(options?: ScrollIntoViewOptions): void {
    this.top$?.value?.elementRef.nativeElement?.scrollIntoView(options);
  }
}
