import { Component, ElementRef } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../testing/destroyed-mid-gesture';
import { fakeElementScroll, fakeIntersectionObserver, fakeLayout } from '../testing/fake-layout';
import { ScrollableDirective } from './headless/scrollable.directive';
import { ScrollableNavigationComponent } from './headless/scrollable-navigation.component';
import { createScrollableDriver } from './testing/scrollable-driver';
import { ScrollableComponent } from './scrollable.component';
import {
  SCROLLABLE_DARKEN_IMPORTS,
  SCROLLABLE_DRAG_IMPORTS,
  SCROLLABLE_IMPORTS,
  SCROLLABLE_NAVIGATION_IMPORTS,
} from './scrollable.imports';

describe('ScrollableComponent', () => {
  let fixture: ComponentFixture<ScrollableComponent>;
  let driver: ReturnType<typeof createScrollableDriver<ScrollableComponent>>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ScrollableComponent],
    });

    fixture = TestBed.createComponent(ScrollableComponent);
    driver = createScrollableDriver(fixture);
  });

  it('renders masks by default and no chrome until a feature registers some', () => {
    fixture.detectChanges();

    expect(driver.masks()).not.toBeNull();
    expect(driver.buttons()).toBeNull();
    expect(driver.navigation()).toBeNull();
  });

  it('forwards container role and custom class inputs', () => {
    fixture.componentRef.setInput('scrollableRole', 'tablist');
    fixture.componentRef.setInput('scrollableClass', 'custom-scroll-container');
    fixture.detectChanges();

    const container = driver.container();
    expect(container?.getAttribute('role')).toBe('tablist');
    expect(container?.classList.contains('custom-scroll-container')).toBe(true);
  });

  it('omits masks when renderMasks is off', () => {
    fixture.componentRef.setInput('renderMasks', false);
    fixture.detectChanges();

    expect(driver.masks()).toBeNull();
  });

  it('forgets the masks once renderMasks turns off', () => {
    fixture.detectChanges();

    const scrollable = fixture.debugElement.injector.get(ScrollableDirective);

    expect(scrollable.masksDirective()).not.toBeNull();

    fixture.componentRef.setInput('renderMasks', false);
    fixture.detectChanges();

    expect(scrollable.masksDirective()).toBeNull();
  });
});

describe('ScrollableComponent opt-in features', () => {
  @Component({
    template: `
      <et-scrollable
        [etScrollableButtons]="{ sticky: true }"
        etScrollableDarken
        etScrollableDrag
        etScrollableSnap
      ></et-scrollable>
    `,
    imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS, SCROLLABLE_DRAG_IMPORTS, SCROLLABLE_DARKEN_IMPORTS],
  })
  class TestHostComponent {}

  it('stamps the buttons and carries the feature host classes', () => {
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    const scrollable = fixture.nativeElement.querySelector('et-scrollable') as HTMLElement;

    expect(scrollable.querySelector('et-scrollable-buttons')).not.toBeNull();
    expect(scrollable.classList.contains('et-scrollable--sticky-buttons')).toBe(true);
    expect(scrollable.classList.contains('et-scrollable--darken-non-intersecting-items')).toBe(true);
    expect(scrollable.getAttribute('snap')).toBe('');
  });
});

describe('ScrollableComponent buttons without masks', () => {
  @Component({
    template: `
      <et-scrollable etScrollableButtons renderMasks="false" scrollMode="element">
        <div>One</div>
        <div>Two</div>
      </et-scrollable>
    `,
    imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  })
  class TestHostComponent {}

  it('turns on the child intersections the item-wise buttons scroll by', () => {
    const activate = vi.spyOn(ScrollableDirective.prototype, 'activateChildIntersections');
    const fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('et-scrollable-masks')).toBeNull();
    expect(activate).toHaveBeenCalled();
    activate.mockRestore();
  });
});

describe('ScrollableComponent destroyed mid-gesture', () => {
  @Component({
    template: `
      <et-scrollable etScrollableDrag etScrollableNavigation>
        <div class="et-scrollable-item">one</div>
        <div class="et-scrollable-item">two</div>
      </et-scrollable>
    `,
    imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS, SCROLLABLE_DRAG_IMPORTS],
  })
  class TestHostComponent {}

  const overflowing = () => {
    const sizes = { scrollWidth: 400, clientWidth: 200 };

    for (const [name, value] of Object.entries(sizes)) {
      Object.defineProperty(Element.prototype, name, { configurable: true, get: () => value });
    }

    onTestFinished(() => {
      for (const name of Object.keys(sizes)) Reflect.deleteProperty(Element.prototype, name);
    });
  };

  const create = async () => {
    fakeElementScroll();
    overflowing();

    const fixture = TestBed.createComponent(TestHostComponent);

    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    return { fixture, driver: createScrollableDriver(fixture) };
  };

  it('stops a mouse drag of the track when the scrollable is destroyed', async () => {
    const { fixture, driver } = await create();
    const container = driver.container()!;

    await expectNothingRunsAfterDestroy({
      fixture,
      start: () => {
        container.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0, clientX: 200, clientY: 10 }));
        document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 150, clientY: 10 }));
      },
    });
  });

  it('drops the scroll listener a dot navigation added when the scrollable is destroyed', async () => {
    const { fixture, driver } = await create();
    const navigation = fixture.debugElement.query(By.directive(ScrollableNavigationComponent))
      .componentInstance as ScrollableNavigationComponent;

    await expectNothingRunsAfterDestroy({
      fixture,
      targets: [driver.container()!],
      start: () => {
        navigation.scrollToElementViaNavigation(1);
        fixture.detectChanges();
      },
    });
  });
});

describe('ScrollableComponent container paging', () => {
  it('pages toward the inline end of a right-to-left track', () => {
    fakeLayout([{ match: '.et-scrollable-container', clientWidth: 300 }]);
    const scroll = fakeElementScroll();
    const fixture = TestBed.createComponent(ScrollableComponent);
    const driver = createScrollableDriver(fixture);
    fixture.detectChanges();

    const container = driver.container();

    if (!container) throw new Error('No scroll container');

    container.style.direction = 'rtl';
    Object.defineProperty(container, 'scrollLeft', { configurable: true, value: -100 });
    fixture.debugElement.injector.get(ScrollableDirective).scrollOneContainerSize('end');

    expect(scroll.lastCall()?.options.left).toBe(-400);
  });
});

describe('ScrollableComponent navigation dots', () => {
  @Component({
    template: `
      <et-scrollable etScrollableNavigation>
        @for (item of items; track item) {
          <div class="et-scrollable-item">{{ item }}</div>
        }
      </et-scrollable>
    `,
    imports: [SCROLLABLE_IMPORTS, SCROLLABLE_NAVIGATION_IMPORTS],
  })
  class TestHostComponent {
    items = [0, 1, 2, 3, 4, 5, 6, 7];
  }

  const create = async () => {
    const intersections = fakeIntersectionObserver();

    fakeElementScroll();
    fakeLayout([
      { match: '.et-scrollable-navigation-item', clientWidth: 10 },
      { match: '.et-scrollable-container', clientWidth: 200 },
    ]);
    Object.defineProperty(Element.prototype, 'scrollWidth', { configurable: true, get: () => 800 });
    onTestFinished(() => {
      Reflect.deleteProperty(Element.prototype, 'scrollWidth');
    });

    const fixture = TestBed.createComponent(TestHostComponent);

    for (let i = 0; i < 3; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }

    const driver = createScrollableDriver(fixture);
    const navigation = fixture.debugElement.query(By.directive(ScrollableNavigationComponent))
      .componentInstance as ScrollableNavigationComponent;

    const showChild = (index: number) => {
      for (const [childIndex, child] of driver.children().entries()) {
        intersections.fire(child, { intersectionRatio: childIndex === index ? 1 : 0.1 });
      }

      fixture.detectChanges();
    };

    return { fixture, driver, navigation, showChild };
  };

  it('shifts the dots toward the inline end of a right-to-left track', async () => {
    const { fixture, showChild } = await create();
    const dotsContainer = fixture.nativeElement.querySelector('.et-scrollable-dots-container') as HTMLElement;

    dotsContainer.style.direction = 'rtl';
    showChild(6);

    expect(dotsContainer.style.transform).toBe('translateX(30px)');
  });

  it('shifts the dots toward the inline start of a left-to-right track', async () => {
    const { fixture, showChild } = await create();
    const dotsContainer = fixture.nativeElement.querySelector('.et-scrollable-dots-container') as HTMLElement;

    showChild(6);

    expect(dotsContainer.style.transform).toBe('translateX(-30px)');
  });

  it('hands the dots back to the intersections when a dot click scrolls nothing', async () => {
    const { fixture, navigation, showChild } = await create();

    showChild(2);
    navigation.scrollToElementViaNavigation(2);
    fixture.detectChanges();

    await new Promise((resolve) => setTimeout(resolve, 100));
    showChild(4);

    expect(navigation.activeIndex()).toBe(4);
  });
});

describe('ScrollableComponent gap', () => {
  it('reads no gap where the environment has no getComputedStyle', () => {
    const fixture = TestBed.createComponent(ScrollableComponent);

    fixture.detectChanges();

    const scrollable = fixture.debugElement.injector.get(ScrollableDirective);

    vi.stubGlobal('getComputedStyle', undefined);
    onTestFinished(() => {
      vi.unstubAllGlobals();
    });
    scrollable.scrollContainerRef.set(new ElementRef(document.createElement('div')));

    expect(scrollable.gapValue()).toBeNull();
  });
});
