import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import '../../test-helpers';
import { fakeElementScroll, fakeIntersectionObserver, fakeResizeObserver } from '../testing/fake-layout';
import {
  ScrollableButtonsConfig,
  ScrollableButtonsDirective,
} from '../scrollable/headless/scrollable-buttons.directive';
import { provideScrollableConfig } from '../scrollable/headless/scrollable-config';
import { NavTabLinkComponent } from './nav-tabs/nav-tab-link.component';
import { NavTabsComponent } from './nav-tabs/nav-tabs.component';
import { TabGroupComponent } from './tabs/tab-group.component';
import { TabComponent } from './tabs/tab.component';

@Component({
  template: `
    <et-tab-group [scrollableButtons]="value()">
      <et-tab label="One">One</et-tab>
    </et-tab-group>
    <et-nav-tabs [scrollableButtons]="value()">
      <a et-nav-tab-link="/one">One</a>
    </et-nav-tabs>
  `,
  imports: [TabGroupComponent, TabComponent, NavTabsComponent, NavTabLinkComponent],
})
class HostComponent {
  value = signal<boolean | ScrollableButtonsConfig | undefined>(undefined);
}

const setup = (providers: ReturnType<typeof provideScrollableConfig> = []) => {
  fakeResizeObserver();
  fakeIntersectionObserver();
  fakeElementScroll();
  TestBed.configureTestingModule({ providers: [provideRouter([]), providers] });
  const fixture = TestBed.createComponent(HostComponent);
  fixture.detectChanges();

  const enabled = () =>
    fixture.debugElement
      .queryAll(By.directive(ScrollableButtonsDirective))
      .map((el) => el.injector.get(ScrollableButtonsDirective).enabled());

  return {
    enabled,
    set: (value: boolean | ScrollableButtonsConfig | undefined) => {
      fixture.componentInstance.value.set(value);
      fixture.detectChanges();
    },
  };
};

describe('scrollableButtons on tab bars', () => {
  it('shows the buttons by default', () => {
    expect(setup().enabled()).toEqual([true, true]);
  });

  it('hides them for false', () => {
    const t = setup();

    t.set(false);

    expect(t.enabled()).toEqual([false, false]);
  });

  it('resolves a breakpoint map against the current breakpoint', () => {
    const t = setup();

    t.set({ enabled: { '2xl': true } });
    expect(t.enabled()).toEqual([false, false]);

    t.set({ enabled: { xs: true } });
    expect(t.enabled()).toEqual([true, true]);
  });

  it('wins over provideScrollableConfig in both directions', () => {
    const off = setup(provideScrollableConfig({ buttons: { enabled: false } }));

    expect(off.enabled()).toEqual([false, false]);
    off.set(true);
    expect(off.enabled()).toEqual([true, true]);
  });

  it('can switch a provided-on config off', () => {
    const on = setup(provideScrollableConfig({ buttons: { enabled: true } }));

    on.set(false);

    expect(on.enabled()).toEqual([false, false]);
  });
});
