import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnyPagedQueryStack, PagedQueryStackDirection } from '@ethlete/query';
import { onTestFinished } from 'vitest';
import '../../test-helpers';
import { ScrollableComponent } from '../scrollable/scrollable.component';
import { PagedQueryTriggerDirective } from './paged-query-trigger.directive';

type FakeObserver = {
  callback: IntersectionObserverCallback;
  options: IntersectionObserverInit | undefined;
  targets: Set<Element>;
  instance: IntersectionObserver;
};

const inView = new Set<Element>();
const observers: FakeObserver[] = [];

const entryFor = (target: Element): IntersectionObserverEntry =>
  ({
    target,
    isIntersecting: inView.has(target),
    intersectionRatio: inView.has(target) ? 1 : 0,
    boundingClientRect: target.getBoundingClientRect(),
    intersectionRect: target.getBoundingClientRect(),
    rootBounds: null,
    time: 0,
  }) as IntersectionObserverEntry;

const pending: { observer: FakeObserver; target: Element }[] = [];

const installBrowserLikeIntersectionObserver = () => {
  class BrowserLikeIntersectionObserver {
    public readonly root: Element | Document | null;
    public readonly rootMargin: string;
    public readonly thresholds: readonly number[] = [0];
    private record: FakeObserver;

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      this.root = options?.root ?? null;
      this.rootMargin = options?.rootMargin ?? '0px';
      this.record = { callback, options, targets: new Set(), instance: this as unknown as IntersectionObserver };
      observers.push(this.record);
    }

    observe(target: Element) {
      if (this.record.targets.has(target)) return;

      this.record.targets.add(target);
      pending.push({ observer: this.record, target });
    }

    unobserve(target: Element) {
      this.record.targets.delete(target);
    }

    disconnect() {
      this.record.targets.clear();
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }
  }

  const original = globalThis.IntersectionObserver;
  const originalRect = Element.prototype.getBoundingClientRect;

  Element.prototype.getBoundingClientRect = function (this: Element) {
    const offset = inView.has(this) ? 0 : -10_000;
    const size = inView.has(this) ? 1 : 0;

    return DOMRect.fromRect({ x: offset, y: offset, width: size, height: size });
  };

  globalThis.IntersectionObserver = BrowserLikeIntersectionObserver as unknown as typeof IntersectionObserver;

  onTestFinished(() => {
    globalThis.IntersectionObserver = original;
    Element.prototype.getBoundingClientRect = originalRect;
    observers.length = 0;
    pending.length = 0;
    inView.clear();
  });
};

const deliverInitialEntries = () => {
  const queued = pending.splice(0);

  for (const { observer, target } of queued) {
    if (observer.targets.has(target)) observer.callback([entryFor(target)], observer.instance);
  }
};

const scrollIntoView = (target: Element, visible: boolean, fixture: ComponentFixture<unknown>) => {
  if (visible) inView.add(target);
  else inView.delete(target);

  for (const observer of observers) {
    if (observer.targets.has(target)) observer.callback([entryFor(target)], observer.instance);
  }

  fixture.detectChanges();
};

const activeObserver = () => observers.find((observer) => observer.targets.size > 0) ?? null;

type FakeStack = AnyPagedQueryStack & {
  fetchedNext: () => number;
  fetchedPrevious: () => number;
  settle: () => void;
};

const createFakeStack = (options: { totalPages: number; loadedPage?: number }): FakeStack => {
  const loading = signal(false);
  const maxPage = signal(options.loadedPage ?? 1);
  const minPage = signal(options.loadedPage ?? 1);
  let next = 0;
  let previous = 0;

  return {
    loading,
    canFetchNextPage: () => !loading() && maxPage() < options.totalPages,
    canFetchPreviousPage: () => !loading() && minPage() > 1,
    isLastPageLoaded: () => maxPage() >= options.totalPages,
    isFirstPageLoaded: () => minPage() === 1,
    fetchNextPage: () => {
      next++;
      maxPage.update((page) => page + 1);
      loading.set(true);

      return null;
    },
    fetchPreviousPage: () => {
      previous++;
      minPage.update((page) => page - 1);
      loading.set(true);

      return null;
    },
    fetchedNext: () => next,
    fetchedPrevious: () => previous,
    settle: () => loading.set(false),
  } as unknown as FakeStack;
};

@Component({
  template: `
    <div class="list">
      <div
        #trigger="etPagedQueryTrigger"
        [etPagedQueryTrigger]="stack()"
        [direction]="direction()"
        [disabled]="disabled()"
        [root]="root()"
        [rootMargin]="rootMargin()"
        data-testid="trigger"
      ></div>
    </div>
  `,
  imports: [PagedQueryTriggerDirective],
})
class TriggerHost {
  stack = signal<AnyPagedQueryStack | null>(null);
  direction = signal<PagedQueryStackDirection>('next');
  disabled = signal(false);
  root = signal<HTMLElement | null>(null);
  rootMargin = signal('200px');
}

@Component({
  template: `
    <et-scrollable>
      <div class="item">1</div>
      <div [etPagedQueryTrigger]="stack" data-testid="trigger"></div>
    </et-scrollable>
  `,
  imports: [ScrollableComponent, PagedQueryTriggerDirective],
})
class ScrollableTriggerHost {
  stack = createFakeStack({ totalPages: 3 });
}

describe('PagedQueryTriggerDirective', () => {
  let fixture: ComponentFixture<TriggerHost>;
  let host: TriggerHost;
  let trigger: HTMLElement;

  const render = () => {
    fixture.detectChanges();
    deliverInitialEntries();
    fixture.detectChanges();
    deliverInitialEntries();
  };

  beforeEach(() => {
    installBrowserLikeIntersectionObserver();
    TestBed.configureTestingModule({ imports: [TriggerHost] });
    fixture = TestBed.createComponent(TriggerHost);
    host = fixture.componentInstance;
    trigger = fixture.nativeElement.querySelector('[data-testid="trigger"]');
  });

  it('fetches the next page when it scrolls into view', () => {
    const stack = createFakeStack({ totalPages: 3 });
    host.stack.set(stack);
    render();

    expect(stack.fetchedNext()).toBe(0);

    scrollIntoView(trigger, true, fixture);

    expect(stack.fetchedNext()).toBe(1);
    expect(stack.fetchedPrevious()).toBe(0);
  });

  it('observes with the given root margin and the viewport outside a scrollable', () => {
    host.stack.set(createFakeStack({ totalPages: 3 }));
    host.rootMargin.set('400px');
    render();

    expect(activeObserver()?.options).toEqual({ root: null, rootMargin: '400px' });
  });

  it('does not fetch while a page loads', () => {
    const stack = createFakeStack({ totalPages: 5 });
    host.stack.set(stack);
    render();

    scrollIntoView(trigger, true, fixture);

    expect(stack.fetchedNext()).toBe(1);
    expect(trigger.hasAttribute('data-loading')).toBe(true);

    scrollIntoView(trigger, false, fixture);
    scrollIntoView(trigger, true, fixture);

    expect(stack.fetchedNext()).toBe(1);
  });

  it('fetches again after a page loads while it is still in view', () => {
    const stack = createFakeStack({ totalPages: 5 });
    host.stack.set(stack);
    render();

    scrollIntoView(trigger, true, fixture);
    stack.settle();
    render();

    expect(stack.fetchedNext()).toBe(2);
  });

  it('stops after a page loads that pushed it out of view', () => {
    const stack = createFakeStack({ totalPages: 5 });
    host.stack.set(stack);
    render();

    scrollIntoView(trigger, true, fixture);
    inView.delete(trigger);
    stack.settle();
    render();

    expect(stack.fetchedNext()).toBe(1);
  });

  it('does not fetch once the last page is loaded, and marks itself exhausted', () => {
    const stack = createFakeStack({ totalPages: 2 });
    host.stack.set(stack);
    render();

    scrollIntoView(trigger, true, fixture);
    stack.settle();
    render();

    expect(stack.fetchedNext()).toBe(1);
    expect(trigger.hasAttribute('data-exhausted')).toBe(true);
    expect(trigger.hasAttribute('data-loading')).toBe(false);
    expect(activeObserver()).toBeNull();
  });

  it('switches to another bound stack and fetches it while still in view', () => {
    const upcoming = createFakeStack({ totalPages: 1 });
    const completed = createFakeStack({ totalPages: 3 });
    host.stack.set(upcoming);
    render();
    scrollIntoView(trigger, true, fixture);

    expect(upcoming.fetchedNext()).toBe(0);

    host.stack.set(completed);
    render();

    expect(completed.fetchedNext()).toBe(1);
  });

  it('does not fetch while disabled, and fetches once enabled in view', () => {
    const stack = createFakeStack({ totalPages: 3 });
    host.stack.set(stack);
    host.disabled.set(true);
    render();
    scrollIntoView(trigger, true, fixture);

    expect(stack.fetchedNext()).toBe(0);

    host.disabled.set(false);
    render();

    expect(stack.fetchedNext()).toBe(1);
  });

  it('fetches the previous page with direction previous', () => {
    const stack = createFakeStack({ totalPages: 5, loadedPage: 3 });
    host.stack.set(stack);
    host.direction.set('previous');
    render();
    scrollIntoView(trigger, true, fixture);

    expect(stack.fetchedPrevious()).toBe(1);
    expect(stack.fetchedNext()).toBe(0);

    stack.settle();
    render();

    expect(stack.fetchedPrevious()).toBe(2);
    expect(trigger.hasAttribute('data-exhausted')).toBe(true);
  });

  it('observes against a given root element', () => {
    const list = fixture.nativeElement.querySelector('.list') as HTMLElement;
    host.stack.set(createFakeStack({ totalPages: 3 }));
    host.root.set(list);
    render();

    expect(activeObserver()?.options?.root).toBe(list);
  });

  it('hides itself from assistive technology', () => {
    render();

    expect(trigger.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('PagedQueryTriggerDirective inside et-scrollable', () => {
  it('observes against the scrollable track and skips itself as a scrollable item', () => {
    installBrowserLikeIntersectionObserver();
    TestBed.configureTestingModule({ imports: [ScrollableTriggerHost] });
    const fixture = TestBed.createComponent(ScrollableTriggerHost);
    fixture.detectChanges();
    deliverInitialEntries();

    const trigger = fixture.nativeElement.querySelector('[data-testid="trigger"]') as HTMLElement;
    const track = fixture.nativeElement.querySelector('.et-scrollable-container');
    const observer = observers.find((candidate) => candidate.targets.has(trigger));

    expect(observer?.options).toEqual({ root: track, rootMargin: '200px' });
    expect(trigger.hasAttribute('etScrollableIgnoreChild')).toBe(true);

    scrollIntoView(trigger, true, fixture);

    expect(fixture.componentInstance.stack.fetchedNext()).toBe(1);
  });
});
