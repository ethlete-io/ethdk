import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  ViewEncapsulation,
  computed,
  effect,
  signal,
} from '@angular/core';
import { ScrollableImports } from '@ethlete/cdk';
import { nextFrame, scrollToElement, signalElementIntersection, signalHostClasses } from '@ethlete/core';

const perfNow = performance.now();

@Component({
  selector: 'ethlete-scrollable',
  templateUrl: './scrollable.component.html',
  styleUrls: ['./scrollable.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [ScrollableImports],
})
export class EthleteScrollableComponent {
  renderStuff = signal(false);

  @ViewChild('scrollableTest', { static: true })
  private set _scrollable(e: ElementRef<HTMLElement>) {
    this.scrollable.set(e);

    if (e) {
      this.isVisibleManual.set(this.checkIsElementVisible(e.nativeElement));
    }
  }
  readonly scrollable = signal<ElementRef<HTMLElement> | null>(null);

  @ViewChild('scrollableTest2', { static: true })
  private set _scrollable2(e: ElementRef<HTMLElement>) {
    this.scrollable2.set(e);
  }
  readonly scrollable2 = signal<ElementRef<HTMLElement> | null>(null);

  @ViewChild('scrollableTestWrapper', { static: true })
  private set _scrollableWrapper(e: ElementRef<HTMLElement>) {
    this.scrollableWrapper.set(e);
  }
  readonly scrollableWrapper = signal<ElementRef<HTMLElement> | null>(null);

  protected readonly elementIntersection = signalElementIntersection(this.scrollable);
  protected readonly elementIntersection2 = signalElementIntersection(this.scrollable2);
  protected readonly isVisibleManual = signal<boolean>(false);
  protected readonly isVisibleManual2 = signal<boolean>(false);
  protected readonly doAnimate = signal<boolean>(false);
  protected readonly isVisible = computed(() =>
    !this.elementIntersection().length ? this.isVisibleManual() : this.elementIntersection()[0]?.isIntersecting,
  );
  protected readonly isVisible2 = computed(() =>
    !this.elementIntersection2().length ? this.isVisibleManual2() : this.elementIntersection2()[0]?.isIntersecting,
  );

  protected readonly hostClasses = signalHostClasses({
    'scrollable-test--can-scroll': this.isVisible,
    'scrollable-test--can-scroll-2': this.isVisible2,
    'scrollable-test--do-animate': this.doAnimate,
  });

  constructor() {
    effect(() => {
      const wrapper = this.scrollableWrapper()?.nativeElement;
      const scrollable2 = this.scrollable2()?.nativeElement;
      if (!wrapper || !scrollable2) {
        return;
      }

      const offsetTop = scrollable2.offsetTop - wrapper.offsetTop;
      const offsetLeft = scrollable2.offsetLeft - wrapper.offsetLeft;
      wrapper.scrollLeft = offsetLeft;
      wrapper.scrollTop = offsetTop;
      const elVisible = this.checkIsElementVisible(scrollable2, wrapper);

      console.log(elVisible);

      this.isVisibleManual2.set(elVisible);

      nextFrame(() => {
        this.doAnimate.set(true);
      });
    });
  }

  log(from: string) {
    console.log(from, {
      visible: this.isVisible(),
      scrollable: this.scrollable(),
      elementIntersection: this.elementIntersection(),
      took: performance.now() - perfNow,
    });
  }

  checkIsElementVisible(el: HTMLElement, container?: HTMLElement) {
    if (!container) {
      container = document.documentElement;
    }

    if (!container) {
      return false;
    }

    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    const isAbove = elRect.bottom < containerRect.top;
    const isBelow = elRect.top > containerRect.bottom;
    const isLeft = elRect.right < containerRect.left;
    const isRight = elRect.left > containerRect.right;

    console.log({
      isAbove,
      isBelow,
      isLeft,
      isRight,
    });

    return !(isAbove || isBelow || isLeft || isRight);
  }

  scrollToElStart() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    scrollToElement({ origin: 'start', container: wrapper, element: el, behavior: 'instant', scrollBlockMargin: 20 });
  }

  scrollToElEnd() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    scrollToElement({ origin: 'end', container: wrapper, element: el, behavior: 'instant', scrollBlockMargin: 20 });
  }

  scrollToElCenter() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    scrollToElement({ origin: 'center', container: wrapper, element: el, behavior: 'instant', scrollBlockMargin: 20 });
  }

  scrollToElNearest() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    scrollToElement({ origin: 'nearest', container: wrapper, element: el, behavior: 'instant', scrollBlockMargin: 20 });
  }

  scrollToElStartNative() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }

  scrollToElEndNative() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    el.scrollIntoView({ block: 'end', behavior: 'instant' });
  }

  scrollToElCenterNative() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    el.scrollIntoView({ block: 'center', behavior: 'instant' });
  }

  scrollToElNearestNative() {
    const wrapper = document.getElementById('items');
    const el = document.getElementById('item');

    if (!wrapper || !el) {
      return;
    }

    el.scrollIntoView({ block: 'nearest', behavior: 'auto' });
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
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [EthleteScrollableComponent],
})
export class ScrollableWrapperComponent {}
