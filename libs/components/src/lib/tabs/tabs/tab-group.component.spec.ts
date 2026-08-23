import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { vi } from 'vitest';
import { expectAriaTablist } from '../../testing/aria-structure';
import { fakeElementScroll, fakeIntersectionObserver, fakeResizeObserver } from '../../testing/fake-layout';
import { TabBarDirective } from '../headless/tab-bar.directive';
import { TabBarTriggerDirective } from '../headless/tab-bar-trigger.directive';
import { TabGroupDirective } from './headless/tab-group.directive';
import { TabPanelDirective } from './headless/tab-panel.directive';
import { TabGroupComponent } from './tab-group.component';
import { TabComponent } from './tab.component';

const SESSION_MEMORY_KEY = 'test-tabs';
const SESSION_MEMORY_STORAGE_KEY = 'et-tab-group:' + SESSION_MEMORY_KEY;

@Component({
  imports: [TabGroupComponent, TabComponent],
  template: `
    <et-tab-group
      [selectedIndex]="selectedIndex"
      [sessionMemoryKey]="sessionMemoryKey"
      (selectedIndexChange)="selectedIndex = $event"
    >
      <et-tab label="First">First content</et-tab>
      <et-tab [disabled]="secondTabDisabled" label="Second">Second content</et-tab>
      <et-tab label="Third">Third content</et-tab>
    </et-tab-group>
  `,
})
class TestHostComponent {
  selectedIndex = 0;
  sessionMemoryKey: string | null = null;
  secondTabDisabled = false;
}

@Component({
  imports: [TabGroupComponent, TabComponent],
  template: `
    <div>
      @for (size of sizes; track size) {
        <div>
          <et-tab-group [size]="size">
            <et-tab label="First">First content</et-tab>
            <et-tab label="Second">Second content</et-tab>
          </et-tab-group>
        </div>
      }
    </div>
  `,
})
class RepeatedTabGroupsHostComponent {
  sizes = ['sm', 'md', 'lg'] as const;
}

describe('TabGroupComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let storageEntries: Map<string, string>;
  let sessionStorageMock: Storage;
  let originalSessionStorageDescriptor: PropertyDescriptor | undefined;

  const getTabGroupDirective = () =>
    fixture.debugElement.query(By.directive(TabGroupDirective)).injector.get(TabGroupDirective);

  const getTriggerButtons = () => {
    const hostElement = fixture.nativeElement as HTMLElement;

    return Array.from(hostElement.querySelectorAll('.et-tab-group__trigger') as NodeListOf<HTMLButtonElement>);
  };

  const getRepeatedTabGroupElements = (repeatedFixture: ComponentFixture<RepeatedTabGroupsHostComponent>) => {
    const hostElement = repeatedFixture.nativeElement as HTMLElement;

    return Array.from(hostElement.querySelectorAll('et-tab-group') as NodeListOf<HTMLElement>);
  };

  beforeEach(() => {
    fakeResizeObserver();
    fakeIntersectionObserver();
    fakeElementScroll();
    originalSessionStorageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    storageEntries = new Map<string, string>();
    sessionStorageMock = {
      get length() {
        return storageEntries.size;
      },
      clear: vi.fn(() => {
        storageEntries.clear();
      }),
      getItem: vi.fn((key: string) => storageEntries.get(key) ?? null),
      key: vi.fn((index: number) => Array.from(storageEntries.keys())[index] ?? null),
      removeItem: vi.fn((key: string) => {
        storageEntries.delete(key);
      }),
      setItem: vi.fn((key: string, value: string) => {
        storageEntries.set(key, value);
      }),
    } as Storage;

    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock,
    });

    TestBed.configureTestingModule({ imports: [RepeatedTabGroupsHostComponent, TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
  });

  afterEach(() => {
    if (originalSessionStorageDescriptor) {
      Object.defineProperty(globalThis, 'sessionStorage', originalSessionStorageDescriptor);

      return;
    }

    Reflect.deleteProperty(globalThis, 'sessionStorage');
  });

  it('owns its triggers from the tablist', () => {
    fixture.detectChanges();

    expectAriaTablist(fixture.nativeElement.querySelector('[role="tablist"]') as HTMLElement);
  });

  it('restores the selected tab from session storage', () => {
    storageEntries.set(SESSION_MEMORY_STORAGE_KEY, '2');
    hostComponent.sessionMemoryKey = SESSION_MEMORY_KEY;

    fixture.detectChanges();

    expect(getTabGroupDirective().selectedIndex()).toBe(2);
    expect(hostComponent.selectedIndex).toBe(2);
  });

  it('persists tab changes to session storage', () => {
    hostComponent.sessionMemoryKey = SESSION_MEMORY_KEY;

    fixture.detectChanges();
    getTriggerButtons()[1]?.click();
    fixture.detectChanges();

    expect(hostComponent.selectedIndex).toBe(1);
    expect(storageEntries.get(SESSION_MEMORY_STORAGE_KEY)).toBe('1');
  });

  it('clamps persisted indices to the available tab range', () => {
    storageEntries.set(SESSION_MEMORY_STORAGE_KEY, '99');
    hostComponent.sessionMemoryKey = SESSION_MEMORY_KEY;

    fixture.detectChanges();

    expect(getTabGroupDirective().selectedIndex()).toBe(2);
    expect(hostComponent.selectedIndex).toBe(2);
  });

  it('does not restore a disabled tab from session memory', () => {
    storageEntries.set(SESSION_MEMORY_STORAGE_KEY, '1');
    hostComponent.secondTabDisabled = true;
    hostComponent.sessionMemoryKey = SESSION_MEMORY_KEY;

    fixture.detectChanges();

    expect(getTabGroupDirective().selectedIndex()).toBe(0);
    expect(hostComponent.selectedIndex).toBe(0);
  });

  it('auto-generates session memory when no key is configured', () => {
    fixture.detectChanges();
    getTriggerButtons()[1]?.click();
    fixture.detectChanges();

    expect(hostComponent.selectedIndex).toBe(1);
    expect(storageEntries.size).toBe(1);
    expect(Array.from(storageEntries.keys())[0]?.startsWith('et-tab-group:tab-group:')).toBe(true);
  });

  it('skips session memory when sessionStorage is unavailable', () => {
    fixture.destroy();

    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('sessionStorage unavailable');
      },
    });

    const unavailableFixture = TestBed.createComponent(TestHostComponent);
    const unavailableHost = unavailableFixture.componentInstance;
    const unavailableElement = unavailableFixture.nativeElement as HTMLElement;

    unavailableFixture.detectChanges();
    (unavailableElement.querySelectorAll('.et-tab-group__trigger') as NodeListOf<HTMLButtonElement>)[1]?.click();
    unavailableFixture.detectChanges();

    expect(unavailableHost.selectedIndex).toBe(1);

    unavailableFixture.destroy();
  });

  it('generates unique session memory keys for repeated tab groups', () => {
    fixture.destroy();
    storageEntries.clear();

    const repeatedFixture = TestBed.createComponent(RepeatedTabGroupsHostComponent);

    repeatedFixture.detectChanges();

    const tabGroups = getRepeatedTabGroupElements(repeatedFixture);
    const secondTabButtons = tabGroups.map(
      (tabGroup) => (tabGroup.querySelectorAll('.et-tab-group__trigger') as NodeListOf<HTMLButtonElement>)[1],
    );

    secondTabButtons.forEach((button) => {
      button!.click();
      repeatedFixture.detectChanges();
    });

    expect(storageEntries.size).toBe(3);
    expect([...storageEntries.values()]).toEqual(['1', '1', '1']);

    repeatedFixture.destroy();
  });

  it('skips trigger transitions on initial render', () => {
    fixture.detectChanges();

    expect(getTriggerButtons().length).toBeGreaterThan(0);
    expect(
      getTriggerButtons().every((button) => button.classList.contains('et-tab-bar-trigger--no-initial-transition')),
    ).toBe(true);
  });

  it('reenables trigger transitions after initial render settles', () => {
    vi.useFakeTimers();

    try {
      fixture.detectChanges();
      vi.runAllTimers();
      fixture.detectChanges();

      expect(getTriggerButtons().length).toBeGreaterThan(0);
      expect(
        getTriggerButtons().every((button) => !button.classList.contains('et-tab-bar-trigger--no-initial-transition')),
      ).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
});

@Component({
  imports: [TabGroupDirective, TabBarDirective, TabBarTriggerDirective, TabPanelDirective],
  template: `
    <div etTabBar etTabGroup>
      @for (label of labels(); track label) {
        <button etTabBarTrigger type="button">{{ label }}</button>
        <div etTabPanel>{{ label }} content</div>
      }
    </div>
  `,
})
class HeadlessTabsHostComponent {
  labels = signal(['First', 'Second', 'Third']);
}

describe('TabBarDirective trigger order', () => {
  it('keeps the triggers in DOM order when a tab is inserted before existing ones', () => {
    const fixture = TestBed.createComponent(HeadlessTabsHostComponent);
    fixture.detectChanges();

    const bar = fixture.debugElement.query(By.directive(TabBarDirective)).injector.get(TabBarDirective);

    fixture.componentInstance.labels.set(['Zeroth', 'First', 'Second', 'Third']);
    fixture.detectChanges();

    expect(bar.triggers().map((trigger) => trigger.getElement().textContent?.trim())).toEqual([
      'Zeroth',
      'First',
      'Second',
      'Third',
    ]);
  });
});

describe('TabPanelDirective registration', () => {
  it('unregisters a panel that is removed from the DOM', () => {
    const fixture = TestBed.createComponent(HeadlessTabsHostComponent);
    fixture.detectChanges();

    const group = fixture.debugElement.query(By.directive(TabGroupDirective)).injector.get(TabGroupDirective);

    expect(group.panels().length).toBe(3);

    fixture.componentInstance.labels.set(['First']);
    fixture.detectChanges();

    expect(group.panels().length).toBe(1);
  });
});
