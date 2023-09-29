import { ChangeDetectionStrategy, Component, ContentChild, ViewEncapsulation, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { signalHostAttributes, signalHostClasses, signalVisibilityChangeClasses } from '@ethlete/core';
import { BehaviorSubject, of, startWith, switchMap } from 'rxjs';
import {
  RICH_FILTER_BUTTON_SLOT_TOKEN,
  RICH_FILTER_BUTTON_TOKEN,
  RICH_FILTER_CONTENT_TOKEN,
  RICH_FILTER_TOP_TOKEN,
  RichFilterButtonDirective,
  RichFilterButtonSlotDirective,
  RichFilterContentDirective,
  RichFilterTopDirective,
} from '../../directives';

@Component({
  selector: 'et-rich-filter-host',
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
    switchMap((buttonSlot) => buttonSlot?.visibilityObserver.etObserveVisibility.pipe(startWith(null)) ?? of(null)),
  );

  readonly contentVisibilityChanges$ = this.content$.pipe(
    switchMap((content) => content?.visibilityObserver.etObserveVisibility.pipe(startWith(null)) ?? of(null)),
  );

  readonly buttonSlotVisibilityChanges = toSignal(this.buttonSlotVisibilityChanges$, { requireSync: true });
  readonly contentVisibilityChanges = toSignal(this.contentVisibilityChanges$, { requireSync: true });

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

    signalHostAttributes({
      'aria-expanded my-expanded': computed(() => this.buttonSlotVisibilityChanges()?.visible),
      disabled: computed(() => this.buttonSlotVisibilityChanges()?.visible),
      foo: computed(() => (this.buttonSlotVisibilityChanges()?.visible ? 'yes' : 'no')),
    });
  }

  scrollToTop(options?: ScrollIntoViewOptions): void {
    this.top$?.value?.elementRef.nativeElement?.scrollIntoView(options);
  }
}
