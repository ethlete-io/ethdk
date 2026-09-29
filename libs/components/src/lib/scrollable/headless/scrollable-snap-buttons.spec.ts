import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../../test-helpers';
import { fakeElementScroll, fakeIntersectionObserver, fakeLayout } from '../../testing/fake-layout';
import { createScrollableDriver } from '../testing/scrollable-driver';
import { SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from '../scrollable.imports';
import { ScrollableDirective } from './scrollable.directive';
import { ScrollableScrollOrigin } from './scrollable.types';

@Component({
  template: `
    <et-scrollable [etScrollableSnap]="snapEnabled()" [snapOrigin]="origin()">
      <div class="et-scrollable-item">one</div>
      <div class="et-scrollable-item">two</div>
    </et-scrollable>
  `,
  imports: [SCROLLABLE_IMPORTS, SCROLLABLE_DRAG_IMPORTS],
})
class SnapHost {
  snapEnabled = signal(true);
  origin = signal<ScrollableScrollOrigin>('auto');
}

@Component({
  template: `
    <et-scrollable etScrollableButtons scrollMode="container">
      <div class="et-scrollable-item">one</div>
      <div class="et-scrollable-item">two</div>
    </et-scrollable>
  `,
  imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
})
class ButtonsHost {}

const settle = async (fixture: ComponentFixture<unknown>) => {
  for (let i = 0; i < 3; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }
};

describe('ScrollableSnapDirective', () => {
  const create = async () => {
    const fixture = TestBed.createComponent(SnapHost);

    await settle(fixture);

    const scrollableEl = fixture.nativeElement.querySelector('et-scrollable') as HTMLElement;
    const scrollable = fixture.debugElement.children[0]!.injector.get(ScrollableDirective);

    return { fixture, scrollableEl, scrollable };
  };

  it('marks the scrollable as snapping with the requested origin', async () => {
    const { fixture, scrollableEl } = await create();

    expect(scrollableEl.hasAttribute('snap')).toBe(true);
    expect(scrollableEl.getAttribute('snap-origin')).toBe('auto');

    fixture.componentInstance.origin.set('center');
    await settle(fixture);

    expect(scrollableEl.getAttribute('snap-origin')).toBe('center');
  });

  it('stops snapping while disabled', async () => {
    const { fixture, scrollableEl } = await create();

    fixture.componentInstance.snapEnabled.set(false);
    await settle(fixture);

    expect(scrollableEl.hasAttribute('snap')).toBe(false);
    expect(scrollableEl.hasAttribute('snap-origin')).toBe(false);
  });

  it('keeps snapping suspended until every suspension is released', async () => {
    const { fixture, scrollableEl, scrollable } = await create();

    const releaseFirst = scrollable.suspendSnap();
    const releaseSecond = scrollable.suspendSnap();
    await settle(fixture);

    expect(scrollableEl.hasAttribute('snap-suspended')).toBe(true);

    releaseFirst();
    releaseFirst();
    await settle(fixture);

    expect(scrollableEl.hasAttribute('snap-suspended')).toBe(true);

    releaseSecond();
    await settle(fixture);

    expect(scrollableEl.hasAttribute('snap-suspended')).toBe(false);
  });
});

describe('ScrollableButtonsComponent and container paging', () => {
  const create = async (scrollLeft: number) => {
    fakeLayout([{ match: '.et-scrollable-container', clientWidth: 300 }]);
    const scroll = fakeElementScroll();
    const fixture = TestBed.createComponent(ButtonsHost);
    const driver = createScrollableDriver(fixture);

    await settle(fixture);

    const container = driver.container()!;

    Object.defineProperty(container, 'scrollLeft', { configurable: true, value: scrollLeft });

    return { fixture, driver, scroll };
  };

  it('pages by one container width toward the end of a left-to-right track', async () => {
    const { fixture, scroll } = await create(100);

    fixture.debugElement.children[0]!.injector.get(ScrollableDirective).scrollOneContainerSize('end');

    expect(scroll.lastCall()?.options).toMatchObject({ left: 400, behavior: 'smooth' });
  });

  it('pages by one container width toward the start of a left-to-right track', async () => {
    const { fixture, scroll } = await create(500);

    fixture.debugElement.children[0]!.injector.get(ScrollableDirective).scrollOneContainerSize('start');

    expect(scroll.lastCall()?.options.left).toBe(200);
  });

  const reachEdges = async (
    fixture: ComponentFixture<unknown>,
    observer: ReturnType<typeof fakeIntersectionObserver>,
    edges: { atStart: boolean; atEnd: boolean },
  ) => {
    const query = (selector: string) => fixture.nativeElement.querySelector(selector) as HTMLElement;

    observer.fire(query('.et-scroll-observer-first-element'), { isIntersecting: edges.atStart });
    observer.fire(query('.et-scroll-observer-last-element'), { isIntersecting: edges.atEnd });
    await settle(fixture);
  };

  it('renders a start and an end button that page the track when clicked', async () => {
    const observer = fakeIntersectionObserver();
    const { fixture, driver, scroll } = await create(500);
    const [start, end] = driver.buttons()!.querySelectorAll<HTMLButtonElement>('button');

    await reachEdges(fixture, observer, { atStart: false, atEnd: false });

    end!.click();
    expect(scroll.lastCall()?.options.left).toBe(800);

    start!.click();
    expect(scroll.lastCall()?.options.left).toBe(200);
  });

  it('disables the button at the edge it cannot scroll past', async () => {
    const observer = fakeIntersectionObserver();
    const { fixture, driver } = await create(0);
    const [start, end] = driver.buttons()!.querySelectorAll<HTMLButtonElement>('button');

    await reachEdges(fixture, observer, { atStart: true, atEnd: false });

    expect(start!.disabled).toBe(true);
    expect(end!.disabled).toBe(false);

    await reachEdges(fixture, observer, { atStart: false, atEnd: true });

    expect(start!.disabled).toBe(false);
    expect(end!.disabled).toBe(true);
  });
});
