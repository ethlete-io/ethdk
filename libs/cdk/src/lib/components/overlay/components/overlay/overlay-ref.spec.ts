import { ESCAPE } from '@angular/cdk/keycodes';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideOverlay } from './overlay.imports';
import { injectOverlayManager } from './overlay-manager';
import { dialogOverlayStrategy } from './strategies';

@Component({ template: '<button type="button">inside</button>' })
class DialogContentComponent {}

const open = () => {
  const ref = TestBed.runInInjectionContext(() =>
    injectOverlayManager().open(DialogContentComponent, { strategies: dialogOverlayStrategy() }),
  );
  let closed = false;

  ref.afterClosed().subscribe(() => (closed = true));
  TestBed.tick();

  return { ref, isClosed: () => closed };
};

const pressEscape = () => {
  const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });

  Object.defineProperty(event, 'keyCode', { value: ESCAPE });
  document.body.dispatchEvent(event);
};

const clickBackdrop = () => {
  const backdrop = document.querySelector('.cdk-overlay-backdrop');

  if (!backdrop) throw new Error('no backdrop');

  backdrop.dispatchEvent(new MouseEvent('click', { bubbles: true }));
};

const settle = async () => {
  for (let i = 0; i < 20; i++) {
    await vi.advanceTimersByTimeAsync(100);
    TestBed.tick();
  }
};

describe('OverlayRef close handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideOverlay()] });
  });

  afterEach(async () => {
    await settle();
    vi.useRealTimers();
  });

  it('closes on an Escape pressed right after open', async () => {
    const { isClosed } = open();

    pressEscape();
    await settle();

    expect(isClosed()).toBe(true);
  });

  it('closes on an Escape pressed while the enter animation runs', async () => {
    const { ref, isClosed } = open();

    const lifecycle = ref._containerInstance.animatedLifecycle;

    for (let i = 0; i < 10 && lifecycle.state() === 'init'; i++) {
      await vi.advanceTimersByTimeAsync(16);
      TestBed.tick();
    }

    expect(lifecycle.state()).toBe('entering');

    pressEscape();
    await settle();

    expect(isClosed()).toBe(true);
  });

  it('closes on a backdrop click right after open', async () => {
    const { isClosed } = open();

    clickBackdrop();
    await settle();

    expect(isClosed()).toBe(true);
  });

  it('closes on a backdrop click while the enter animation runs', async () => {
    const { ref, isClosed } = open();

    const lifecycle = ref._containerInstance.animatedLifecycle;

    for (let i = 0; i < 10 && lifecycle.state() === 'init'; i++) {
      await vi.advanceTimersByTimeAsync(16);
      TestBed.tick();
    }

    expect(lifecycle.state()).toBe('entering');

    clickBackdrop();
    await settle();

    expect(isClosed()).toBe(true);
  });
});
