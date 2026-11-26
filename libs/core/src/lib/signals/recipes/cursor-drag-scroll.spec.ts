import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { useCursorDragScroll } from './cursor-drag-scroll';

@Component({ template: '' })
class DragScrollHostComponent {
  element = document.createElement('div');
  dragScroll = useCursorDragScroll(this.element, { canScroll: signal(true) });
}

describe('useCursorDragScroll', () => {
  beforeEach(() => {
    // jsdom implements no scrolling at all, and the recipe scrolls the element on every drag move
    Element.prototype.scroll = vi.fn();
  });

  const startDrag = (fixture: ReturnType<typeof TestBed.createComponent<DragScrollHostComponent>>) => {
    const { element } = fixture.componentInstance;

    element.dispatchEvent(new MouseEvent('mousedown', { button: 0, clientX: 0, clientY: 0, bubbles: true }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: 40, clientY: 0, bubbles: true }));

    fixture.detectChanges();
  };

  afterEach(() => {
    document.documentElement.style.removeProperty('cursor');
  });

  it('clears the document cursor when destroyed mid-drag', () => {
    const fixture = TestBed.createComponent(DragScrollHostComponent);
    document.body.appendChild(fixture.componentInstance.element);
    fixture.detectChanges();

    startDrag(fixture);

    expect(fixture.componentInstance.dragScroll.isDragging()).toBe(true);
    expect(document.documentElement.style.cursor).toBe('grabbing');

    fixture.componentInstance.element.remove();
    fixture.destroy();

    expect(document.documentElement.style.cursor).toBe('');
  });

  it('clears the document cursor when the drag ends normally', () => {
    const fixture = TestBed.createComponent(DragScrollHostComponent);
    document.body.appendChild(fixture.componentInstance.element);
    fixture.detectChanges();

    startDrag(fixture);

    expect(document.documentElement.style.cursor).toBe('grabbing');

    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    fixture.detectChanges();

    expect(document.documentElement.style.cursor).toBe('');

    fixture.componentInstance.element.remove();
    fixture.destroy();
  });
});
