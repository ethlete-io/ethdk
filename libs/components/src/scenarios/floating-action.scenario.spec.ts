import { Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  FLOATING_ACTION_ERROR_CODES,
  FLOATING_ACTION_IMPORTS,
  FLOATING_ACTION_STATES,
  FLOATING_ACTION_TOKEN,
  FloatingActionAnchorDirective,
  FloatingActionDirective,
  FloatingActionScopeDirective,
  FloatingActionTopDirective,
  FloatingActionTriggerDirective,
} from '../index';
import { fakeLayout, fakeResizeObserver } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const code = (value: number) => `ET${value}`;

const VIEWPORT = new DOMRectReadOnly(0, 0, 1024, 768);
const ABOVE = new DOMRectReadOnly(0, -300, 1024, 100);
const IN_VIEW = new DOMRectReadOnly(0, 100, 1024, 100);
const BELOW = new DOMRectReadOnly(0, 900, 1024, 100);

type Observation = { callback: IntersectionObserverCallback; observer: IntersectionObserver; targets: Set<Element> };

const captureIntersections = () => {
  const Base = globalThis.IntersectionObserver;
  const observations: Observation[] = [];

  class CapturingIntersectionObserver extends Base {
    private observation: Observation;

    constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
      super(callback, options);
      this.observation = { callback, observer: this, targets: new Set() };
      observations.push(this.observation);
    }

    override observe(target: Element) {
      super.observe(target);
      this.observation.targets.add(target);
    }

    override unobserve(target: Element) {
      super.unobserve(target);
      this.observation.targets.delete(target);
    }

    override disconnect() {
      super.disconnect();
      this.observation.targets.clear();
    }
  }

  globalThis.IntersectionObserver = CapturingIntersectionObserver;

  return {
    restore: () => {
      globalThis.IntersectionObserver = Base;
    },
    scroll: (s: Scenario, target: Element, rect: DOMRectReadOnly) => {
      const visible = rect.bottom > VIEWPORT.top && rect.top < VIEWPORT.bottom;
      const entry = {
        target,
        boundingClientRect: rect,
        intersectionRect: visible ? rect : new DOMRectReadOnly(),
        rootBounds: VIEWPORT,
        isIntersecting: visible,
        intersectionRatio: visible ? 1 : 0,
        time: 0,
      } as IntersectionObserverEntry;

      for (const observation of observations) {
        if (observation.targets.has(target)) observation.callback([entry], observation.observer);
      }

      s.tick();
    },
  };
};

@Component({
  selector: 'et-scenario-filter-state-badge',
  template: `{{ floatingAction.state() }}`,
})
class FilterStateBadgeComponent {
  floatingAction = inject(FLOATING_ACTION_TOKEN);
}

@Component({
  selector: 'et-scenario-results-page',
  imports: [FLOATING_ACTION_IMPORTS, FilterStateBadgeComponent],
  template: `
    <header>Team A</header>
    <section [disabled]="sidebarLayout()" etFloatingAction>
      <h2 class="results-heading" etFloatingActionTop>Results</h2>
      <div class="anchor" etFloatingActionAnchor>
        <button (click)="applyFilters()" class="filter" etFloatingActionTrigger type="button">Filter</button>
      </div>
      <et-scenario-filter-state-badge />
      <ul class="results" etFloatingActionScope>
        @for (team of teams; track team) {
          <li>{{ team }}</li>
        }
      </ul>
    </section>
    <footer>Imprint</footer>
  `,
})
class ResultsPageComponent {
  floatingAction = viewChild.required(FloatingActionDirective);
  sidebarLayout = signal(false);
  teams = ['team-a', 'team-b', 'team-c'];

  applyFilters() {
    this.floatingAction().scrollToTop({ behavior: 'instant', block: 'start' });
  }
}

@Component({
  selector: 'et-scenario-back-to-top',
  imports: [FloatingActionDirective, FloatingActionAnchorDirective, FloatingActionTriggerDirective],
  template: `
    <main #page="etFloatingAction" class="page" etFloatingAction>
      <div class="anchor" etFloatingActionAnchor>
        <button (click)="page.scrollToTop()" class="back" etFloatingActionTrigger type="button">Back to top</button>
      </div>
      <p>Long article</p>
    </main>
  `,
})
class BackToTopComponent {}

@Component({
  selector: 'et-scenario-stray-floating-parts',
  imports: [
    FloatingActionDirective,
    FloatingActionAnchorDirective,
    FloatingActionTriggerDirective,
    FloatingActionScopeDirective,
    FloatingActionTopDirective,
  ],
  template: `
    <div class="stray-anchor" etFloatingActionAnchor></div>
    <button class="stray-trigger" etFloatingActionTrigger type="button">Stray</button>
    <ul class="stray-scope" etFloatingActionScope></ul>
    <h2 class="stray-top" etFloatingActionTop>Top</h2>
    <div class="no-anchor" etFloatingAction>
      <button etFloatingActionTrigger type="button">Lonely</button>
    </div>
  `,
})
class StrayFloatingPartsComponent {}

@Component({
  selector: 'et-scenario-late-filter',
  imports: [FLOATING_ACTION_IMPORTS],
  template: `
    <section etFloatingAction>
      <div class="anchor" etFloatingActionAnchor>
        @if (filtersLoaded()) {
          <button class="filter" etFloatingActionTrigger type="button">Filter</button>
        }
      </div>
      <ul class="results" etFloatingActionScope></ul>
    </section>
  `,
})
class LateFilterComponent {
  filtersLoaded = signal(false);
}

const query = <T extends HTMLElement = HTMLElement>(selector: string) => {
  const element = document.querySelector<T>(selector);

  if (!element) throw new Error(`No ${selector}`);

  return element;
};

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
};

describe('floating-action scenarios', () => {
  const scenario = useScenario();
  let intersections: ReturnType<typeof captureIntersections>;

  beforeEach(() => {
    intersections = captureIntersections();
  });

  afterEach(() => intersections.restore());

  it('pins the filter button while the results are on screen and drops it once they scroll away', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ResultsPageComponent);

    settle(s);

    const host = query('.et-floating-action');
    const trigger = query('.filter');
    const badge = query('et-scenario-filter-state-badge');
    const floatingAction = fixture.componentInstance.floatingAction();

    expect(host.getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.INLINE);
    expect(trigger.classList).toContain('et-floating-action-trigger');
    expect(query('.anchor').classList).toContain('et-floating-action-anchor');
    expect(query('.results').classList).toContain('et-floating-action-scope');

    intersections.scroll(s, query('.anchor'), BELOW);
    intersections.scroll(s, query('.results'), BELOW);
    expect(floatingAction.state()).toBe(FLOATING_ACTION_STATES.INLINE);

    intersections.scroll(s, query('.anchor'), ABOVE);
    intersections.scroll(s, query('.results'), IN_VIEW);

    expect(host.getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.FLOATING);
    expect(floatingAction.isFloating()).toBe(true);
    expect(badge.textContent).toBe(FLOATING_ACTION_STATES.FLOATING);
    expect(query('.anchor').contains(trigger)).toBe(true);

    intersections.scroll(s, query('.results'), ABOVE);
    expect(host.getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.HIDDEN);
    expect(floatingAction.isFloating()).toBe(false);

    intersections.scroll(s, query('.results'), IN_VIEW);
    expect(host.getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.FLOATING);

    intersections.scroll(s, query('.anchor'), IN_VIEW);
    expect(host.getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.INLINE);
    expect(badge.textContent).toBe(FLOATING_ACTION_STATES.INLINE);
  });

  it("holds the trigger's in-flow size on the anchor while it floats, so the results below never move", () => {
    const s = scenario();
    const resize = fakeResizeObserver();
    const size = { width: 96, height: 40 };

    fakeLayout([{ match: '.filter', offsetWidth: () => size.width, offsetHeight: () => size.height }]);
    TestBed.createComponent(ResultsPageComponent);
    settle(s);

    const anchor = query('.anchor');
    const trigger = query('.filter');
    const reserved = () => [
      anchor.style.getPropertyValue('min-inline-size'),
      anchor.style.getPropertyValue('min-block-size'),
    ];

    expect(resize.targets()).toContain(trigger);
    expect(reserved()).toEqual(['', '']);

    intersections.scroll(s, anchor, ABOVE);
    expect(reserved()).toEqual(['96px', '40px']);

    size.width = 56;
    size.height = 56;
    resize.fire(trigger);
    s.tick();
    expect(reserved()).toEqual(['96px', '40px']);

    intersections.scroll(s, query('.results'), ABOVE);
    expect(query('.et-floating-action').getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.HIDDEN);
    expect(reserved()).toEqual(['96px', '40px']);

    intersections.scroll(s, query('.results'), IN_VIEW);
    intersections.scroll(s, anchor, IN_VIEW);
    expect(reserved()).toEqual(['', '']);

    size.width = 120;
    size.height = 48;
    resize.fire(trigger);
    s.tick();
    intersections.scroll(s, anchor, ABOVE);
    expect(reserved()).toEqual(['120px', '48px']);
  });

  it('holds no size for a trigger that first appears while its anchor is already scrolled past', () => {
    const s = scenario();
    const resize = fakeResizeObserver();
    const isFloating = (element: Element) =>
      element.closest('.et-floating-action')?.getAttribute('data-state') !== FLOATING_ACTION_STATES.INLINE;

    fakeLayout([
      {
        match: '.filter',
        offsetWidth: (element) => (isFloating(element) ? 56 : 96),
        offsetHeight: (element) => (isFloating(element) ? 56 : 40),
      },
    ]);

    const fixture = TestBed.createComponent(LateFilterComponent);

    settle(s);

    const anchor = query('.anchor');
    const reserved = () => [
      anchor.style.getPropertyValue('min-inline-size'),
      anchor.style.getPropertyValue('min-block-size'),
    ];

    intersections.scroll(s, anchor, ABOVE);
    intersections.scroll(s, query('.results'), IN_VIEW);
    fixture.componentInstance.filtersLoaded.set(true);
    settle(s);
    resize.fire(query('.filter'));
    s.tick();

    expect(query('.et-floating-action').getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.FLOATING);
    expect(reserved()).toEqual(['', '']);

    intersections.scroll(s, anchor, IN_VIEW);
    resize.fire(query('.filter'));
    s.tick();
    intersections.scroll(s, anchor, ABOVE);
    expect(reserved()).toEqual(['96px', '40px']);
  });

  it('keeps the trigger inline in a layout that disables floating', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ResultsPageComponent);

    settle(s);
    intersections.scroll(s, query('.anchor'), ABOVE);
    expect(query('.et-floating-action').getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.FLOATING);

    fixture.componentInstance.sidebarLayout.set(true);
    s.tick();
    expect(query('.et-floating-action').getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.INLINE);

    fixture.componentInstance.sidebarLayout.set(false);
    s.tick();
    expect(query('.et-floating-action').getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.FLOATING);
  });

  it('scrolls back to the results heading after applying filters, or to the region without one', () => {
    const s = scenario();
    const scrollIntoView = vi.fn();
    const original = Element.prototype.scrollIntoView;

    Element.prototype.scrollIntoView = scrollIntoView;

    try {
      TestBed.createComponent(ResultsPageComponent);
      settle(s);

      query('.filter').click();
      expect(scrollIntoView).toHaveBeenCalledTimes(1);
      expect(scrollIntoView.mock.contexts[0]).toBe(query('.results-heading'));
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'instant', block: 'start' });

      TestBed.createComponent(BackToTopComponent);
      settle(s);

      query('.back').click();
      expect(scrollIntoView.mock.contexts[1]).toBe(query('.page'));
      expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: 'smooth', block: 'start' });
    } finally {
      Element.prototype.scrollIntoView = original;
    }
  });

  it('floats a back-to-top button for the rest of the page when there is no scope', () => {
    const s = scenario();

    TestBed.createComponent(BackToTopComponent);
    settle(s);

    intersections.scroll(s, query('.anchor'), ABOVE);
    expect(query('.page').getAttribute('data-state')).toBe(FLOATING_ACTION_STATES.FLOATING);
  });

  it('reports parts outside a floating action and a floating action without an anchor', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(StrayFloatingPartsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick(1);

    const contexts: (HTMLElement | undefined)[] = [];

    for (let i = 0; i < 5; i++) {
      const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

      contexts.push((s.errors.splice(index, 1)[0]?.error as { element?: HTMLElement } | undefined)?.element);
    }

    for (const part of ['Anchor', 'Trigger', 'Scope', 'Top']) {
      s.expectError(
        new RegExp(
          `${code(FLOATING_ACTION_ERROR_CODES.PART_OUTSIDE_FLOATING_ACTION)}: \\[FloatingAction${part}Directive\\]`,
        ),
      );
    }
    s.expectError(code(FLOATING_ACTION_ERROR_CODES.MISSING_ANCHOR));

    expect(contexts).toEqual(
      expect.arrayContaining([
        host.querySelector('.stray-anchor'),
        host.querySelector('.stray-trigger'),
        host.querySelector('.stray-scope'),
        host.querySelector('.stray-top'),
        host.querySelector('.no-anchor'),
      ]),
    );
  });
});
