import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { GridItemComponent } from '../grid-item.component';
import { createGridHarness, GridHarness } from '../testing/grid-driver';
import { GridResizeDirective } from './grid-resize.directive';
import { GridDirective } from './grid.directive';
import { GridItemConfig } from './grid.types';

@Component({
  imports: [GridDirective, GridItemComponent],
  template: `
    <div [items]="items" [rowHeight]="100" [gap]="16" etGrid>
      <et-grid-item itemId="resize-item" />
    </div>
  `,
})
class TestHostComponent {
  items: GridItemConfig[] = [{ id: 'resize-item', type: 'test', data: undefined, layout: {} }];
}

describe('GridResizeDirective', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let grid: GridHarness;

  const getResizeDirective = () =>
    fixture.debugElement.query(By.directive(GridResizeDirective)).injector.get(GridResizeDirective);

  const getGridDirective = () => fixture.debugElement.query(By.directive(GridDirective)).injector.get(GridDirective);

  const measureGrid = (width?: number) => grid.measure(fixture, width);

  beforeEach(() => {
    grid = createGridHarness();

    TestBed.configureTestingModule({ imports: [TestHostComponent] });
    fixture = TestBed.createComponent(TestHostComponent);
  });

  it('instantiates without error', () => {
    fixture.detectChanges();
    expect(getResizeDirective()).toBeDefined();
  });

  it('is not resizing by default', () => {
    fixture.detectChanges();
    expect(getResizeDirective().isResizing()).toBe(false);
  });

  it('exposes all 8 resize edges', () => {
    fixture.detectChanges();
    expect(getResizeDirective().resizeEdges()).toHaveLength(8);
  });

  it('does not begin a resize before the grid is measured', () => {
    fixture.detectChanges();
    getResizeDirective().beginResize();
    expect(getResizeDirective().isResizing()).toBe(false);
  });

  it('beginResize sets isResizing to true when the grid is measured', () => {
    fixture.detectChanges();
    measureGrid();
    getResizeDirective().beginResize();
    expect(getResizeDirective().isResizing()).toBe(true);
  });

  it('finishResize clears isResizing', () => {
    fixture.detectChanges();
    measureGrid();
    getResizeDirective().beginResize();
    getResizeDirective().finishResize();
    expect(getResizeDirective().isResizing()).toBe(false);
  });

  it('finishResize commits the resize on the grid', () => {
    fixture.detectChanges();
    measureGrid();
    const commitSpy = vi.spyOn(getGridDirective(), 'commitResize');
    getResizeDirective().beginResize();
    getResizeDirective().finishResize();
    expect(commitSpy).toHaveBeenCalledOnce();
  });

  it('grows the item by one column when the east edge crosses a cell midpoint', () => {
    fixture.detectChanges();
    measureGrid();

    const geometry = getGridDirective().geometry();
    getResizeDirective().beginResize();
    getResizeDirective().updateResize({
      edge: 'e',
      dx: geometry.strideX * 0.7,
      dy: 0,
      clientX: 0,
      clientY: 0,
    });
    getResizeDirective().finishResize();

    const entry = getGridDirective()
      .baseLayout()
      .find((e) => e.id === 'resize-item');
    expect(entry?.position.colSpan).toBe(2);
  });

  it('cancelResize restores the pre-resize layout', () => {
    fixture.detectChanges();
    measureGrid();

    const before = getGridDirective().baseLayout();
    const geometry = getGridDirective().geometry();

    getResizeDirective().beginResize();
    getResizeDirective().updateResize({
      edge: 'e',
      dx: geometry.strideX * 1.7,
      dy: 0,
      clientX: 0,
      clientY: 0,
    });
    getResizeDirective().cancelResize();

    expect(getGridDirective().baseLayout()).toEqual(before);
    expect(getResizeDirective().isResizing()).toBe(false);
  });
});
