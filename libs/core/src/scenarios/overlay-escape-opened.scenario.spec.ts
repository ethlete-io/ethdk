import { Component } from '@angular/core';
import { injectOverlayRuntime, OverlayRuntimeRef } from '../index';
import { useScenario } from './harness';

@Component({ selector: 'et-scenario-escape-dialog', template: '<button type="button">inside</button>' })
class ScenarioEscapeDialogComponent {}

describe('overlay opened from an Escape keydown', () => {
  const scenario = useScenario();

  it.each([
    ['a body bubble listener', () => document.body, false],
    ['a document capture listener', () => document, true],
  ] as const)('stays open when %s opens it, and the next Escape closes it', (_, target, capture) => {
    const s = scenario();
    const overlay = s.run(() => injectOverlayRuntime());
    let ref: OverlayRuntimeRef | null = null;

    const opener = (event: Event) => {
      if ((event as KeyboardEvent).key !== 'Escape' || ref) return;

      ref = overlay.mount({ id: 'opened-by-escape', component: ScenarioEscapeDialogComponent, autoFocus: false });
    };

    target().addEventListener('keydown', opener, capture);

    const opening = s.keydown('Escape');
    s.flush();

    target().removeEventListener('keydown', opener, capture);

    const opened = ref as OverlayRuntimeRef | null;

    expect(opened?.state()).toBe('mounted');
    expect(opening.defaultPrevented).toBe(false);

    const closing = s.keydown('Escape');
    s.flush();

    expect(closing.defaultPrevented).toBe(true);
    expect(opened?.state()).toBe('closed');
  });
});
