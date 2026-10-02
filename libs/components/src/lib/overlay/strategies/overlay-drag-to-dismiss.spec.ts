import { AngularRenderer } from '@ethlete/core';
import { Subject } from 'rxjs';
import '../../../test-helpers';
import { OverlayRef } from '../overlay-ref';
import { enableDragToDismiss } from './overlay-drag-to-dismiss';
import { OverlayStrategyContext } from './overlay-strategy.types';
import { createSheetStrategy } from './sheet-strategy-hooks';

const renderer: AngularRenderer = {
  setStyle: (element: HTMLElement, styles: Record<string, string | null>) => {
    for (const [property, value] of Object.entries(styles)) {
      if (value === null) {
        element.style.removeProperty(property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`));
      } else {
        element.style.setProperty(
          property.replace(/[A-Z]/g, (char) => `-${char.toLowerCase()}`),
          value,
        );
      }
    }
  },
} as unknown as AngularRenderer;

const pointerEvent = (
  type: string,
  init: { clientX: number; clientY: number; target?: HTMLElement; movementY?: number },
) => {
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: init.clientX,
    clientY: init.clientY,
    button: 0,
  }) as MouseEvent & {
    pointerId: number;
    isPrimary: boolean;
    pointerType: string;
    movementX: number;
    movementY: number;
  };

  Object.defineProperties(event, {
    pointerId: { value: 1 },
    isPrimary: { value: true },
    pointerType: { value: 'touch' },
    movementX: { value: 0 },
    movementY: { value: init.movementY ?? 0 },
  });

  return event;
};

describe('overlay drag to dismiss', () => {
  let pane: HTMLElement;
  let afterClosed$: Subject<never>;
  let beforeClosed$: Subject<unknown>;
  let overlayRef: OverlayRef<object, unknown>;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    pane = document.createElement('div');
    pane.style.height = '400px';
    Object.defineProperty(pane, 'offsetHeight', { configurable: true, value: 400 });
    pane.setPointerCapture = vi.fn();
    document.body.appendChild(pane);

    afterClosed$ = new Subject<never>();
    beforeClosed$ = new Subject<unknown>();
    close = vi.fn();
    overlayRef = {
      close,
      beforeClosed: () => beforeClosed$.asObservable(),
      afterClosed: () => afterClosed$.asObservable(),
    } as unknown as OverlayRef<object, unknown>;
  });

  afterEach(() => {
    afterClosed$.complete();
    pane.remove();
  });

  const attach = () =>
    enableDragToDismiss({
      element: pane,
      overlayRef,
      renderer,
      config: { direction: 'to-bottom' },
    });

  const dragDown = (from: HTMLElement, distance: number) => {
    from.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));

    for (let travelled = 10; travelled <= distance; travelled += 10) {
      document.dispatchEvent(pointerEvent('pointermove', { clientX: 100, clientY: 100 + travelled }));
    }
  };

  const release = (distance: number) =>
    document.dispatchEvent(pointerEvent('pointerup', { clientX: 100, clientY: 100 + distance }));

  it('settles back and reports the veto when a close guard vetoes the dismiss', () => {
    vi.useFakeTimers();
    const onDismissVetoed = vi.fn();
    const ref = enableDragToDismiss({
      element: pane,
      overlayRef,
      renderer,
      config: { direction: 'to-bottom' },
      onDismissVetoed,
    });

    dragDown(pane, 200);
    release(200);

    expect(close).toHaveBeenCalledWith();
    expect(onDismissVetoed).toHaveBeenCalledTimes(1);
    expect(pane.style.transform).toBe('translateY(0px)');

    vi.runAllTimers();

    expect(pane.style.transform).toBe('');

    ref.unsubscribe();
    vi.useRealTimers();
  });

  it('drops the swipe momentum of a vetoed dismiss so a later close keeps its own duration', () => {
    vi.useFakeTimers();
    const strategy = createSheetStrategy({ dragToDismiss: { direction: 'to-bottom' } }, renderer);
    const context = {
      containerEl: pane,
      overlayRef,
      lifecycle: { enter: vi.fn(), leave: vi.fn() },
    } as unknown as OverlayStrategyContext;

    strategy.onAfterEnter?.(context);

    pane.dispatchEvent(pointerEvent('pointerdown', { clientX: 100, clientY: 100 }));

    for (let travelled = 20; travelled <= 200; travelled += 20) {
      vi.advanceTimersByTime(10);
      document.dispatchEvent(pointerEvent('pointermove', { clientX: 100, clientY: 100 + travelled, movementY: 20 }));
    }

    release(200);
    vi.runAllTimers();
    strategy.onBeforeLeave?.(context);

    expect(pane.style.transitionDuration).toBe('');

    vi.useRealTimers();
  });

  it('leaves the sheet at the drag offset when the dismiss starts the close', () => {
    const onDismissVetoed = vi.fn();

    close.mockImplementation(() => beforeClosed$.next(undefined));

    const ref = enableDragToDismiss({
      element: pane,
      overlayRef,
      renderer,
      config: { direction: 'to-bottom' },
      onDismissVetoed,
    });

    dragDown(pane, 200);
    release(200);

    expect(onDismissVetoed).not.toHaveBeenCalled();
    expect(pane.style.transform).toBe('translateY(200px)');

    ref.unsubscribe();
  });

  it('follows a drag started on the sheet itself', () => {
    const ref = attach();
    const content = document.createElement('div');
    pane.appendChild(content);

    dragDown(content, 60);

    expect(pane.style.transform).toBe('translateY(60px)');

    ref.unsubscribe();
  });

  it('leaves the sheet alone when the drag starts on a surface that took the dismiss axis', () => {
    const ref = attach();
    const area = document.createElement('div');
    area.style.touchAction = 'none';
    pane.appendChild(area);

    dragDown(area, 60);

    expect(pane.style.transform).toBe('');

    ref.unsubscribe();
  });

  it('leaves the sheet alone for a vertical slider, which takes the same axis as a bottom sheet', () => {
    const ref = attach();
    const track = document.createElement('div');
    track.style.touchAction = 'pan-x';
    pane.appendChild(track);

    dragDown(track, 60);

    expect(pane.style.transform).toBe('');

    ref.unsubscribe();
  });

  it('still follows a drag over a horizontal slider, which leaves the vertical axis free', () => {
    const ref = attach();
    const track = document.createElement('div');
    track.style.touchAction = 'pan-y';
    pane.appendChild(track);

    dragDown(track, 60);

    expect(pane.style.transform).toBe('translateY(60px)');

    ref.unsubscribe();
  });

  it('checks every element between the pointer and the sheet', () => {
    const ref = attach();
    const area = document.createElement('div');
    area.style.touchAction = 'none';
    const thumb = document.createElement('span');
    area.appendChild(thumb);
    pane.appendChild(area);

    dragDown(thumb, 60);

    expect(pane.style.transform).toBe('');

    ref.unsubscribe();
  });
});
