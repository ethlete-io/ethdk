import { Component, computed, ElementRef, signal, viewChild, viewChildren } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  signalElementChildren,
  signalElementIntersection,
  signalElementLastScrollDirection,
  signalElementScrollState,
  signalHostElementDimensions,
  signalIsRendered,
} from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-nav',
  template: `
    <nav #nav>
      @for (item of items(); track item) {
        <a [class.active]="item === active()">{{ item }}</a>
      }
    </nav>
  `,
})
class NavComponent {
  items = signal(['home', 'news']);
  active = signal<string | null>(null);
  nav = viewChild.required<ElementRef<HTMLElement>>('nav');
  children = signalElementChildren(this.nav);
  activeChild = computed(() => this.children().find((el) => el.classList.contains('active'))?.textContent ?? null);
}

@Component({
  selector: 'et-scenario-chat',
  template: `
    <div #container class="container">
      <div #loadMore class="load-more"></div>
      @for (message of messages(); track message) {
        <p #message>{{ message }}</p>
      }
    </div>
  `,
})
class ChatComponent {
  messages = signal(['a', 'b']);
  observeMessages = signal(true);
  container = viewChild.required<ElementRef<HTMLElement>>('container');
  loadMore = viewChild<ElementRef<HTMLElement>>('loadMore');
  messageRefs = viewChildren<ElementRef<HTMLElement>>('message');

  loadMoreIntersection = signalElementIntersection(this.loadMore, { root: this.container, threshold: 0.1 });
  messageIntersections = signalElementIntersection(
    computed(() => this.messageRefs().map((ref) => ref.nativeElement)),
    { enabled: this.observeMessages },
  );
  scrollState = signalElementScrollState(this.container);
  canScroll = computed(() => this.scrollState().canScrollVertically);
  lastScrollDirection = signalElementLastScrollDirection(this.container);
}

@Component({
  selector: 'et-scenario-crop',
  template: '',
  styles: ':host { display: block; }',
})
class CropComponent {
  isRendered = signalIsRendered();
  renderedDuringConstruction = this.isRendered();
  dimensions = signalHostElementDimensions();
  width = computed(() => this.dimensions().client?.width ?? null);
}

const fakeSize = (
  element: HTMLElement,
  size: Partial<Record<'clientWidth' | 'clientHeight' | 'scrollHeight', number>>,
) => {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(element, key, { configurable: true, value });
  }
};

const installFakeResizeObserver = () => {
  const globals = globalThis as { ResizeObserver?: typeof ResizeObserver };
  const original = globals.ResizeObserver;
  const observed = new Map<Element, ResizeObserverCallback>();

  class FakeResizeObserver {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      observed.set(target, this.callback);
    }
    unobserve(target: Element) {
      observed.delete(target);
    }
    disconnect() {
      observed.clear();
    }
  }

  globals.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;

  return {
    observed,
    resize: (target: Element) => observed.get(target)?.([{ target } as ResizeObserverEntry], {} as ResizeObserver),
    restore: () => {
      if (original) globals.ResizeObserver = original;
      else delete globals.ResizeObserver;
    },
  };
};

describe('element signal scenarios', () => {
  const scenario = useScenario();

  it('lists the element children of a nav and follows added items and class changes', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(NavComponent);
    const nav = fixture.componentInstance;

    expect(nav.children()).toEqual([]);

    s.flush();

    expect(nav.children().map((el) => el.textContent?.trim())).toEqual(['home', 'news']);
    expect(nav.activeChild()).toBeNull();

    nav.items.set(['home', 'news', 'shop']);
    s.flush();
    await s.settle();

    expect(nav.children()).toHaveLength(3);

    nav.active.set('news');
    s.flush();
    await s.settle();

    expect(nav.activeChild()?.trim()).toBe('news');

    fixture.destroy();
  });

  it('observes a load-more sentinel inside a scroll container and every rendered message', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ChatComponent);
    const chat = fixture.componentInstance;

    s.flush();

    const loadMore = chat.loadMore()?.nativeElement as HTMLElement;
    const messages = chat.messageRefs().map((ref) => ref.nativeElement);

    expect(s.observedElements()).toEqual(expect.arrayContaining([loadMore, ...messages]));
    expect(chat.loadMoreIntersection()).toEqual([expect.objectContaining({ target: loadMore, isIntersecting: false })]);

    s.intersect(loadMore, true);

    expect(chat.loadMoreIntersection()).toEqual([
      expect.objectContaining({ target: loadMore, isIntersecting: true, isVisible: true }),
    ]);

    chat.messages.set(['b', 'c']);
    s.flush();

    const [first] = messages;
    const current = chat.messageRefs().map((ref) => ref.nativeElement);

    expect(s.observedElements()).not.toContain(first);
    expect(chat.messageIntersections().map((entry) => entry.target)).toEqual(current);

    chat.observeMessages.set(false);
    s.flush();

    expect(chat.messageIntersections()).toEqual([]);
    expect(s.observedElements()).toEqual([loadMore]);

    fixture.destroy();
  });

  it('reports a container as scrollable once its content overflows', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ChatComponent);
    const chat = fixture.componentInstance;

    expect(chat.canScroll()).toBe(false);

    s.flush();

    expect(chat.canScroll()).toBe(false);

    const container = chat.container().nativeElement;
    fakeSize(container, { clientHeight: 100, scrollHeight: 400 });
    chat.messages.set(['a', 'b', 'c']);
    s.flush();
    await s.settle();

    expect(chat.scrollState()).toEqual(
      expect.objectContaining({ canScroll: true, canScrollVertically: true, canScrollHorizontally: false }),
    );

    fixture.destroy();
  });

  it('tracks the last scroll direction of a container with the time it happened', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ChatComponent);
    const chat = fixture.componentInstance;

    s.flush();

    expect(chat.lastScrollDirection()).toBeNull();

    const container = chat.container().nativeElement;
    const scrollTo = (top: number) => {
      Object.defineProperty(container, 'scrollTop', { configurable: true, value: top });
      container.dispatchEvent(new Event('scroll'));
    };

    scrollTo(200);
    expect(chat.lastScrollDirection()).toEqual({ type: 'down', time: Date.now() });

    s.tick(500);
    scrollTo(50);
    expect(chat.lastScrollDirection()).toEqual({ type: 'up', time: Date.now() });

    fixture.destroy();
  });

  it('flips signalIsRendered after the first render and follows the host size', () => {
    const resizeObserver = installFakeResizeObserver();

    try {
      const s = scenario();
      const fixture = TestBed.createComponent(CropComponent);
      const crop = fixture.componentInstance;
      const host = fixture.nativeElement as HTMLElement;

      expect(crop.renderedDuringConstruction).toBe(false);

      s.flush();

      expect(crop.isRendered()).toBe(true);
      expect(crop.width()).toBe(0);
      expect(resizeObserver.observed.has(host)).toBe(true);

      fakeSize(host, { clientWidth: 640, clientHeight: 360 });
      resizeObserver.resize(host);
      s.tick();

      expect(crop.dimensions().client).toEqual({ width: 640, height: 360 });

      fixture.destroy();

      expect(resizeObserver.observed.size).toBe(0);
    } finally {
      resizeObserver.restore();
    }
  });
});
