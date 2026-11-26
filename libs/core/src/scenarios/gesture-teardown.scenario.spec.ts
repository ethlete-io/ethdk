import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DragHandleDirective, ResizeEdge, ResizeHandlesComponent } from '../index';
import { useScenario } from './harness';

@Component({
  selector: 'et-scenario-gesture-tile',
  imports: [DragHandleDirective],
  template: `
    <div
      (dragStarted)="log.push('start')"
      (dragMoved)="log.push('move:' + $event.totalDx)"
      (dragEnded)="log.push('end')"
      (dragCancelled)="log.push('cancelled')"
      (dragTapped)="log.push('tapped')"
      etDragHandle
    >
      Drag me
    </div>
    <span class="dragging">{{ drag()?.isDragging() }}</span>
  `,
})
class GestureTileComponent {
  drag = viewChild(DragHandleDirective);
  log: string[] = [];
}

@Component({
  selector: 'et-scenario-gesture-resizable',
  imports: [ResizeHandlesComponent],
  template: `
    <et-resize-handles
      #handles
      [edges]="edges"
      (resizeStarted)="log.push('start:' + $event)"
      (resizeMoved)="log.push('move:' + $event.totalDx)"
      (resizeEnded)="log.push('end')"
      (resizeCancelled)="log.push('cancelled')"
    />
    <span class="resizing">{{ handles.isResizing() }}</span>
  `,
})
class GestureResizableComponent {
  log: string[] = [];
  edges: ResizeEdge[] = ['e', 'se'];
}

const pointer = (type: string, target: EventTarget, x: number, pointerId = 1) =>
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 0, pointerId, button: 0, bubbles: true }));

describe('gesture teardown scenarios', () => {
  const scenario = useScenario();

  it('releases the document when a drag handle is destroyed mid-drag', () => {
    const s = scenario();
    const style = document.documentElement.style;
    const fixture = TestBed.createComponent(GestureTileComponent);

    s.tick();

    const host = fixture.nativeElement as HTMLElement;
    const handle = host.querySelector('[etdraghandle]') as HTMLElement;

    pointer('pointerdown', handle, 0);
    pointer('pointermove', document, 20);
    s.tick();

    expect(fixture.componentInstance.log).toEqual(['start', 'move:20']);
    expect(host.querySelector('.dragging')?.textContent).toBe('true');
    expect(style.userSelect).toBe('none');

    fixture.destroy();

    expect(style.userSelect).toBe('');
    expect(style.webkitUserSelect).toBe('');

    pointer('pointermove', document, 40);
    pointer('pointerup', document, 40);
    expect(fixture.componentInstance.log).toEqual(['start', 'move:20']);
  });

  it('releases the document when a drag handle is destroyed before the commit threshold', () => {
    const s = scenario();
    const style = document.documentElement.style;
    const fixture = TestBed.createComponent(GestureTileComponent);

    s.tick();

    const handle = (fixture.nativeElement as HTMLElement).querySelector('[etdraghandle]') as HTMLElement;

    pointer('pointerdown', handle, 0);
    pointer('pointermove', document, 3);
    expect(style.userSelect).toBe('none');

    fixture.destroy();

    expect(style.userSelect).toBe('');
    expect(fixture.componentInstance.log).toEqual([]);
  });

  it('ignores a second pointer while one drag runs and accepts a new drag after it ends', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GestureTileComponent);

    s.tick();

    const handle = (fixture.nativeElement as HTMLElement).querySelector('[etdraghandle]') as HTMLElement;

    pointer('pointerdown', handle, 0, 1);
    pointer('pointerdown', handle, 0, 2);
    pointer('pointermove', document, 50, 2);
    pointer('pointermove', document, 10, 1);
    pointer('pointerup', document, 50, 2);
    pointer('pointerup', document, 10, 1);
    pointer('pointerdown', handle, 0, 3);
    pointer('pointerup', document, 0, 3);
    s.tick();

    expect(fixture.componentInstance.log).toEqual(['start', 'move:10', 'end', 'tapped']);
    expect(document.documentElement.style.userSelect).toBe('');
    fixture.destroy();
  });

  it('releases the document when resize handles are destroyed mid-resize', () => {
    const s = scenario();
    const style = document.documentElement.style;
    const fixture = TestBed.createComponent(GestureResizableComponent);

    s.tick();

    const host = fixture.nativeElement as HTMLElement;
    const handle = host.querySelector('.et-resize-handle--se') as HTMLElement;

    pointer('pointerdown', handle, 100);
    pointer('pointermove', document, 130);
    s.tick();

    expect(fixture.componentInstance.log).toEqual(['start:se', 'move:30']);
    expect(host.querySelector('.resizing')?.textContent).toBe('true');
    expect(host.querySelector('et-resize-handles')?.getAttribute('data-active-edge')).toBe('se');
    expect(style.userSelect).toBe('none');

    fixture.destroy();

    expect(style.userSelect).toBe('');
    pointer('pointermove', document, 160);
    pointer('pointerup', document, 160);
    expect(fixture.componentInstance.log).toEqual(['start:se', 'move:30']);
  });

  it('finishes a resize whose handle is removed from the edges mid-gesture', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GestureResizableComponent);

    s.tick();

    const host = fixture.nativeElement as HTMLElement;
    const handle = host.querySelector('.et-resize-handle--se') as HTMLElement;

    pointer('pointerdown', handle, 100);
    pointer('pointermove', document, 110);
    fixture.componentInstance.edges = ['e'];
    fixture.changeDetectorRef.markForCheck();
    s.tick();

    expect(host.querySelector('.et-resize-handle--se')).toBeNull();

    pointer('pointermove', document, 120);
    pointer('pointerup', document, 120);
    s.tick();

    expect(fixture.componentInstance.log).toEqual(['start:se', 'move:10', 'move:20', 'end']);
    expect(host.querySelector('.resizing')?.textContent).toBe('false');
    expect(host.querySelector('et-resize-handles')?.hasAttribute('data-active-edge')).toBe(false);
    expect(document.documentElement.style.userSelect).toBe('');
    fixture.destroy();
  });

  it('cancels a resize on pointercancel and clears the active edge', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(GestureResizableComponent);

    s.tick();

    const host = fixture.nativeElement as HTMLElement;
    const handle = host.querySelector('.et-resize-handle--e') as HTMLElement;

    pointer('pointerdown', handle, 100);
    pointer('pointermove', document, 90);
    pointer('pointercancel', document, 90);
    s.tick();

    expect(fixture.componentInstance.log).toEqual(['start:e', 'move:-10', 'cancelled']);
    expect(host.querySelector('.resizing')?.textContent).toBe('false');
    expect(document.documentElement.style.userSelect).toBe('');
    fixture.destroy();
  });
});
