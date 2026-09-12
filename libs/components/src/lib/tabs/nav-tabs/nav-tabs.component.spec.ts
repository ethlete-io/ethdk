import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, RouterOutlet, provideRouter } from '@angular/router';
import '../../../test-helpers';
import { expectAriaTablist } from '../../testing/aria-structure';
import { fakeElementScroll, fakeIntersectionObserver, fakeResizeObserver } from '../../testing/fake-layout';
import { NavTabLinkComponent } from './nav-tab-link.component';
import { NavTabsOutletComponent } from './nav-tabs-outlet.component';
import { NavTabsComponent } from './nav-tabs.component';

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

@Component({
  template: `
    <et-nav-tabs>
      <a et-nav-tab-link="/one">One</a>
      <a et-nav-tab-link="/two">Two</a>
    </et-nav-tabs>
    <et-nav-tabs-outlet>
      <router-outlet />
    </et-nav-tabs-outlet>
  `,
  imports: [NavTabsComponent, NavTabLinkComponent, NavTabsOutletComponent, RouterOutlet],
})
class SiblingOutletTestHost {}

@Component({
  template: `
    <et-nav-tabs>
      <a et-nav-tab-link="/two" queryParamsHandling="preserve">Two</a>
    </et-nav-tabs>
  `,
  imports: [NavTabsComponent, NavTabLinkComponent],
})
class PreservedQueryParamsTestHost {}

describe('NavTabsComponent', () => {
  let fixture: ComponentFixture<NavTabsTestHost>;
  let router: Router;

  const getLinks = () =>
    Array.from(fixture.nativeElement.querySelectorAll('.et-nav-tab-link') as NodeListOf<HTMLAnchorElement>);

  // jsdom runs no activation behavior: an anchor only turns Enter into a click while it has an href.
  const pressEnter = (link: HTMLAnchorElement) => {
    link.focus();
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    if (link.hasAttribute('href')) {
      link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    }
  };

  const navigateTo = (url: string) => {
    return router.navigateByUrl(url).then(() => {
      fixture.detectChanges();

      return fixture.whenStable().then(() => {
        fixture.detectChanges();
      });
    });
  };

  beforeEach(() => {
    fakeResizeObserver();
    fakeIntersectionObserver();
    fakeElementScroll();

    TestBed.configureTestingModule({
      imports: [
        NavTabsRouteOneComponent,
        NavTabsRouteTwoComponent,
        NavTabsTestHost,
        SiblingOutletTestHost,
        PreservedQueryParamsTestHost,
      ],
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

  it('owns its tabs from the tablist', async () => {
    await navigateTo('/one');

    expectAriaTablist(fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement);
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

  it('does not navigate on Space from a disabled link', async () => {
    fixture.componentInstance.secondDisabled = true;
    fixture.detectChanges();
    await navigateTo('/one');

    const [, secondLink] = getLinks();

    secondLink?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/one');
  });

  it('drops the href from a disabled link', async () => {
    fixture.componentInstance.secondDisabled = true;
    fixture.detectChanges();
    await navigateTo('/one');

    const [firstLink, secondLink] = getLinks();

    expect(firstLink?.getAttribute('href')).toBe('/one');
    expect(secondLink?.hasAttribute('href')).toBe(false);
    expect(secondLink?.getAttribute('aria-disabled')).toBe('true');
  });

  it('keeps the href of an enabled link up to date', async () => {
    fixture.destroy();

    const preservedFixture = TestBed.createComponent(PreservedQueryParamsTestHost);

    await router.navigateByUrl('/one?page=1');
    preservedFixture.detectChanges();
    await preservedFixture.whenStable();
    preservedFixture.detectChanges();

    const link = preservedFixture.nativeElement.querySelector('.et-nav-tab-link') as HTMLAnchorElement;

    expect(link.getAttribute('href')).toBe('/two?page=1');

    await router.navigateByUrl('/one?page=2');
    preservedFixture.detectChanges();
    await preservedFixture.whenStable();
    preservedFixture.detectChanges();

    expect(link.getAttribute('href')).toBe('/two?page=2');

    preservedFixture.destroy();
  });

  it('does not navigate when a disabled link is activated with Enter', async () => {
    fixture.componentInstance.secondDisabled = true;
    fixture.detectChanges();
    await navigateTo('/one');

    const [, secondLink] = getLinks();

    if (secondLink) {
      pressEnter(secondLink);
    }

    fixture.detectChanges();
    await fixture.whenStable();

    expect(router.url).toBe('/one');
  });

  it('labels an outlet placed as a sibling of the nav tabs with the active link', async () => {
    fixture.destroy();

    const siblingFixture = TestBed.createComponent(SiblingOutletTestHost);

    await router.navigateByUrl('/one');
    siblingFixture.detectChanges();
    await siblingFixture.whenStable();
    siblingFixture.detectChanges();

    const hostElement = siblingFixture.nativeElement as HTMLElement;
    const firstLink = hostElement.querySelector('.et-nav-tab-link');
    const outlet = hostElement.querySelector('et-nav-tabs-outlet');

    expect(outlet?.getAttribute('aria-labelledby')).toBe(firstLink?.id ?? null);
    expect(hostElement.textContent).toContain('Route one');

    siblingFixture.destroy();
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
