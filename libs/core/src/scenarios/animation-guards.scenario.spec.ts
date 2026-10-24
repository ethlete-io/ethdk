import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { createCanAnimateSignal, matchesReducedMotion } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-can-animate',
  template: '',
  host: { '[attr.data-can-animate]': 'canAnimate.state() || null' },
})
class CanAnimateHostComponent {
  public canAnimate = createCanAnimateSignal();
}

describe('animation guard scenarios', () => {
  const scenario = useScenario();

  it('turns on two frames after creation', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CanAnimateHostComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.tick();
    expect(host.hasAttribute('data-can-animate')).toBe(false);

    s.frame(2);
    expect(host.hasAttribute('data-can-animate')).toBe(true);
  });

  it('cancels its pending frame when the host is destroyed first', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(CanAnimateHostComponent);

    s.tick();
    expect(s.pendingFrames()).toBeGreaterThan(0);

    fixture.destroy();
    expect(s.pendingFrames()).toBe(0);
  });

  it('reads no reduced-motion preference from a window without matchMedia', () => {
    scenario();
    const element = document.createElement('div');

    expect(typeof window.matchMedia).toBe('undefined');
    expect(matchesReducedMotion(element)).toBe(false);
  });
});
