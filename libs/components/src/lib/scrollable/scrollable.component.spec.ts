import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import '../../test-helpers';
import { expectNothingRunsAfterDestroy } from '../testing/destroyed-mid-gesture';
import { fakeElementScroll, fakeLayout } from '../testing/fake-layout';
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
