import { Component, computed, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  AnimatedIfDirective,
  AnimatedLifecycleDirective,
  ANIMATION_ERROR_CODES,
  injectOverlayRuntime,
  OverlayRuntimeCloseEvent,
  provideOverlayRuntime,
} from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-late-dialog',
  template: 'dialog',
  hostDirectives: [AnimatedLifecycleDirective],
})
class LateDialogComponent {}

@Component({ selector: 'et-scenario-plain-dialog', template: 'plain' })
class PlainDialogComponent {}

@Component({
  selector: 'et-scenario-lifecycle-signal',
  imports: [AnimatedLifecycleDirective],
  template: `<div etAnimatedLifecycle></div>`,
})
class LifecycleSignalHostComponent {
  lifecycle = viewChild.required(AnimatedLifecycleDirective);
  isVisible = computed(() => this.lifecycle().state() !== 'init' && this.lifecycle().state() !== 'left');
}

@Component({
  selector: 'et-scenario-orphan-animated-if',
  imports: [AnimatedIfDirective],
  template: `<p *etAnimatedIf="shown()">orphan</p>`,
})
class OrphanAnimatedIfComponent {
  shown = signal(true);
}

describe('overlay runtime ref and lifecycle scenarios', () => {
  const scenario = useScenario({ providers: [provideOverlayRuntime()] });

  it('replays every lifecycle event to a subscriber that arrives after it', () => {
    const s = scenario();
    const ref = s.run(() =>
      injectOverlayRuntime().mount({ id: 'late', component: LateDialogComponent, autoFocus: false }),
    );
    const seen: string[] = [];

    ref.beforeOpened().subscribe(() => seen.push('beforeOpened'));
    expect(seen).toEqual(['beforeOpened']);

    s.flush();
    expect(ref.state()).toBe('mounted');
    ref.afterOpened().subscribe(() => seen.push('afterOpened'));
    expect(seen).toEqual(['beforeOpened', 'afterOpened']);

    ref.close('done');
    s.flush();
    expect(ref.state()).toBe('closed');

    const closeEvents: OverlayRuntimeCloseEvent<unknown>[] = [];
    ref.beforeClosed().subscribe((event) => closeEvents.push(event));
    ref.afterClosed().subscribe((event) => closeEvents.push(event));

    expect(closeEvents).toEqual([
      { result: 'done', source: 'api' },
      { result: 'done', source: 'api' },
    ]);
  });

  it('replays afterClosed after a synchronous close of an overlay without a lifecycle', () => {
    const s = scenario();
    const ref = s.run(() => injectOverlayRuntime().mount({ id: 'plain', component: PlainDialogComponent }));

    s.flush();
    ref.close('sync');

    const results: unknown[] = [];
    ref.afterClosed().subscribe((event) => results.push(event.result));

    expect(results).toEqual(['sync']);
  });

  it('exposes the lifecycle state as a signal that computed code can read', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LifecycleSignalHostComponent);

    s.flush();
    const host = fixture.componentInstance;
    expect(host.lifecycle().state()).toBe('init');
    expect(host.isVisible()).toBe(false);

    host.lifecycle().enter();
    expect(host.lifecycle().state()).toBe('entering');
    expect(host.isVisible()).toBe(true);

    s.flush();
    expect(host.lifecycle().state()).toBe('entered');
    expect('next' in host.lifecycle().state$).toBe(false);

    host.lifecycle().leave();
    s.flush();
    expect(host.lifecycle().state()).toBe('left');
    expect(host.isVisible()).toBe(false);

    fixture.destroy();
  });

  it('names the missing etAnimatedLifecycle ancestor when *etAnimatedIf has none', () => {
    scenario();

    expect(() => TestBed.createComponent(OrphanAnimatedIfComponent)).toThrow(
      new RegExp(
        `ET${ANIMATION_ERROR_CODES.MISSING_ANIMATED_LIFECYCLE}: \\*etAnimatedIf needs an element with \\[etAnimatedLifecycle\\]`,
      ),
    );
  });
});
