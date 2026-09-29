import { Component, signal, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ResizeEdge, ResizeHandlesComponent, ResizeMoveEvent } from './resize-handles.component';

@Component({
  selector: 'et-test-resize-host',
  imports: [ResizeHandlesComponent],
  template: `
    <et-resize-handles
      [edges]="edges"
      [disabled]="disabled()"
      (resizeStarted)="log.push('start:' + $event)"
      (resizeMoved)="moves.push($event)"
      (resizeEnded)="log.push('end')"
      (resizeCancelled)="log.push('cancel')"
    />
  `,
})
class HostComponent {
  handles = viewChild.required(ResizeHandlesComponent);
  edges: ResizeEdge[] = ['n', 'se'];
  disabled = signal(false);
  log: string[] = [];
  moves: ResizeMoveEvent[] = [];
}

const pointer = (type: string, target: EventTarget, x = 0, y = 0, init: PointerEventInit = {}) =>
  target.dispatchEvent(
    new PointerEvent(type, { clientX: x, clientY: y, pointerId: 1, button: 0, bubbles: true, ...init }),
  );

describe('ResizeHandlesComponent', () => {
  const setup = () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const handle = (edge: string) => el.querySelector(`.et-resize-handle--${edge}`) as HTMLElement;

    return { fixture, host: fixture.componentInstance, el, handle };
  };

  it('renders one handle per edge with the matching cursor', () => {
    const { handle, el } = setup();

    expect(el.querySelectorAll('.et-resize-handle')).toHaveLength(2);
    expect(handle('n').style.cursor).toBe('ns-resize');
    expect(handle('se').style.cursor).toBe('nwse-resize');
  });

  it('emits start, cumulative moves and end for a gesture', () => {
    const { fixture, host, handle } = setup();

    pointer('pointerdown', handle('se'), 100, 100);
    pointer('pointermove', document, 110, 95);
    pointer('pointermove', document, 130, 120);
    pointer('pointerup', document, 130, 120);
    fixture.detectChanges();

    expect(host.log).toEqual(['start:se', 'end']);
    expect(host.moves).toEqual([
      { edge: 'se', dx: 10, dy: -5, clientX: 110, clientY: 95 },
      { edge: 'se', dx: 30, dy: 20, clientX: 130, clientY: 120 },
    ]);
  });

  it('exposes the active edge and resizing state while the gesture runs', () => {
    const { fixture, host, handle, el } = setup();
    const resizeHandles = host.handles();

    expect(resizeHandles.isResizing()).toBe(false);
    expect(el.querySelector('et-resize-handles')?.hasAttribute('data-active-edge')).toBe(false);

    pointer('pointerdown', handle('n'), 0, 0);
    pointer('pointermove', document, 0, 5);
    fixture.detectChanges();

    expect(resizeHandles.isResizing()).toBe(true);
    expect(el.querySelector('et-resize-handles')?.getAttribute('data-active-edge')).toBe('n');

    pointer('pointerup', document, 0, 5);
    fixture.detectChanges();

    expect(resizeHandles.isResizing()).toBe(false);
    expect(el.querySelector('et-resize-handles')?.hasAttribute('data-active-edge')).toBe(false);
  });

  it('emits cancelled instead of end on pointercancel', () => {
    const { host, handle } = setup();

    pointer('pointerdown', handle('n'), 0, 0);
    pointer('pointercancel', document, 0, 0);

    expect(host.log).toEqual(['start:n', 'cancel']);
  });

  it('ignores other pointers during a gesture', () => {
    const { host, handle } = setup();

    pointer('pointerdown', handle('n'), 0, 0);
    pointer('pointermove', document, 0, 50, { pointerId: 2 });
    pointer('pointerup', document, 0, 50, { pointerId: 2 });

    expect(host.moves).toEqual([]);
    expect(host.log).toEqual(['start:n']);
  });

  it('ignores non-primary buttons', () => {
    const { host, handle } = setup();

    pointer('pointerdown', handle('n'), 0, 0, { button: 2 });

    expect(host.log).toEqual([]);
  });

  it('ignores gestures and marks itself inert while disabled', () => {
    const { fixture, host, handle, el } = setup();

    host.disabled.set(true);
    fixture.detectChanges();

    pointer('pointerdown', handle('n'), 0, 0);

    expect(host.log).toEqual([]);
    expect(el.querySelector('et-resize-handles')?.hasAttribute('inert')).toBe(true);
  });

  it('suppresses text selection during the gesture and restores it after', () => {
    const { handle } = setup();
    const style = document.documentElement.style;

    pointer('pointerdown', handle('n'), 0, 0);
    expect(style.userSelect).toBe('none');

    pointer('pointerup', document, 0, 0);
    expect(style.userSelect).toBe('');
  });

  it('keeps the pointerdown from reaching a drag parent', () => {
    const { el, handle } = setup();
    const seen = vi.fn();

    el.addEventListener('pointerdown', seen);
    pointer('pointerdown', handle('n'), 0, 0);
    pointer('pointerup', document, 0, 0);

    expect(seen).not.toHaveBeenCalled();
  });
});
