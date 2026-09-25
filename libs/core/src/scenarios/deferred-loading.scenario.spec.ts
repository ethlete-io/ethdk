import { Component, PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { signalDeferredLoading } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-busy-panel',
  template: `
    @if (spinner()) {
      <span class="spinner"></span>
    }
  `,
})
class BusyPanelComponent {
  loading = signal(false);
  spinner = signalDeferredLoading(this.loading);
  quickSpinner = signalDeferredLoading(this.loading, { delay: 0, minDuration: 1000 });
}

const mountPanel = () => {
  const fixture = TestBed.createComponent(BusyPanelComponent);
  const host = fixture.nativeElement as HTMLElement;

  return { fixture, panel: fixture.componentInstance, spinnerShown: () => !!host.querySelector('.spinner') };
};

describe('deferred loading scenarios', () => {
  const scenario = useScenario();

  it('never shows the indicator for work that finishes inside the delay', () => {
    const s = scenario();
    const { panel, spinnerShown } = mountPanel();

    s.tick();
    panel.loading.set(true);
    s.tick(150);
    panel.loading.set(false);
    s.tick(1000);

    expect(panel.spinner()).toBe(false);
    expect(spinnerShown()).toBe(false);
  });

  it('shows the indicator after the delay and keeps it for the minimum duration', () => {
    const s = scenario();
    const { panel, spinnerShown } = mountPanel();

    s.tick();
    panel.loading.set(true);
    s.tick(199);

    expect(spinnerShown()).toBe(false);

    s.tick(1);

    expect(spinnerShown()).toBe(true);

    s.tick(50);
    panel.loading.set(false);
    s.tick(249);

    expect(spinnerShown()).toBe(true);

    s.tick(1);

    expect(spinnerShown()).toBe(false);
  });

  it('hides at once when the work outlasted the minimum duration', () => {
    const s = scenario();
    const { panel, spinnerShown } = mountPanel();

    s.tick();
    panel.loading.set(true);
    s.tick(1000);
    panel.loading.set(false);
    s.tick();

    expect(spinnerShown()).toBe(false);
  });

  it('keeps the indicator on when loading restarts inside the minimum duration', () => {
    const s = scenario();
    const { panel } = mountPanel();

    s.tick();
    panel.loading.set(true);
    s.tick(200);
    panel.loading.set(false);
    s.tick(100);
    panel.loading.set(true);
    s.tick(1000);

    expect(panel.spinner()).toBe(true);

    panel.loading.set(false);
    s.tick();

    expect(panel.spinner()).toBe(false);
  });

  it('takes its own delay and minimum duration', () => {
    const s = scenario();
    const { panel } = mountPanel();

    s.tick();
    panel.loading.set(true);
    s.tick();

    expect(panel.quickSpinner()).toBe(true);

    panel.loading.set(false);
    s.tick(999);

    expect(panel.quickSpinner()).toBe(true);

    s.tick(1);

    expect(panel.quickSpinner()).toBe(false);
  });

  it('leaves no timer behind when the component is destroyed mid-delay or mid-hold', () => {
    const s = scenario();
    const waiting = mountPanel();
    const holding = mountPanel();

    s.tick();
    waiting.panel.loading.set(true);
    holding.panel.loading.set(true);
    s.tick(250);
    holding.panel.loading.set(false);
    waiting.panel.loading.set(false);
    waiting.panel.loading.set(true);
    s.tick(100);

    waiting.fixture.destroy();
    holding.fixture.destroy();
  });

  it('never turns on during server rendering', () => {
    const s = scenario();
    const loading = signal(true);
    const spinner = s
      .consumer([{ provide: PLATFORM_ID, useValue: 'server' }])
      .run(() => signalDeferredLoading(loading));

    s.tick(1000);

    expect(spinner()).toBe(false);
  });
});
