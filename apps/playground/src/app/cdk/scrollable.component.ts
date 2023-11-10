import { NgTemplateOutlet } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  NgZone,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { signalElementIntersection, signalHostClasses } from '@ethlete/core';
import { Subject, takeUntil } from 'rxjs';

const perfNow = performance.now();

@Component({
  selector: 'ethlete-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [NgTemplateOutlet],
  hostDirectives: [],
})
export class ScrollableComponent {
  @ViewChild('scrollableTest', { static: true })
  private set _scrollable(e: ElementRef<HTMLElement>) {
    this.scrollable.set(e);

    if (e) {
      this.isVisibleManual.set(this.checkIsElementVisible(e.nativeElement));
      // this.log('set');

      // const obs = new IntersectionObserver(() => {
      //   this.log('IntersectionObserver');
      // });

      // obs.observe(this.scrollable()!.nativeElement);
    }
  }
  readonly scrollable = signal<ElementRef<HTMLElement> | null>(null);

  @ViewChild('scrollableTest2', { static: true })
  private set _scrollable2(e: ElementRef<HTMLElement>) {
    this.scrollable2.set(e);
    this.scrollTest2IntoView();
  }
  readonly scrollable2 = signal<ElementRef<HTMLElement> | null>(null);

  @ViewChild('scrollableTestWrapper', { static: true })
  private set _scrollableWrapper(e: ElementRef<HTMLElement>) {
    this.scrollableWrapper.set(e);
    this.scrollTest2IntoView();
  }
  readonly scrollableWrapper = signal<ElementRef<HTMLElement> | null>(null);

  protected readonly elementIntersection = signalElementIntersection(this.scrollable);
  protected readonly elementIntersection2 = signalElementIntersection(this.scrollable2);
  protected readonly isVisibleManual = signal<boolean>(false);
  protected readonly isVisibleManual2 = signal<boolean>(false);
  protected readonly visible = signal<boolean>(true);
  protected readonly isVisible = computed(() => this.elementIntersection().isIntersecting || this.isVisibleManual());
  protected readonly isVisible2 = computed(() =>
    this.elementIntersection2().isIntersecting === null
      ? this.isVisibleManual2()
      : this.elementIntersection2().isIntersecting,
  );

  private readonly zone = inject(NgZone);
  private readonly appRef = inject(ApplicationRef);

  protected readonly hostClasses = signalHostClasses({
    'scrollable-test--can-scroll': this.isVisible,
    'scrollable-test--can-scroll-2': this.isVisible2,
  });

  constructor() {
    effect(() => {
      console.log(this.elementIntersection2());
    });
  }

  // ngOnInit(): void {
  //   this.log('ngOnInit');
  // }

  // ngAfterViewInit(): void {
  //   this.log('ngAfterViewInit');
  // }

  log(from: string) {
    console.log(from, {
      visible: this.isVisible(),
      scrollable: this.scrollable(),
      elementIntersection: this.elementIntersection(),
      took: performance.now() - perfNow,
    });
  }

  checkIsElementVisible(el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const viewHeight = Math.max(document.documentElement.clientHeight, window.innerHeight);
    const viewWidth = Math.max(document.documentElement.clientWidth, window.innerWidth);
    const topVisible = rect.top <= viewHeight && rect.top >= 0;
    const bottomVisible = rect.bottom <= viewHeight && rect.bottom >= 0;
    const leftVisible = rect.left <= viewWidth && rect.left >= 0;
    const rightVisible = rect.right <= viewWidth && rect.right >= 0;
    return topVisible && bottomVisible && leftVisible && rightVisible;
  }

  scrollTest2IntoView() {
    const wrapper = this.scrollableWrapper()?.nativeElement;
    const scrollable2 = this.scrollable2()?.nativeElement;

    if (!wrapper || !scrollable2) {
      return;
    }

    const didScroll$ = new Subject<void>();

    this.appRef.isStable.pipe(takeUntil(didScroll$)).subscribe(() => {
      const offsetTop = scrollable2.offsetTop - wrapper.offsetTop;
      const offsetLeft = scrollable2.offsetLeft - wrapper.offsetLeft;

      console.log({ offsetTop, offsetLeft });

      wrapper.scrollLeft = offsetLeft;
      wrapper.scrollTop = offsetTop;

      const elVisible = this.checkIsElementVisible(scrollable2);

      this.isVisibleManual2.set(elVisible);

      if (offsetLeft) {
        didScroll$.next();
      }
    });
  }
}

@Component({
  selector: 'ethlete-scrollable-wrapper',
  template: `
    <ethlete-scrollable>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
      <div class="scroll-content-item"></div>
    </ethlete-scrollable>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollableComponent],
})
export class ScrollableWrapperComponent {}
