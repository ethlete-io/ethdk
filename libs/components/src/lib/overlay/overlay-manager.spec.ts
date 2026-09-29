import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { injectOverlayManager } from './overlay-manager';
import { OverlayRef } from './overlay-ref';

@Component({ template: 'overlay content' })
class PlainOverlayComponent {}

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
});
