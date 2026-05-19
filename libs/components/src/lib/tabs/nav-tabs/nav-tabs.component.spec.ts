import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import '../../../test-helpers';
import { NavTabLinkComponent } from './nav-tab-link.component';
import { NavTabsOutletComponent } from './nav-tabs-outlet.component';
import { NavTabsComponent } from './nav-tabs.component';

class ResizeObserverMock {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }
}

class IntersectionObserverMock {
  observe() {
    return undefined;
  }

  unobserve() {
    return undefined;
  }

  disconnect() {
    return undefined;
  }

  takeRecords() {
    return [];
  }
}

@Component({
  selector: 'et-test-nav-tabs-route-one',
  template: `<p>Route one</p>`,
})
class NavTabsRouteOneComponent {}

@Component({
  selector: 'et-test-nav-tabs-route-two',
  template: `<p>Route two</p>`,
})
class NavTabsRouteTwoComponent {}

@Component({
  template: `
    <et-nav-tabs [fit]="fit" [orientation]="orientation" [size]="size">
      <a et-nav-tab-link="/one">One</a>
      <a [disabled]="secondDisabled" et-nav-tab-link="/two">Two</a>
      <et-nav-tabs-outlet>
        <router-outlet />
      </et-nav-tabs-outlet>
    </et-nav-tabs>
  `,
  imports: [NavTabsComponent, NavTabLinkComponent, NavTabsOutletComponent, RouterOutlet],
})
class NavTabsTestHost {
  fit: 'content' | 'fill' = 'content';
  orientation: 'horizontal' | 'vertical' = 'horizontal';
  size: 'sm' | 'md' | 'lg' = 'md';
  secondDisabled = false;
}

describe('NavTabsComponent', () => {
  let fixture: ComponentFixture<NavTabsTestHost>;
  let router: Router;
  let originalElementScrollDescriptor: PropertyDescriptor | undefined;
  let originalIntersectionObserverDescriptor: PropertyDescriptor | undefined;
  let originalResizeObserverDescriptor: PropertyDescriptor | undefined;

  const getLinks = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.et-nav-tab-link') as NodeListOf<HTMLAnchorElement>);

  const navigateTo = (url: string) => {
    return router.navigateByUrl(url).then(() => {
      fixture.detectChanges();

      return fixture.whenStable().then(() => {
        fixture.detectChanges();
      });
    });
  };

  beforeEach(() => {
    originalElementScrollDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scroll');
    originalIntersectionObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'IntersectionObserver');
    originalResizeObserverDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'ResizeObserver');

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    });

    Object.defineProperty(globalThis, 'IntersectionObserver', {
      configurable: true,
      value: IntersectionObserverMock,
    });

    Object.defineProperty(HTMLElement.prototype, 'scroll', {
      configurable: true,
      value: vi.fn(),
    });

    TestBed.configureTestingModule({
      imports: [NavTabsRouteOneComponent, NavTabsRouteTwoComponent, NavTabsTestHost],
      providers: [
        provideRouter([
          { path: 'one', component: NavTabsRouteOneComponent },
          { path: 'two', component: NavTabsRouteTwoComponent },
        ]),
      ],
    });

    fixture = TestBed.createComponent(NavTabsTestHost);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    if (originalElementScrollDescriptor) {
      Object.defineProperty(HTMLElement.prototype, 'scroll', originalElementScrollDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, 'scroll');
    }

    if (originalIntersectionObserverDescriptor) {
      Object.defineProperty(globalThis, 'IntersectionObserver', originalIntersectionObserverDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'IntersectionObserver');
    }

    if (originalResizeObserverDescriptor) {
      Object.defineProperty(globalThis, 'ResizeObserver', originalResizeObserverDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, 'ResizeObserver');
    }
  });

  it('marks the active route link as selected and labels the outlet with it', async () => {
    await navigateTo('/one');

    const [firstLink, secondLink] = getLinks();
    const outlet = fixture.nativeElement.querySelector('et-nav-tabs-outlet');

    expect(firstLink?.classList.contains('et-nav-tab-link--active')).toBe(true);
    expect(firstLink?.getAttribute('aria-selected')).toBe('true');
    expect(secondLink?.getAttribute('aria-selected')).toBe('false');
    expect(outlet?.getAttribute('aria-labelledby')).toBe(firstLink?.id ?? null);
    expect(fixture.nativeElement.textContent).toContain('Route one');
  });

  it('navigates on Space and updates the active link and outlet labeling', async () => {
    await navigateTo('/one');

    const [, secondLink] = getLinks();

    secondLink?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const [firstLinkAfter, secondLinkAfter] = getLinks();
    const outlet = fixture.nativeElement.querySelector('et-nav-tabs-outlet');

    expect(router.url).toBe('/two');
    expect(firstLinkAfter?.classList.contains('et-nav-tab-link--active')).toBe(false);
    expect(secondLinkAfter?.classList.contains('et-nav-tab-link--active')).toBe(true);
    expect(outlet?.getAttribute('aria-labelledby')).toBe(secondLinkAfter?.id ?? null);
    expect(fixture.nativeElement.textContent).toContain('Route two');
  });

  it('reflects nav-tabs public inputs on the host', () => {
    fixture.componentInstance.fit = 'fill';
    fixture.componentInstance.orientation = 'vertical';
    fixture.componentInstance.size = 'lg';
    fixture.detectChanges();

    const navTabs = fixture.debugElement.query(By.directive(NavTabsComponent)).nativeElement as HTMLElement;

    expect(navTabs.getAttribute('data-fit')).toBe('fill');
    expect(navTabs.getAttribute('data-orientation')).toBe('vertical');
    expect(navTabs.getAttribute('data-size')).toBe('lg');
  });
});
