import { Component, getDebugNode, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import {
  SCROLLABLE_DARKEN_IMPORTS,
  SCROLLABLE_DRAG_IMPORTS,
  SCROLLABLE_ERROR_CODES,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
  ScrollableActiveChildDirective,
  ScrollableButtonsComponent,
  ScrollableButtonsDirective,
  ScrollableComponent,
  ScrollableDarkenDirective,
  ScrollableDirective,
  ScrollableDragDirective,
  ScrollableIgnoreChildDirective,
  ScrollableIntersectionChange,
  ScrollableLoadingTemplateDirective,
  ScrollableMasksComponent,
  ScrollableNavigationComponent,
  ScrollableNavigationDirective,
  ScrollableScrollState,
  ScrollableSnapDirective,
} from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import { fakeElementScroll, fakeIntersectionObserver, fakeLayout } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const TRACK_WIDTH = 300;
const SLIDE_WIDTH = 100;

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const slideIndex = (element: Element) =>
  Array.from(element.parentElement?.children ?? [])
    .filter((child) => child.matches('.slide'))
    .indexOf(element);

const overflowingTrack = () => {
  const track = { offset: 0, scrollLeftWrites: [] as number[] };
  const scrollWidth = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth');
  const scrollLeft = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollLeft');

  Object.defineProperty(Element.prototype, 'scrollLeft', {
    configurable: true,
    get: () => 0,
    set(this: Element, value: number) {
      if (this.matches('.et-scrollable-container')) track.scrollLeftWrites.push(value);
    },
  });

  Object.defineProperty(Element.prototype, 'scrollWidth', {
    configurable: true,
    get(this: Element) {
      return this.matches('.et-scrollable-container') ? TRACK_WIDTH * 2 : 0;
    },
  });
  onTestFinished(() => {
    if (scrollWidth) Object.defineProperty(Element.prototype, 'scrollWidth', scrollWidth);
    if (scrollLeft) Object.defineProperty(Element.prototype, 'scrollLeft', scrollLeft);
  });

  fakeLayout([
    { match: '.et-scrollable-container', clientWidth: TRACK_WIDTH, rect: { left: 0, width: TRACK_WIDTH, height: 80 } },
    {
      match: '.slide',
      offsetWidth: SLIDE_WIDTH,
      offsetLeft: (element) => slideIndex(element) * SLIDE_WIDTH,
      rect: (element) => ({ left: slideIndex(element) * SLIDE_WIDTH - track.offset, width: SLIDE_WIDTH, height: 80 }),
    },
  ]);

  return track;
};

@Component({
  selector: 'et-scenario-team-rail',
  imports: [
    ScrollableComponent,
    ScrollableActiveChildDirective,
    ScrollableIgnoreChildDirective,
    ScrollableLoadingTemplateDirective,
    ScrollableButtonsDirective,
    ScrollableNavigationDirective,
  ],
  template: `
    <et-scrollable
      [showLoadingTemplate]="loading()"
      [etScrollableButtons]="{ position: buttonPosition() }"
      [etScrollableNavigation]="{ enabled: dots() }"
      (scrollStateChange)="states.push($event)"
      (intersectionChange)="changes.push($event)"
      scrollableRole="list"
      scrollableClass="team-rail"
      itemSize="third"
      maskVariant="border"
    >
      @for (team of teams(); track team) {
        <div [etScrollableActiveChild]="team === active()" class="slide" role="listitem">{{ team }}</div>
      }
      <div class="rail-note" etScrollableIgnoreChild>Swipe for more</div>
      <ng-template etScrollableLoadingTemplate repeatContentCount="2" let-index="index">
        <div class="skeleton" etScrollableIgnoreChild>loading {{ index }}</div>
      </ng-template>
    </et-scrollable>
  `,
})
class TeamRailComponent {
  teams = signal(['team-a', 'team-b', 'team-c', 'team-d', 'team-e', 'team-f']);
  active = signal('team-e');
  loading = signal(false);
  dots = signal(true);
  buttonPosition = signal<'inside' | 'footer'>('inside');
  states: ScrollableScrollState[] = [];
  changes: ScrollableIntersectionChange[][] = [];
}

@Component({
  selector: 'et-scenario-fixture-strip',
  imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS, SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_DARKEN_IMPORTS],
  template: `
    <et-scrollable
      [etScrollableDarken]="darken()"
      [etScrollableDrag]="drag()"
      renderMasks="false"
      etScrollableButtons
      etScrollableSnap
      snapOrigin="start"
      scrollMode="element"
    >
      @for (fixture of fixtures; track fixture) {
        <div class="slide">{{ fixture }}</div>
      }
    </et-scrollable>
  `,
})
class FixtureStripComponent {
  fixtures = ['match-1', 'match-2', 'match-3', 'match-4', 'match-5'];
  darken = signal(true);
  drag = signal(true);
}

@Component({
  selector: 'et-scenario-headless-track',
  imports: [ScrollableDirective],
  template: `<div class="bare" etScrollable></div>`,
})
class HeadlessTrackComponent {}

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
};

const directiveOf = (host: HTMLElement) =>
  getDebugNode(query('et-scrollable', host))!.injector.get(ScrollableDirective);

describe('scrollable scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes(TEST_COLOR_THEMES)] });

  it('renders a scrollable list with masks, placeholders and its scroll state', () => {
    const s = scenario();

    const track = overflowingTrack();
    const io = fakeIntersectionObserver();
    const scroll = fakeElementScroll();
    const fixture = TestBed.createComponent(TeamRailComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    settle(s);

    const scrollable = query('et-scrollable', host);
    const container = query('.et-scrollable-container', host);

    expect(getDebugNode(scrollable)?.componentInstance).toBeInstanceOf(ScrollableComponent);
    expect(scrollable.getAttribute('item-size')).toBe('third');
    expect(scrollable.getAttribute('direction')).toBe('horizontal');
    expect(scrollable.getAttribute('mask-variant')).toBe('border');
    expect(scrollable.classList).toContain('et-scrollable--can-scroll');
    expect(container.getAttribute('role')).toBe('list');
    expect(container.classList).toContain('team-rail');
    expect(queryAll('.slide', host).every((slide) => slide.classList.contains('et-scrollable-item'))).toBe(true);
    expect(query('.rail-note', host).classList).not.toContain('et-scrollable-item');
    expect(query('.rail-note', host).hasAttribute('etScrollableIgnoreChild')).toBe(true);
    expect(scrollable.style.getPropertyValue('--item-count')).toBe('6');
    expect(getDebugNode(query('et-scrollable-masks', host))?.componentInstance).toBeInstanceOf(
      ScrollableMasksComponent,
    );
    expect(app.states.at(-1)).toEqual({ canScroll: true, isAtStart: true, isAtEnd: true });
    expect(track.scrollLeftWrites).toEqual([2 * SLIDE_WIDTH]);
    expect(
      directiveOf(host)
        .getActiveChildren()()
        .map((child) => child.isActiveChildEnabled()),
    ).toEqual([false, false, false, false, true, false]);

    io.fire(query('.et-scroll-observer-first-element', host), { isIntersecting: true, intersectionRatio: 1 });
    io.fire(query('.et-scroll-observer-last-element', host), { isIntersecting: false, intersectionRatio: 0 });
    settle(s);

    expect(scrollable.classList).toContain('et-scrollable--is-at-start');
    expect(app.states.at(-1)).toEqual({ canScroll: true, isAtStart: true, isAtEnd: false });

    const [start, end] = queryAll<HTMLButtonElement>('.et-scrollable-button', host);

    expect(getDebugNode(query('et-scrollable-buttons', host))?.componentInstance).toBeInstanceOf(
      ScrollableButtonsComponent,
    );
    expect(query('et-scrollable-buttons', host).classList).toContain('et-scrollable-buttons--inside');
    expect(start?.disabled).toBe(true);
    expect(end?.disabled).toBe(false);
    expect(end?.getAttribute('aria-hidden')).toBe('true');
    expect(end?.getAttribute('tabindex')).toBe('-1');

    end?.click();
    expect(scroll.lastCall()).toMatchObject({ method: 'scrollTo', target: container });
    expect(scroll.lastCall()?.options.behavior).toBe('smooth');

    queryAll('.slide', host).forEach((slide, index) =>
      io.fire(slide, { isIntersecting: index < 3, intersectionRatio: index < 3 ? 1 : 0 }),
    );
    s.tick(60);
    settle(s);

    expect(app.changes.at(-1)?.map((change) => change.isIntersecting)).toEqual([true, true, true, false, false, false]);
    expect(query('.et-scrollable-footer', host).getAttribute('aria-hidden')).toBe('true');
    expect(getDebugNode(query('et-scrollable-navigation', host))?.componentInstance).toBeInstanceOf(
      ScrollableNavigationComponent,
    );

    const dots = queryAll<HTMLButtonElement>('.et-scrollable-navigation-item', host);

    expect(dots).toHaveLength(6);
    expect(dots[0]?.classList).toContain('et-scrollable-navigation-item--active');

    dots[4]?.click();
    settle(s);

    expect(scroll.lastCall()).toMatchObject({ method: 'scroll', target: container });
    expect(scroll.lastCall()?.options.left).toBeGreaterThan(0);
    expect(queryAll('.et-scrollable-navigation-item', host)[4]?.classList).toContain(
      'et-scrollable-navigation-item--active',
    );

    container.dispatchEvent(new Event('scroll'));
    s.tick(60);

    app.loading.set(true);
    settle(s);

    expect(queryAll('.skeleton', host).map((el) => el.textContent?.trim())).toEqual(['loading 0', 'loading 1']);
    expect(query('.et-scrollable-container', host).lastElementChild?.previousElementSibling?.className).toContain(
      'skeleton',
    );

    app.dots.set(false);
    app.buttonPosition.set('footer');
    settle(s);

    expect(host.querySelector('et-scrollable-navigation')).toBeNull();
    expect(query('.et-scrollable-footer', host).classList).toContain('et-scrollable-footer--with-buttons');
    expect(query('et-scrollable-buttons', host).classList).toContain('et-scrollable-buttons--footer');

    fixture.destroy();
    s.frame(2);
  });

  it('opens the track on an active child that starts exactly at the track end', () => {
    const s = scenario();
    const track = overflowingTrack();

    fakeIntersectionObserver();
    fakeElementScroll();
    const fixture = TestBed.createComponent(TeamRailComponent);

    fixture.componentInstance.active.set('team-d');
    settle(s);

    try {
      expect(track.scrollLeftWrites).toEqual([SLIDE_WIDTH]);
    } finally {
      fixture.destroy();
      s.frame(2);
    }
  });

  it('pages one child at a time, darkens partial children and settles a mouse drag onto a child', () => {
    const s = scenario();

    const track = overflowingTrack();
    const io = fakeIntersectionObserver();
    const scroll = fakeElementScroll();
    const fixture = TestBed.createComponent(FixtureStripComponent);
    const app = fixture.componentInstance;
    const host = fixture.nativeElement as HTMLElement;

    settle(s);

    const scrollable = query('et-scrollable', host);
    const container = query('.et-scrollable-container', host);
    const slides = queryAll('.slide', host);

    expect(host.querySelector('et-scrollable-masks')).toBeNull();
    expect(scrollable.hasAttribute('snap')).toBe(true);
    expect(scrollable.getAttribute('snap-origin')).toBe('start');
    expect(scrollable.classList).toContain('et-scrollable--darken-non-intersecting-items');

    slides.forEach((slide, index) =>
      io.fire(slide, {
        isIntersecting: index < 4,
        intersectionRatio: index < 3 ? 1 : index === 3 ? 0.5 : 0,
      }),
    );
    settle(s);

    expect(slides.map((slide) => slide.classList.contains('et-scrollable-item--not-intersecting'))).toEqual([
      false,
      false,
      false,
      true,
      true,
    ]);

    io.fire(query('.et-scroll-observer-last-element', host), { isIntersecting: false, intersectionRatio: 0 });
    settle(s);
    query<HTMLButtonElement>('.et-scrollable-button--end', host).click();
    expect(scroll.lastCall()).toMatchObject({ method: 'scroll', target: container });
    expect(scroll.lastCall()?.options.left).toBe(2 * SLIDE_WIDTH);

    const scrollsBefore = scroll.calls().length;

    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 200, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 130, clientY: 10 }));
    settle(s);

    expect(scrollable.hasAttribute('snap-suspended')).toBe(true);
    expect(scroll.calls()[scrollsBefore]?.options).toEqual({ left: 70, behavior: 'instant' });

    track.offset = 70;
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    settle(s);

    expect(scroll.lastCall()?.options).toMatchObject({ left: 30 });
    expect(scrollable.hasAttribute('snap-suspended')).toBe(true);

    s.tick(700);
    settle(s);
    expect(scrollable.hasAttribute('snap-suspended')).toBe(false);

    app.darken.set(false);
    app.drag.set(false);
    settle(s);

    expect(scrollable.classList).not.toContain('et-scrollable--darken-non-intersecting-items');
    expect(slides.some((slide) => slide.classList.contains('et-scrollable-item--not-intersecting'))).toBe(false);

    const calls = scroll.calls().length;

    container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 200, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 100, clientY: 10 }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    settle(s);
    expect(scroll.calls()).toHaveLength(calls);

    expect(getDebugNode(scrollable)?.injector.get(ScrollableDragDirective).enabled()).toBe(false);
    expect(getDebugNode(scrollable)?.injector.get(ScrollableSnapDirective).snapOrigin()).toBe('start');
    expect(getDebugNode(scrollable)?.injector.get(ScrollableDarkenDirective).enabled()).toBe(false);
    expect(getDebugNode(scrollable)?.injector.get(ScrollableButtonsDirective).position()).toBe('inside');

    fixture.destroy();
    s.frame(2);
  });

  it('reports a headless scrollable without a scroll container', () => {
    const s = scenario();

    TestBed.createComponent(HeadlessTrackComponent);
    s.tick(1);

    const messages = s.errors.splice(0).map((entry) => String(entry.error));

    expect(messages.filter((message) => message.startsWith('Error: ET'))).toEqual([
      expect.stringContaining(`ET${SCROLLABLE_ERROR_CODES.MISSING_SCROLL_CONTAINER}`),
    ]);
  });
});
