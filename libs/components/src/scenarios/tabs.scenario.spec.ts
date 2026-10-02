import { Component, inject, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  TAB_BAR_FITS,
  TAB_BAR_ORIENTATIONS,
  TAB_BAR_TOKEN,
  TAB_BAR_TRIGGER_TOKEN,
  TAB_BAR_VARIANTS,
  TAB_ERROR_CODES,
  TAB_GROUP_TOKEN,
  TAB_IMPORTS,
  TAB_PANEL_TOKEN,
  TAB_SIZES,
  TabBarDirective,
  TabBarTriggerDirective,
  TabBarUnderlineDirective,
  TabComponent,
  TabGroupComponent,
  TabGroupDirective,
  TabLabelDirective,
  TabPanelDirective,
  TabTriggerDirective,
} from '../index';
import { fakeElementScroll } from '../lib/testing/fake-layout';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-remembered-tabs',
  imports: [TAB_IMPORTS],
  template: `
    <et-tab-group (selectedIndexChange)="selected.set($event)" sessionMemoryKey="account">
      <et-tab label="Profile">Profile body</et-tab>
      <et-tab label="Billing">Billing body</et-tab>
      <et-tab label="Security">Security body</et-tab>
      <et-tab label="Danger zone">Danger body</et-tab>
    </et-tab-group>
  `,
})
class RememberedTabsComponent {
  selected = signal(0);
}

@Component({
  selector: 'et-scenario-account-tabs',
  imports: [TAB_IMPORTS],
  template: `
    <et-tab-group
      [(selectedIndex)]="selected"
      [preserveContent]="preserve()"
      [orientation]="orientation()"
      [fit]="fit()"
      [variant]="variant()"
      [size]="size()"
      [sessionMemoryKey]="memoryKey()"
    >
      <et-tab label="Profile"><p class="profile-body">Profile body</p></et-tab>
      <et-tab [disabled]="billingLocked()" label="Billing"><p class="billing-body">Billing body</p></et-tab>
      <et-tab>
        <ng-template etTabLabel><strong class="custom-label">Security</strong></ng-template>
        <p class="security-body">Security body</p>
      </et-tab>
      <et-tab label="Danger zone"><p class="danger-body">Danger body</p></et-tab>
    </et-tab-group>
    <button class="after" type="button">After</button>
  `,
})
class AccountTabsComponent {
  selected = signal(0);
  preserve = signal(true);
  billingLocked = signal(false);
  orientation = signal<'horizontal' | 'vertical'>(TAB_BAR_ORIENTATIONS.HORIZONTAL);
  fit = signal<'content' | 'fill'>(TAB_BAR_FITS.CONTENT);
  variant = signal<'primary' | 'secondary'>(TAB_BAR_VARIANTS.SECONDARY);
  size = signal<'sm' | 'md' | 'lg'>(TAB_SIZES.MD);
  memoryKey = signal<string | null>('account');
  group = viewChild.required(TabGroupComponent);
  tabs = () => this.group().tabs();
}

@Component({
  selector: 'et-scenario-panel-probe',
  template: '<span class="probe">{{ trigger.ID }}</span>',
})
class TriggerProbeComponent {
  bar = inject(TAB_BAR_TOKEN);
  trigger = inject(TAB_BAR_TRIGGER_TOKEN);
}

@Component({
  selector: 'et-scenario-panel-content',
  template: '<span class="panel-probe">{{ panel.isActive() ? "shown" : "idle" }}</span>',
})
class PanelProbeComponent {
  group = inject(TAB_GROUP_TOKEN);
  panel = inject(TAB_PANEL_TOKEN);
}

@Component({
  selector: 'et-scenario-headless-tabs',
  imports: [
    TabBarDirective,
    TabBarTriggerDirective,
    TabBarUnderlineDirective,
    TabGroupDirective,
    TabTriggerDirective,
    TabPanelDirective,
    TriggerProbeComponent,
    PanelProbeComponent,
  ],
  template: `
    <div [(selectedIndex)]="selected" class="bar" preserveContent="false" etTabBar etTabGroup orientation="vertical">
      @for (section of sections; track section; let i = $index) {
        <button
          [panelId]="'panel-' + section"
          [attr.id]="'trigger-' + section"
          [disabled]="section === 'archive'"
          class="trigger"
          etTabTrigger
          etTabBarTrigger
          type="button"
        >
          {{ section }}<span class="underline" etTabBarUnderline></span>
          <et-scenario-panel-probe />
        </button>
      }
      @for (section of sections; track section) {
        <section [triggerId]="'trigger-' + section" class="panel" etTabPanel>
          <et-scenario-panel-content />
        </section>
      }
    </div>
  `,
})
class HeadlessTabsComponent {
  sections = ['inbox', 'sent', 'archive', 'spam'];
  selected = signal(0);
  bar = viewChild.required(TabBarDirective);
  group = viewChild.required(TabGroupDirective);
  underline = viewChild.required(TabBarUnderlineDirective);
  probe = viewChild.required(TriggerProbeComponent);
}

@Component({
  selector: 'et-scenario-stray-trigger',
  imports: [TabBarTriggerDirective],
  template: '<button etTabBarTrigger type="button">Lost</button>',
})
class StrayTriggerComponent {}

@Component({
  selector: 'et-scenario-stray-tab',
  imports: [TabComponent],
  template: '<et-tab label="Lost">Lost</et-tab>',
})
class StrayTabComponent {}

@Component({
  selector: 'et-scenario-stray-panel',
  imports: [TabPanelDirective],
  template: '<div etTabPanel>Lost</div>',
})
class StrayPanelComponent {}

@Component({
  selector: 'et-scenario-panelless-group',
  imports: [TabBarDirective, TabBarTriggerDirective, TabGroupDirective],
  template: '<div etTabBar etTabGroup><button etTabBarTrigger type="button">One</button></div>',
})
class PanellessGroupComponent {}

const queryAll = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) =>
  Array.from(root.querySelectorAll<E>(selector));

const query = <E extends HTMLElement = HTMLElement>(selector: string, root: ParentNode = document) => {
  const element = root.querySelector<E>(selector);

  if (!element) throw new Error(`no ${selector}`);

  return element;
};

const triggerAt = (index: number, root: ParentNode = document) => {
  const trigger = queryAll<HTMLButtonElement>('[role="tab"]', root)[index];

  if (!trigger) throw new Error(`no trigger ${index}`);

  return trigger;
};

const press = (s: Scenario, key: string) => s.keydown(key, document.activeElement ?? document.body);

const takeRuntimeError = (s: Scenario, code: number) => {
  s.expectError(`ET${code}`);

  const index = s.errors.findIndex((entry) => entry.source === 'console.error' && typeof entry.error === 'object');

  if (index !== -1) s.errors.splice(index, 1);
};

describe('tabs scenarios', () => {
  const scenario = useScenario();

  beforeEach(() => {
    sessionStorage.clear();
    fakeElementScroll();
  });

  it('switches panels by click, reflects the selection in aria and the two-way binding', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AccountTabsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    const tablist = query('[role="tablist"]', host);
    const panels = queryAll('[role="tabpanel"]', host);

    expect(query('et-tab-group', host).getAttribute('role')).toBe('none');
    expect(tablist.getAttribute('aria-orientation')).toBe('horizontal');
    expect(queryAll('[role="tab"]', host).map((tab) => tab.textContent?.trim())).toEqual([
      'Profile',
      'Billing',
      'Security',
      'Danger zone',
    ]);
    expect(query('.custom-label', triggerAt(2, host)).textContent).toBe('Security');
    expect(fixture.componentInstance.tabs()).toHaveLength(4);
    expect(fixture.componentInstance.tabs()[0]).toBeInstanceOf(TabComponent);

    expect(triggerAt(0, host).getAttribute('aria-selected')).toBe('true');
    expect(triggerAt(1, host).getAttribute('aria-selected')).toBe('false');
    expect(triggerAt(0, host).getAttribute('aria-controls')).toBe(panels[0]?.id);
    expect(panels[0]?.getAttribute('aria-labelledby')).toBe(triggerAt(0, host).id);
    expect(panels[0]?.hasAttribute('hidden')).toBe(false);
    expect(panels[1]?.hasAttribute('hidden')).toBe(true);
    expect(panels[1]?.hasAttribute('inert')).toBe(true);

    triggerAt(2, host).click();
    s.tick();

    expect(fixture.componentInstance.selected()).toBe(2);
    expect(triggerAt(2, host).getAttribute('aria-selected')).toBe('true');
    expect(triggerAt(2, host).getAttribute('tabindex')).toBe('0');
    expect(triggerAt(0, host).getAttribute('tabindex')).toBe('-1');
    expect(panels[2]?.hasAttribute('hidden')).toBe(false);
    expect(panels[0]?.hasAttribute('hidden')).toBe(true);

    fixture.componentInstance.selected.set(3);
    s.tick();
    expect(triggerAt(3, host).getAttribute('aria-selected')).toBe('true');
    expect(query('.danger-body', host).closest('[role="tabpanel"]')?.hasAttribute('hidden')).toBe(false);
  });

  it('keeps every panel mounted with preserveContent and only the active one without it', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AccountTabsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    expect(queryAll('.profile-body, .billing-body, .security-body, .danger-body', host)).toHaveLength(4);

    fixture.componentInstance.preserve.set(false);
    s.tick();

    expect(
      queryAll('.profile-body, .billing-body, .security-body, .danger-body', host).map((el) => el.className),
    ).toEqual(['profile-body']);
    expect(queryAll('[role="tabpanel"]', host).some((panel) => panel.hasAttribute('hidden'))).toBe(false);

    triggerAt(1, host).click();
    s.tick();
    expect(queryAll('.profile-body, .billing-body', host).map((el) => el.className)).toEqual(['billing-body']);
  });

  it('moves focus with the arrow keys, Home and End, skips disabled tabs and activates on Enter', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AccountTabsComponent);
    const host = fixture.nativeElement as HTMLElement;

    fixture.componentInstance.billingLocked.set(true);
    s.tick();
    s.flush();

    expect(triggerAt(1, host).disabled).toBe(true);
    expect(triggerAt(1, host).getAttribute('aria-disabled')).toBe('true');

    triggerAt(0, host).focus();
    press(s, 'ArrowRight');
    expect(document.activeElement).toBe(triggerAt(2, host));
    expect(fixture.componentInstance.selected()).toBe(0);

    press(s, 'End');
    expect(document.activeElement).toBe(triggerAt(3, host));

    press(s, 'ArrowRight');
    expect(document.activeElement).toBe(triggerAt(0, host));

    press(s, 'ArrowLeft');
    expect(document.activeElement).toBe(triggerAt(3, host));

    press(s, 'Home');
    expect(document.activeElement).toBe(triggerAt(0, host));

    press(s, 'ArrowDown');
    expect(document.activeElement).toBe(triggerAt(0, host));

    press(s, 'ArrowRight');
    expect(press(s, 'Enter').defaultPrevented).toBe(true);
    s.tick();
    expect(fixture.componentInstance.selected()).toBe(2);

    triggerAt(1, host).click();
    s.tick();
    expect(fixture.componentInstance.selected()).toBe(2);
  });

  it('moves the arrow keys from the trigger that holds focus, not the selected one', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AccountTabsComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    s.flush();

    triggerAt(2, host).focus();
    press(s, 'ArrowRight');
    expect(document.activeElement).toBe(triggerAt(3, host));
    expect(fixture.componentInstance.selected()).toBe(0);

    triggerAt(2, host).focus();
    press(s, 'ArrowLeft');
    expect(document.activeElement).toBe(triggerAt(1, host));
    expect(fixture.componentInstance.selected()).toBe(0);
  });

  it('skips a disabled tab that the binding points at', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AccountTabsComponent);

    fixture.componentInstance.billingLocked.set(true);
    fixture.componentInstance.selected.set(1);
    s.tick();
    s.flush();

    expect(fixture.componentInstance.selected()).toBe(0);

    fixture.componentInstance.selected.set(42);
    s.tick();
    expect(fixture.componentInstance.selected()).toBe(3);
  });

  it('switches to vertical arrow keys and reflects size, fit and variant on the host', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AccountTabsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const group = query('et-tab-group', host);

    fixture.componentInstance.orientation.set(TAB_BAR_ORIENTATIONS.VERTICAL);
    fixture.componentInstance.fit.set(TAB_BAR_FITS.FILL);
    fixture.componentInstance.variant.set(TAB_BAR_VARIANTS.PRIMARY);
    fixture.componentInstance.size.set(TAB_SIZES.LG);
    s.tick();
    s.flush();

    expect(group.dataset).toMatchObject({ orientation: 'vertical', fit: 'fill', variant: 'primary', size: 'lg' });
    expect(query('[role="tablist"]', host).getAttribute('aria-orientation')).toBe('vertical');

    triggerAt(0, host).focus();
    press(s, 'ArrowRight');
    expect(document.activeElement).toBe(triggerAt(0, host));

    press(s, 'ArrowDown');
    expect(document.activeElement).toBe(triggerAt(1, host));

    press(s, 'ArrowUp');
    expect(document.activeElement).toBe(triggerAt(0, host));
  });

  it('remembers the selected tab per session memory key across remounts', () => {
    const s = scenario();
    const first = TestBed.createComponent(RememberedTabsComponent);

    s.tick();
    s.flush();
    triggerAt(3, first.nativeElement as HTMLElement).click();
    s.tick();
    first.destroy();

    expect(sessionStorage.getItem('et-tab-group:account')).toBe('3');

    const second = TestBed.createComponent(RememberedTabsComponent);

    s.tick();
    s.flush();
    expect(second.componentInstance.selected()).toBe(3);
    expect(triggerAt(3, second.nativeElement as HTMLElement).getAttribute('aria-selected')).toBe('true');
  });

  it('wires a headless tab bar, triggers, underline and panels together', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(HeadlessTabsComponent);
    const host = fixture.nativeElement as HTMLElement;
    const app = fixture.componentInstance;

    s.tick();
    s.flush();

    const bar = query('.bar', host);
    const triggers = queryAll<HTMLButtonElement>('.trigger', host);
    const panels = queryAll('.panel', host);

    expect(bar.getAttribute('role')).toBe('tablist');
    expect(bar.getAttribute('aria-orientation')).toBe('vertical');
    expect(triggers[1]?.getAttribute('aria-controls')).toBe('panel-sent');
    expect(panels[1]?.getAttribute('aria-labelledby')).toBe('trigger-sent');
    expect(panels.map((panel) => panel.getAttribute('role'))).toEqual(['tabpanel', 'tabpanel', 'tabpanel', 'tabpanel']);
    expect(panels.map((panel) => panel.hasAttribute('inert'))).toEqual([false, true, true, true]);
    expect(panels.map((panel) => panel.hasAttribute('hidden'))).toEqual([false, false, false, false]);
    expect(queryAll('.panel-probe', host).map((el) => el.textContent)).toEqual(['shown', 'idle', 'idle', 'idle']);

    expect(app.bar().triggers()).toHaveLength(4);
    expect(app.group().tabBar).toBe(app.bar());
    expect(app.probe().bar).toBe(app.bar());
    expect(query('.probe', host).textContent).toBe(app.bar().triggers()[0]?.ID);
    expect(queryAll('.underline', host).map((el) => el.classList.contains('et-tab-bar-underline--active'))).toEqual([
      true,
      false,
      false,
      false,
    ]);
    expect(app.underline().isActive()).toBe(true);

    triggers[0]?.focus();
    press(s, 'ArrowDown');
    expect(document.activeElement).toBe(triggers[1]);
    press(s, 'ArrowDown');
    expect(document.activeElement).toBe(triggers[3]);
    press(s, 'Enter');
    s.tick();

    expect(app.selected()).toBe(3);
    expect(app.bar().activeTrigger()?.getElement()).toBe(triggers[3]);
    expect(queryAll('.underline', host).map((el) => el.classList.contains('et-tab-bar-underline--active'))).toEqual([
      false,
      false,
      false,
      true,
    ]);
    expect(queryAll('.panel-probe', host).map((el) => el.textContent)).toEqual(['idle', 'idle', 'idle', 'shown']);

    app.selected.set(1);
    s.tick();
    expect(triggers[1]?.getAttribute('aria-selected')).toBe('true');
    expect(app.group().panels()[1]?.isActive()).toBe(true);
  });

  it.each([
    [StrayTriggerComponent, TAB_ERROR_CODES.MISSING_TAB_BAR],
    [StrayTabComponent, TAB_ERROR_CODES.MISSING_TAB_GROUP],
    [StrayPanelComponent, TAB_ERROR_CODES.MISSING_TAB_GROUP],
    [PanellessGroupComponent, TAB_ERROR_CODES.MISSING_TAB_PANEL],
  ])('reports a runtime error when %o is used on its own a tab part is used on its own', (component, code) => {
    const s = scenario();

    TestBed.createComponent(component);
    s.tick();
    s.flush();

    takeRuntimeError(s, code);
  });

  it('exposes the label template of a custom tab label', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AccountTabsComponent);

    s.tick();
    s.flush();

    const custom = fixture.componentInstance.tabs()[2]?.customLabel();

    expect(custom).toBeInstanceOf(TabLabelDirective);
    expect(custom?.templateRef).toBeTruthy();
    expect(fixture.componentInstance.tabs()[0]?.customLabel()).toBeUndefined();
  });
});
