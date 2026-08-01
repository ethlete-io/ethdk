import { NgComponentOutlet, NgTemplateOutlet } from '@angular/common';
import {
  booleanAttribute,
  Component,
  ElementRef,
  ViewEncapsulation,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { outputFromObservable, takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  ProvideColorDirective,
  ScrollObserverDirective,
  ScrollObserverEndDirective,
  ScrollObserverStartDirective,
  createCanAnimateSignal,
  signalClasses,
} from '@ethlete/core';
import { debounceTime, map, tap } from 'rxjs';
import { ScrollableIgnoreChildDirective } from './headless/scrollable-ignore-child.directive';
import { ScrollableMasksComponent } from './headless/scrollable-masks.component';
import { ScrollableDirective } from './headless/scrollable.directive';
import {
  ScrollableIntersectionChange,
  ScrollableLoadingTemplatePosition,
  ScrollableMaskVariant,
  ScrollableScrollState,
} from './headless/scrollable.types';

@Component({
  selector: 'et-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrl: './scrollable.component.css',
  encapsulation: ViewEncapsulation.None,
  imports: [
    ScrollObserverDirective,
    ScrollObserverStartDirective,
    ScrollObserverEndDirective,
    ScrollableIgnoreChildDirective,
    ScrollableMasksComponent,
    NgComponentOutlet,
    NgTemplateOutlet,
  ],
  hostDirectives: [
    {
      directive: ScrollableDirective,
      inputs: ['itemSize', 'direction', 'scrollMode', 'scrollOrigin', 'scrollMargin', 'renderScrollbars'],
    },
    {
      directive: ProvideColorDirective,
      inputs: ['etProvideColor:color'],
    },
  ],
  host: {
    class: 'et-scrollable',
    '[class.et-scrollable--can-animate]': 'canAnimate.state()',
    '[attr.mask-variant]': 'maskVariant()',
  },
})
export class ScrollableComponent {
  public scrollableDir = inject(ScrollableDirective);

  public renderMasks = input(true, { transform: booleanAttribute });
  public maskVariant = input<ScrollableMaskVariant>('gradient');
  public showLoadingTemplate = input(false, { transform: booleanAttribute });
  public loadingTemplatePosition = input<ScrollableLoadingTemplatePosition>('end');
  public scrollableRole = input<string | null>(null);
  public scrollableClass = input<string | null>(null);

  public intersectionChange = outputFromObservable<ScrollableIntersectionChange[]>(
    toObservable(this.scrollableDir.childIntersections).pipe(
      takeUntilDestroyed(),
      debounceTime(50),
      map((entries) =>
        entries.map((i, index) => ({
          index,
          element: i.target as HTMLElement,
          intersectionRatio: i.intersectionRatio,
          isIntersecting: i.isIntersecting,
        })),
      ),
    ),
  );

  public scrollStateChange = outputFromObservable<ScrollableScrollState>(
    toObservable(
      computed(() => ({
        canScroll: this.scrollableDir.canScroll(),
        isAtEnd: this.scrollableDir.isAtEnd(),
        isAtStart: this.scrollableDir.isAtStart(),
      })),
    ),
  );

  private scrollContainerEl = viewChild<ElementRef<HTMLElement>>('scrollable');
  private scrollObserver = viewChild.required(ScrollObserverDirective);

  protected overlayChrome = computed(() => this.scrollableDir.activeChrome().filter((c) => c.slot === 'overlay'));
  protected footerChrome = computed(() => this.scrollableDir.activeChrome().filter((c) => c.slot === 'footer'));
  protected footerHasButtons = computed(() => this.footerChrome().some((c) => c.key === 'buttons'));
  protected footerHasNavigation = computed(() => this.footerChrome().some((c) => c.key === 'navigation'));

  public canAnimate = createCanAnimateSignal();

  constructor() {
    const scrollContainerEl$ = toObservable(this.scrollContainerEl);
    const scrollObserver$ = toObservable(this.scrollObserver);

    scrollContainerEl$
      .pipe(
        takeUntilDestroyed(),
        tap((el) => {
          if (el) this.scrollableDir.scrollContainerRef.set(el);
        }),
      )
      .subscribe();

    scrollObserver$
      .pipe(
        takeUntilDestroyed(),
        tap((obs) => {
          if (obs) this.scrollableDir.scrollObserverRef.set(obs);
        }),
      )
      .subscribe();

    signalClasses(this.scrollableDir.scrollableChildren, {
      'et-scrollable-item': computed(() => true),
    });
  }
}
