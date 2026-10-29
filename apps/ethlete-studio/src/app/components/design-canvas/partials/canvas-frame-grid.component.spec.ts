import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FrameCell } from '../canvas-frame';
import { CanvasFrameCellComponent } from './canvas-frame-grid.component';

const render = async (cell: FrameCell) => {
  TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });

  const fixture = TestBed.createComponent(CanvasFrameCellComponent);

  fixture.componentRef.setInput('cell', cell);
  await fixture.whenStable();

  return fixture.nativeElement as HTMLElement;
};

describe('CanvasFrameCellComponent', () => {
  it('takes the width a cell names before its page reports a size', async () => {
    const host = await render({ id: 'leaf 280', row: 'leaf', column: 'rest', label: 'leaf', src: '', width: 280 });

    expect(host.style.width).toBe('280px');
  });

  it('waits for the size its page reports without a width', async () => {
    const host = await render({ id: 'leaf', row: 'leaf', column: 'rest', label: 'leaf', src: '' });

    expect(host.style.width).toBe('0px');
  });
});
