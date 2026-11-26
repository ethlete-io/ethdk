import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { ShellResizeHandleComponent } from './shell-resize-handle.component';

const pointer = (type: string, target: EventTarget, x: number) =>
  target.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: 10, pointerId: 1, button: 0, bubbles: true }));

const setup = async (width?: number) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(ShellResizeHandleComponent);

  if (width !== undefined) fixture.componentRef.setInput('width', width);

  const widths: number[] = [];
  const live: (number | null)[] = [];

  fixture.componentInstance.width.subscribe((next) => widths.push(next));
  fixture.componentInstance.dragWidthChange.subscribe((next) => live.push(next));
  await fixture.whenStable();

  const handle = fixture.nativeElement.querySelector('[role="separator"]') as HTMLElement;

  return { fixture, handle, widths, live };
};

describe('ShellResizeHandleComponent', () => {
  it('clamps a width outside the range for the value it announces', async () => {
    const { handle } = await setup(900);

    expect(handle.getAttribute('aria-valuenow')).toBe('400');
    expect(handle.getAttribute('aria-valuemin')).toBe('200');
  });

  it('reports the live width of a drag and emits the committed width on release', async () => {
    const { fixture, handle, widths, live } = await setup(300);

    pointer('pointerdown', handle, 500);
    pointer('pointermove', document, 450);
    await fixture.whenStable();

    expect(handle.getAttribute('aria-valuenow')).toBe('250');
    expect(widths).toEqual([]);

    pointer('pointerup', document, 450);
    await fixture.whenStable();

    expect(widths).toEqual([250]);
    expect(live.at(-1)).toBeNull();
  });

  it('steps with the arrow keys and ignores other keys', async () => {
    const { handle, widths } = await setup(396);

    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(widths).toEqual([400]);
  });
});
