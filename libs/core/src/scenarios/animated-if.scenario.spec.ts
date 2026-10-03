import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AnimatedIfDirective, AnimatedLifecycleDirective } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-animated-if',
  imports: [AnimatedLifecycleDirective, AnimatedIfDirective],
  template: `
    @if (mounted()) {
      <div etAnimatedLifecycle>
        <span *etAnimatedIf="value() as v" class="content">{{ v }}</span>
      </div>
    }
  `,
})
class AnimatedIfHostComponent {
  lifecycle = viewChild(AnimatedLifecycleDirective);
  mounted = signal(true);
  value = signal<string | null>(null);
}

describe('animated if scenarios', () => {
  const scenario = useScenario();

  const setup = () => {
    const s = scenario();
    const fixture = TestBed.createComponent(AnimatedIfHostComponent);
    const host = fixture.nativeElement as HTMLElement;

    s.flush();

    return { s, fixture, host, content: () => host.querySelector('.content') };
  };

  it('renders on enter and removes the view only once the leave has settled', () => {
    const { s, fixture, host, content } = setup();

    fixture.componentInstance.value.set('a');
    s.flush();

    expect(content()?.textContent).toBe('a');
    expect(fixture.componentInstance.lifecycle()?.state()).toBe('entered');

    fixture.componentInstance.value.set(null);
    s.tick();

    expect(fixture.componentInstance.lifecycle()?.state()).toBe('leaving');
    expect(content()).not.toBeNull();

    s.flush();

    expect(fixture.componentInstance.lifecycle()?.state()).toBe('left');
    expect(content()).toBeNull();
    expect(host.querySelector('[etanimatedlifecycle]')).not.toBeNull();
    fixture.destroy();
  });

  it('keeps the view when the value comes back mid-leave and shows the new value', () => {
    const { s, fixture, content } = setup();

    fixture.componentInstance.value.set('a');
    s.flush();
    fixture.componentInstance.value.set(null);
    s.tick();
    s.frame();
    fixture.componentInstance.value.set('b');
    s.flush();

    expect(fixture.componentInstance.lifecycle()?.state()).toBe('entered');
    expect(content()?.textContent).toBe('b');
    fixture.destroy();
  });

  it('leaves nothing behind when destroyed mid-enter or mid-leave', () => {
    const { s, fixture } = setup();

    fixture.componentInstance.value.set('a');
    s.tick();
    s.frame();
    expect(fixture.componentInstance.lifecycle()?.state()).toBe('entering');

    fixture.componentInstance.mounted.set(false);
    s.tick();

    fixture.componentInstance.mounted.set(true);
    s.flush();
    fixture.componentInstance.value.set('b');
    s.flush();
    fixture.componentInstance.value.set(null);
    s.tick();
    s.frame();
    expect(fixture.componentInstance.lifecycle()?.state()).toBe('leaving');

    fixture.destroy();
  });

  it('cancels the forced-frame reset when destroyed right after a forced state', () => {
    const { s, fixture } = setup();

    fixture.componentInstance.value.set('a');
    s.flush();
    fixture.componentInstance.lifecycle()?.forceLeftState();

    fixture.destroy();
  });
});
