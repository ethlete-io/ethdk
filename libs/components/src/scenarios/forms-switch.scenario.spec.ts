import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import { SwitchComponent, SwitchDirective } from '../index';
import { TEST_COLOR_THEMES } from '../lib/testing/color-themes';
import '../test-helpers';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-bulk-alerts',
  imports: [SwitchComponent],
  template: `
    <et-switch
      [(checked)]="alerts"
      [(indeterminate)]="mixed"
      [readonly]="readonly()"
      [disabled]="disabled()"
      aria-label="Match alerts"
    />
  `,
})
class BulkAlertsComponent {
  alerts = signal(false);
  mixed = signal(true);
  readonly = signal(false);
  disabled = signal(false);
  toggle = viewChild.required(SwitchComponent);
}

@Component({
  selector: 'et-scenario-custom-switch',
  imports: [SwitchDirective],
  template: `<button [(checked)]="dark" etSwitch type="button" aria-label="Dark mode">Dark</button>`,
})
class CustomSwitchComponent {
  dark = signal(true);
  toggle = viewChild.required(SwitchDirective);
}

describe('switch scenarios', () => {
  const scenario = useScenario({ providers: [provideColorThemes([...TEST_COLOR_THEMES])] });

  it('resolves a bulk-edit mixed switch on the first toggle and keeps aria-checked boolean', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(BulkAlertsComponent);
    const app = fixture.componentInstance;
    const toggle = (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('et-switch')!;

    s.tick();

    expect(toggle.getAttribute('role')).toBe('switch');
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(toggle.getAttribute('data-indeterminate')).toBe('true');

    s.keydown(' ', toggle);
    s.tick();

    expect(app.mixed()).toBe(false);
    expect(app.alerts()).toBe(true);
    expect(toggle.hasAttribute('data-indeterminate')).toBe(false);

    toggle.click();
    s.tick();

    expect(app.alerts()).toBe(false);

    app.readonly.set(true);
    s.tick();
    toggle.click();
    s.tick();

    expect(app.alerts()).toBe(false);
    expect(toggle.getAttribute('aria-readonly')).toBe('true');

    app.toggle().focus();
    expect(document.activeElement).toBe(toggle);

    app.disabled.set(true);
    s.tick();

    expect(toggle.getAttribute('tabindex')).toBe('-1');
    expect(toggle.getAttribute('aria-disabled')).toBe('true');
    s.flush();
  });

  it('turns a native button into a switch with the headless directive', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CustomSwitchComponent);
    const app = fixture.componentInstance;
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    s.tick();

    expect(button.getAttribute('role')).toBe('switch');
    expect(button.getAttribute('aria-checked')).toBe('true');

    app.toggle().activate();
    s.tick();

    expect(app.dark()).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-checked')).toBe('false');
  });
});
