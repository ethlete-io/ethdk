import { Component, ErrorHandler } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import '../../test-helpers';
import { TabBarTriggerDirective } from './headless/tab-bar-trigger.directive';
import { TabBarDirective } from './headless/tab-bar.directive';
import { NavTabsOutletDirective } from './nav-tabs/headless/nav-tabs-outlet.directive';
import { TabGroupDirective } from './tabs/headless/tab-group.directive';
import { TabPanelDirective } from './tabs/headless/tab-panel.directive';
import { TabComponent } from './tabs/tab.component';

@Component({
  imports: [TabBarTriggerDirective],
  template: `<button etTabBarTrigger>Orphan</button>`,
})
class OrphanTriggerHost {}

@Component({
  imports: [TabPanelDirective],
  template: `<div etTabPanel>Orphan</div>`,
})
class OrphanPanelHost {}

@Component({
  imports: [TabComponent],
  template: `<et-tab label="Orphan">content</et-tab>`,
})
class OrphanTabHost {}

@Component({
  imports: [TabBarDirective, TabGroupDirective, TabBarTriggerDirective],
  template: `
    <div etTabBar etTabGroup>
      <button etTabBarTrigger>One</button>
    </div>
  `,
})
class TriggersWithoutPanelsHost {}

@Component({
  imports: [NavTabsOutletDirective],
  template: `<div etNavTabsOutlet></div>`,
})
class OrphanOutletHost {}

describe('tab structural dev errors', () => {
  const expectDevError = (hostType: unknown, code: number) => {
    const handleError = vi.fn();

    TestBed.configureTestingModule({ providers: [{ provide: ErrorHandler, useValue: { handleError } }] });

    const fixture = TestBed.createComponent(hostType as never);

    fixture.detectChanges();

    const messages = handleError.mock.calls.map(([error]) => (error as Error).message ?? String(error));

    expect(messages.some((message) => message.includes(`ET${code}`))).toBe(true);
  };

  it('throws MISSING_TAB_BAR for a trigger outside a tab bar', () => {
    expectDevError(OrphanTriggerHost, 2000);
  });

  it('throws MISSING_TAB_GROUP for a panel outside a tab group', () => {
    expectDevError(OrphanPanelHost, 2001);
  });

  it('throws MISSING_TAB_GROUP for an et-tab outside et-tab-group', () => {
    expectDevError(OrphanTabHost, 2001);
  });

  it('throws MISSING_TAB_PANEL for a headless tab group with triggers but no panels', () => {
    expectDevError(TriggersWithoutPanelsHost, 2002);
  });

  it('throws MISSING_NAV_TABS for an outlet without any nav tabs', () => {
    expectDevError(OrphanOutletHost, 2003);
  });
});
