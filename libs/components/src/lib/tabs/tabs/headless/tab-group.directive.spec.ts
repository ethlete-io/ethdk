import { Component, signal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { mountControl } from '../../../testing/control-driver';
import { TabBarTriggerDirective } from '../../headless/tab-bar-trigger.directive';
import { TabBarDirective } from '../../headless/tab-bar.directive';
import { TabGroupDirective } from './tab-group.directive';
import { TabPanelDirective } from './tab-panel.directive';

@Component({
  imports: [TabBarDirective, TabBarTriggerDirective, TabGroupDirective, TabPanelDirective],
  template: `
    <div [(selectedIndex)]="selectedIndex" [sessionMemoryKey]="sessionMemoryKey()" etTabBar etTabGroup>
      @for (label of labels; track label) {
        <button etTabBarTrigger type="button">{{ label }}</button>
      }
      @for (label of labels; track label) {
        <div etTabPanel>{{ label }}</div>
      }
    </div>
  `,
})
class TabGroupWriteCountHost {
  labels = ['One', 'Two', 'Three'];
  selectedIndex = signal(0);
  sessionMemoryKey = signal<string | null>('write-count-a');
}

/**
 * Counts the writes the directive's four `!==`-guarded effects make. Asserting the settled value
 * cannot tell a guarded mirror pair from an unguarded one - both settle - so every case counts.
 */
const countWrites = (group: TabGroupDirective) => {
  const counts = { group: 0, bar: 0 };
  const setGroupIndex = group.selectedIndex.set;
  const setBarIndex = group.tabBar.selectedIndex.set;

  group.selectedIndex.set = (value: number) => {
    counts.group++;
    setGroupIndex(value);
  };

  group.tabBar.selectedIndex.set = (value: number) => {
    counts.bar++;
    setBarIndex(value);
  };

  return counts;
};

const mount = () => {
  sessionStorage.clear();

  const fixture = mountControl(TabGroupWriteCountHost);

  fixture.detectChanges();

  const group = fixture.debugElement.query(By.directive(TabGroupDirective)).injector.get(TabGroupDirective);
  const triggers = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>);

  return { fixture, group, triggers, counts: countWrites(group) };
};

describe('TabGroupDirective selection mirroring', () => {
  it('writes the tab bar once and never writes back when the host moves the selection', () => {
    const { fixture, group, counts } = mount();

    fixture.componentInstance.selectedIndex.set(2);
    fixture.detectChanges();

    expect(group.tabBar.selectedIndex()).toBe(2);
    expect(counts.bar).toBe(1);
    expect(counts.group).toBe(0);
  });

  it('writes the group once and never writes back when a trigger moves the selection', () => {
    const { fixture, group, triggers, counts } = mount();

    triggers[2]?.click();
    fixture.detectChanges();

    expect(group.selectedIndex()).toBe(2);
    expect(counts.bar).toBe(1);
    expect(counts.group).toBe(1);
  });

  it('writes nothing when restoring a session-memory key that agrees with the current selection', () => {
    const { fixture, group, counts } = mount();

    fixture.componentInstance.sessionMemoryKey.set('write-count-b');
    fixture.detectChanges();

    expect(group.restoredSessionMemoryKey()).toBe('write-count-b');
    expect(counts.bar).toBe(0);
    expect(counts.group).toBe(0);
  });
});
