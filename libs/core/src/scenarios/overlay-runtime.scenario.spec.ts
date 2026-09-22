import { Component } from '@angular/core';
import {
  AnimatedLifecycleDirective,
  injectOverlayRuntime,
  OverlayRuntimeCloseEvent,
  OverlayRuntimeRef,
  provideOverlayRuntime,
} from '../index';
import { Scenario, useScenario } from './harness';

@Component({
  selector: 'et-scenario-dialog',
  template: '<button type="button">inside</button>',
  hostDirectives: [AnimatedLifecycleDirective],
})
class ScenarioDialogComponent {}

const rootsInDocument = () => Array.from(document.querySelectorAll('.et-overlay-runtime-root'));

const track = (ref: OverlayRuntimeRef) => {
  const events: string[] = [];
  const closed: OverlayRuntimeCloseEvent<unknown>[] = [];

  ref.beforeClosed().subscribe((event) => events.push(`${ref.id}:beforeClosed:${event.source}`));
  ref.afterClosed().subscribe((event) => {
    events.push(`${ref.id}:afterClosed:${event.source}`);
    closed.push(event);
  });

  return { events, closed };
};

const mountDialog = (s: Scenario, id: string, run: <T>(fn: () => T) => T = s.run) =>
  run(() => injectOverlayRuntime().mount({ id, component: ScenarioDialogComponent, autoFocus: false }));

const open = (s: Scenario, id: string, run?: <T>(fn: () => T) => T) => {
  const ref = mountDialog(s, id, run);

  s.flush();
  expect(ref.state()).toBe('mounted');

  return ref;
};

describe('overlay runtime scenarios', () => {
  const scenario = useScenario();

  it('plays the leave animation before it tears an opened overlay down', () => {
    const s = scenario();
    const ref = mountDialog(s, 'dialog');
    const { events } = track(ref);

    s.frame(2);
    expect(ref.elements.paneElement.classList).toContain('et-animation-enter-active');

    s.flush();
    expect(ref.state()).toBe('mounted');
    expect(ref.elements.paneElement.classList).toContain('et-animation-enter-done');
    expect(s.pendingFrames()).toBe(0);

    ref.close('done');

    expect(ref.state()).toBe('closing');
    expect(events).toEqual(['dialog:beforeClosed:api']);

    s.frame();
    expect(ref.elements.paneElement.classList).toContain('et-animation-leave-active');
    expect(ref.elements.hostElement.isConnected).toBe(true);

    s.flush();
    expect(ref.state()).toBe('closed');
    expect(ref.elements.hostElement.isConnected).toBe(false);
    expect(rootsInDocument()).toEqual([]);
    expect(events).toEqual(['dialog:beforeClosed:api', 'dialog:afterClosed:api']);
  });

  it('closes two stacked overlays with two fast Escapes, topmost first', () => {
    const s = scenario();
    const bottom = open(s, 'bottom');
    const top = open(s, 'top');
    const bottomLog = track(bottom);
    const topLog = track(top);

    const first = s.keydown('Escape');

    expect(first.defaultPrevented).toBe(true);
    expect(top.state()).toBe('closing');
    expect(bottom.state()).toBe('mounted');

    const second = s.keydown('Escape');

    expect(second.defaultPrevented).toBe(true);
    expect(bottom.state()).toBe('closing');

    s.flush();

    expect(topLog.closed.map((event) => event.source)).toEqual(['escape']);
    expect(bottomLog.closed.map((event) => event.source)).toEqual(['escape']);
    expect(rootsInDocument()).toEqual([]);
  });

  it('lets an Escape during the leave animation pass through untouched', () => {
    const s = scenario();
    const ref = open(s, 'dialog');
    const { closed } = track(ref);

    ref.close('done');
    s.frame();

    const escape = s.keydown('Escape');

    expect(escape.defaultPrevented).toBe(false);
    expect(ref.state()).toBe('closing');

    s.flush();

    expect(closed).toEqual([{ result: 'done', source: 'api' }]);
  });

  it('keeps each runtime to its own root when two runtimes share the app', () => {
    const s = scenario();
    const scoped = s.consumer([provideOverlayRuntime()]);
    const rootRef = open(s, 'root-runtime');
    const scopedRef = open(s, 'scoped-runtime', scoped.run);

    expect(rootRef.elements.rootElement).not.toBe(scopedRef.elements.rootElement);
    expect(rootsInDocument()).toHaveLength(2);

    scopedRef.close();
    s.flush();

    expect(rootRef.elements.rootElement.isConnected).toBe(true);
    expect(rootRef.elements.hostElement.isConnected).toBe(true);

    rootRef.close();
    s.flush();
    scoped.destroy();
  });

  it('keeps another app on the same document intact through its own mount and teardown', async () => {
    const s = scenario();
    const first = open(s, 'first-app');
    const second = await s.app();
    const secondRef = open(s, 'second-app', second.run);
    const secondLog = track(secondRef);

    expect(first.elements.rootElement.isConnected).toBe(true);
    expect(first.elements.hostElement.isConnected).toBe(true);
    expect(rootsInDocument()).toHaveLength(2);

    second.destroy();

    expect(secondLog.events).toEqual(['second-app:beforeClosed:api', 'second-app:afterClosed:api']);
    expect(secondRef.elements.rootElement.isConnected).toBe(false);
    expect(first.elements.rootElement.isConnected).toBe(true);
    expect(first.elements.hostElement.isConnected).toBe(true);

    s.keydown('Escape');
    s.flush();

    expect(first.state()).toBe('closed');
    expect(rootsInDocument()).toEqual([]);
  });
});
