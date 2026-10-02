import { Component, Directive } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { injectOverlayManager } from './overlay-manager';
import { OverlayRef } from './overlay-ref';
import { markOverlayScrollBlockerActive, warnIfOverlayScrollBlockerMissing } from './overlay-scroll-blocker-registry';

@Component({ template: 'overlay content' })
class PlainOverlayComponent {}

describe('overlay manager without provideOverlay', () => {
  it('warns once that the modal scroll lock is missing', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    TestBed.configureTestingModule({});

    const manager = TestBed.runInInjectionContext(() => injectOverlayManager());
    const first = manager.open(PlainOverlayComponent);
    const second = manager.open(PlainOverlayComponent);
    TestBed.tick();

    const scrollWarnings = warn.mock.calls.filter(([message]) => String(message).includes('provideOverlay()'));

    first.close();
    second.close();
    warn.mockRestore();

    expect(scrollWarnings).toHaveLength(1);
  });
});

describe('overlay scroll blocker registry', () => {
  it('stays silent for a document whose scroll blocker is active', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const target = document.implementation.createHTMLDocument();

    markOverlayScrollBlockerActive(target);
    warnIfOverlayScrollBlockerMissing(target);

    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('overlay manager plain open', () => {
  let ref: OverlayRef<PlainOverlayComponent> | null = null;
  let button: HTMLButtonElement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    button = document.createElement('button');
    button.appendChild(document.createElement('span'));
    document.body.appendChild(button);
  });

  afterEach(() => {
    ref?.close();
    ref = null;
    button.remove();
  });

  const open = (origin?: Element | Event | null) => {
    ref = TestBed.runInInjectionContext(() => injectOverlayManager().open(PlainOverlayComponent, { origin }));
    TestBed.tick();

    return ref;
  };

  const isCentered = (overlayRef: OverlayRef<PlainOverlayComponent>) =>
    overlayRef.elements?.hostElement.style.placeItems !== '';

  it('anchors to an element origin', () => {
    expect(isCentered(open(button))).toBe(false);
  });

  it('anchors to the clickable element behind an event origin', () => {
    const click = new MouseEvent('click', { bubbles: true });

    button.firstElementChild?.dispatchEvent(click);

    expect(isCentered(open(click))).toBe(false);
  });

  it('centers without an origin', () => {
    expect(isCentered(open())).toBe(true);
  });

  it('throws ET1211 for directives without strategies', () => {
    @Directive({ selector: '[etOv04Probe]' })
    class ProbeDirective {}

    expect(() =>
      TestBed.runInInjectionContext(() =>
        injectOverlayManager().open(PlainOverlayComponent, { directives: [ProbeDirective] }),
      ),
    ).toThrow(/ET1211/);
  });

  it('throws ET1211 for customAnimated without strategies', () => {
    expect(() =>
      TestBed.runInInjectionContext(() => injectOverlayManager().open(PlainOverlayComponent, { customAnimated: true })),
    ).toThrow(/ET1211/);
  });
});
