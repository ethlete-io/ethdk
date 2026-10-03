import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { fakeElementScroll, fakeIntersectionObserver, fakeLayout } from '../testing/fake-layout';
import { ScrollableDirective } from './headless/scrollable.directive';
import { ScrollableNavigationComponent } from './headless/scrollable-navigation.component';
import { SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS } from './scrollable.imports';
import { createScrollableDriver } from './testing/scrollable-driver';

@Component({
  template: `
    @if (shown()) {
      <et-scrollable [scrollMargin]="scrollMargin()" etScrollableNavigation>
        @for (item of items(); track item) {
          <div class="et-scrollable-item">{{ item }}</div>
        }
      </et-scrollable>
    }
  `,
  imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
})
class TestHostComponent {
  public shown = signal(true);
  public items = signal<number[]>([]);
  public scrollMargin = signal<number | string>(0);
}

const create = async (items: number[] = []) => {
  const intersections = fakeIntersectionObserver();
  const scroll = fakeElementScroll();

  fakeLayout([{ match: '.et-scrollable-container', clientWidth: 200 }]);
  Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get: () => 800 });
  onTestFinished(() => {
    Reflect.deleteProperty(Element.prototype, 'scrollWidth');
  });

  const fixture = TestBed.createComponent(TestHostComponent);

  fixture.componentInstance.items.set(items);

  for (let i = 0; i < 2; i++) {
    fixture.detectChanges();
    await fixture.whenStable();
  }

  return { fixture, intersections, scroll, driver: createScrollableDriver(fixture) };
};

const scrollableOf = (fixture: ComponentFixture<TestHostComponent>) =>
  fixture.debugElement.query(By.directive(ScrollableDirective)).injector.get(ScrollableDirective);

const navigationOf = (fixture: ComponentFixture<TestHostComponent>) =>
  fixture.debugElement.query(By.directive(ScrollableNavigationComponent))
    .componentInstance as ScrollableNavigationComponent;

describe('ScrollableDirective edge cases', () => {
  it('renders no dots and pages nowhere without children', async () => {
    const { fixture, scroll } = await create();
    const scrollable = scrollableOf(fixture);

    expect(navigationOf(fixture).navigation()).toEqual({ items: [], activeIndex: -1 });
    expect(fixture.nativeElement.querySelectorAll('.et-scrollable-navigation-item')).toHaveLength(0);

    scrollable.scrollOneItemSize('end');
    scrollable.scrollToElementByIndex({ index: 0 });

    expect(scroll.lastCall()).toBeNull();
  });

  it('ignores an out-of-range or NaN index', async () => {
    const { fixture, scroll } = await create([0]);
    const scrollable = scrollableOf(fixture);

    scrollable.scrollToElementByIndex({ index: -1 });
    scrollable.scrollToElementByIndex({ index: 1 });
    scrollable.scrollToElementByIndex({ index: NaN });

    expect(scroll.lastCall()).toBeNull();
  });

  it('marks the only child active once it intersects', async () => {
    const { fixture, intersections, driver } = await create([0]);

    intersections.fire(driver.children()[0]!, { intersectionRatio: 1 });
    fixture.detectChanges();

    expect(navigationOf(fixture).activeIndex()).toBe(0);
    expect(fixture.nativeElement.querySelector('.et-scrollable-navigation-item--active')).not.toBeNull();
  });

  it('ignores a dot click for a child that is gone', async () => {
    const { fixture, scroll } = await create([0, 1]);
    const navigation = navigationOf(fixture);

    fixture.componentInstance.items.set([0]);
    fixture.detectChanges();
    await fixture.whenStable();
    navigation.scrollToElementViaNavigation(1);

    expect(scroll.lastCall()).toBeNull();
  });

  it('falls back to no scroll margin for a non-numeric value', async () => {
    const { fixture } = await create([0]);

    fixture.componentInstance.scrollMargin.set('wide');
    fixture.detectChanges();

    const scrollable = scrollableOf(fixture);
    const host = fixture.nativeElement.querySelector('et-scrollable') as HTMLElement;

    expect(scrollable.scrollMargin()).toBe(0);
    expect(host.style.getPropertyValue('--_et-scrollable-scroll-margin')).toBe('0px');
  });

  it('can be destroyed with a dot click still waiting for its scroll to settle', async () => {
    const { fixture, intersections, driver } = await create([0, 1, 2]);

    intersections.fire(driver.children()[0]!, { intersectionRatio: 1 });
    fixture.detectChanges();
    navigationOf(fixture).scrollToElementViaNavigation(2);
    fixture.componentInstance.shown.set(false);
    fixture.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(fixture.nativeElement.querySelector('et-scrollable')).toBeNull();
  });
});
