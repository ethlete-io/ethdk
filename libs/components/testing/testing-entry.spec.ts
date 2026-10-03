import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SELECT_IMPORTS, TabBarDirective, TabBarTriggerDirective } from '@ethlete/components';
import { createSelectDriver } from './select-driver';
import { createTabBarDriver } from './tabs-driver';
import { directiveAt } from './control-driver';
import { focusEvent, resetOverlays } from './driver-core';
import { setupComponentsTestEnvironment } from './test-environment';

@Component({
  template: `
    <et-select [value]="value()" [disabled]="disabled()" (valueChange)="value.set($event)" placeholder="Pick a fruit">
      <et-select-option value="apple">Apple</et-select-option>
      <et-select-option value="banana">Banana</et-select-option>
    </et-select>
  `,
  imports: [SELECT_IMPORTS],
})
class SelectHost {
  value = signal<unknown>(null);
  disabled = signal(false);
}

@Component({
  template: `
    <div etTabBar>
      <button etTabBarTrigger type="button">One</button>
      <button [disabled]="disabled()" etTabBarTrigger type="button">Two</button>
      <button etTabBarTrigger type="button">Three</button>
    </div>
  `,
  imports: [TabBarDirective, TabBarTriggerDirective],
})
class TabsHost {
  disabled = signal(false);
}

const mount = <T>(type: new () => T) => {
  const fixture = TestBed.createComponent(type);

  fixture.autoDetectChanges();

  return fixture;
};

describe('setupComponentsTestEnvironment', () => {
  it('is idempotent and keeps the fakes installed by the first call', () => {
    setupComponentsTestEnvironment();

    const installed = [globalThis.ResizeObserver, globalThis.IntersectionObserver, globalThis.matchMedia];
    const animate = Reflect.get(Element.prototype, 'animate');

    setupComponentsTestEnvironment();

    expect([globalThis.ResizeObserver, globalThis.IntersectionObserver, globalThis.matchMedia]).toEqual(installed);
    expect(Reflect.get(Element.prototype, 'animate')).toBe(animate);
  });

  it('leaves an API the consumer already installed alone', () => {
    const original = globalThis.matchMedia;
    const own = vi.fn();

    globalThis.matchMedia = own;

    try {
      setupComponentsTestEnvironment();

      expect(globalThis.matchMedia).toBe(own);
    } finally {
      globalThis.matchMedia = original;
    }
  });

  it('settles an animation exactly once', async () => {
    setupComponentsTestEnvironment();

    const animation = document.createElement('div').animate([], 100);
    const onfinish = vi.fn();
    const oncancel = vi.fn();

    animation.onfinish = onfinish;
    animation.oncancel = oncancel;
    animation.cancel();
    await Promise.resolve();

    expect(oncancel).toHaveBeenCalledTimes(1);
    expect(onfinish).not.toHaveBeenCalled();
    expect(animation.playState).toBe('idle');
  });

  it('reports no media query as matching', () => {
    setupComponentsTestEnvironment();

    expect(globalThis.matchMedia('(min-width: 1px)')).toMatchObject({ matches: false, media: '(min-width: 1px)' });
  });
});

describe('createSelectDriver', () => {
  afterEach(() => resetOverlays());

  it('opens, selects, clears and respects disabled', async () => {
    const driver = createSelectDriver(mount(SelectHost));

    await driver.open();

    expect(driver.select.open()).toBe(true);
    expect(driver.optionLabels()).toEqual(['Apple', 'Banana']);

    driver.clickOptionByLabel('Banana');
    await driver.settle();

    expect(driver.host.value()).toBe('banana');
    expect(driver.valueText()).toBe('Banana');

    focusEvent(driver.trigger(), 'focus');
    driver.click(driver.query('.et-input-clear')!);

    expect(driver.host.value()).toBeNull();

    driver.closeAndRemovePanes();
    driver.host.disabled.set(true);
    driver.detectChanges();
    await driver.open();

    expect(driver.select.open()).toBe(false);
    expect(driver.pane()).toBeNull();
    expect(driver.trigger().getAttribute('aria-disabled')).toBe('true');
  });
});

describe('createTabBarDriver', () => {
  it('selects a tab by keyboard and skips a disabled one', () => {
    const fixture = mount(TabsHost);

    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    const driver = createTabBarDriver(fixture);

    driver.focusTabbable();
    driver.press('ArrowRight');

    expect(driver.focusedIndex()).toBe(2);
    expect(document.activeElement).toBe(driver.trigger(2));
    expect(() => driver.trigger(3)).toThrow('No tab trigger at index 3');
  });
});

describe('directiveAt', () => {
  it('names the selector when nothing matches it', () => {
    const fixture = mount(TabsHost);

    expect(() => directiveAt(fixture, TabBarDirective, '.missing')).toThrow('.missing');
  });
});
