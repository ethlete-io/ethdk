import { describe, expect, it } from 'vitest';
import { GridItemConstraints, GridItemPosition } from '../grid.types';
import {
  clampResizeRect,
  computeGeometry,
  hysteresisRound,
  pixelRectsEqual,
  positionsEqual,
  positionToPixelRect,
  projectDragCell,
  resizeSpanBounds,
  rowsToPixelHeight,
  snapResizeSpan,
  spanHeight,
  spanWidth,
} from './grid-math';

// 12 columns, 1216px content, 16px gap, 100px rows → cellWidth = (1216 - 176) / 12 = 86.666…
// Use a friendlier setup for exact assertions: 10 columns, 1090px → cellWidth = (1090 - 144) / 10
// Simplest exact numbers: 4 columns, gap 10, contentWidth 430 → cellWidth = (430 - 30) / 4 = 100.
const geometry = computeGeometry({ contentWidth: 430, columns: 4, gap: 10, rowHeight: 50 });

const constraints: GridItemConstraints = { minColSpan: 1, maxColSpan: 12, minRowSpan: 1, maxRowSpan: 24 };

describe('grid-math', () => {
  describe('computeGeometry', () => {
    it('should compute cell width and strides', () => {
      expect(geometry.cellWidth).toBe(100);
      expect(geometry.strideX).toBe(110);
      expect(geometry.strideY).toBe(60);
      expect(geometry.originX).toBe(0);
      expect(geometry.originY).toBe(0);
    });

    it('should carry padding origins', () => {
      const g = computeGeometry({ contentWidth: 430, columns: 4, gap: 10, rowHeight: 50, originX: 8, originY: 12 });
      expect(g.originX).toBe(8);
      expect(g.originY).toBe(12);
    });

    it('should not divide by zero columns', () => {
      const g = computeGeometry({ contentWidth: 430, columns: 0, gap: 10, rowHeight: 50 });
      expect(g.cellWidth).toBe(0);
    });
  });

  describe('spanWidth / spanHeight', () => {
    it('should size a single span to one cell', () => {
      expect(spanWidth(1, geometry)).toBe(100);
      expect(spanHeight(1, geometry)).toBe(50);
    });

    it('should include inner gaps for multi-cell spans', () => {
      expect(spanWidth(3, geometry)).toBe(320); // 3*100 + 2*10
      expect(spanHeight(2, geometry)).toBe(110); // 2*50 + 1*10
    });

    it('should fill the full content width at max span', () => {
      expect(spanWidth(4, geometry)).toBe(430);
    });
  });

  describe('positionToPixelRect', () => {
    it('should place col/row 0 at the origin', () => {
      const rect = positionToPixelRect({ col: 0, row: 0, colSpan: 1, rowSpan: 1 }, geometry);
      expect(rect).toEqual({ x: 0, y: 0, width: 100, height: 50 });
    });

    it('should offset by strides and padding', () => {
      const g = computeGeometry({ contentWidth: 430, columns: 4, gap: 10, rowHeight: 50, originX: 8, originY: 12 });
      const rect = positionToPixelRect({ col: 2, row: 1, colSpan: 2, rowSpan: 2 }, g);
      expect(rect).toEqual({ x: 8 + 220, y: 12 + 60, width: 210, height: 110 });
    });

    it('should end the last column exactly at the content edge', () => {
      const rect = positionToPixelRect({ col: 3, row: 0, colSpan: 1, rowSpan: 1 }, geometry);
      expect(rect.x + rect.width).toBe(430);
    });
  });

  describe('rowsToPixelHeight', () => {
    it('should be zero for zero rows', () => {
      expect(rowsToPixelHeight(0, geometry)).toBe(0);
    });

    it('should include inner gaps only', () => {
      expect(rowsToPixelHeight(1, geometry)).toBe(50);
      expect(rowsToPixelHeight(3, geometry)).toBe(170); // 3*50 + 2*10
    });
  });

  describe('equality helpers', () => {
    it('should compare pixel rects', () => {
      expect(pixelRectsEqual({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 4 })).toBe(true);
      expect(pixelRectsEqual({ x: 1, y: 2, width: 3, height: 4 }, { x: 1, y: 2, width: 3, height: 5 })).toBe(false);
      expect(pixelRectsEqual(null, null)).toBe(true);
      expect(pixelRectsEqual(null, { x: 0, y: 0, width: 0, height: 0 })).toBe(false);
    });

    it('should compare positions', () => {
      const a: GridItemPosition = { col: 0, row: 1, colSpan: 2, rowSpan: 3 };
      expect(positionsEqual(a, { ...a })).toBe(true);
      expect(positionsEqual(a, { ...a, col: 1 })).toBe(false);
      expect(positionsEqual(null, null)).toBe(true);
      expect(positionsEqual(a, null)).toBe(false);
    });
  });

  describe('hysteresisRound', () => {
    it('should plain-round without a previous value', () => {
      expect(hysteresisRound(1.4, null)).toBe(1);
      expect(hysteresisRound(1.6, null)).toBe(2);
    });

    it('should not advance until past the shifted boundary when moving up', () => {
      // boundary from 1 to 2 sits at 1.5 + 0.1
      expect(hysteresisRound(1.55, 1)).toBe(1);
      expect(hysteresisRound(1.61, 1)).toBe(2);
    });

    it('should not retreat until past the shifted boundary when moving down', () => {
      // boundary from 2 to 1 sits at 1.5 - 0.1
      expect(hysteresisRound(1.45, 2)).toBe(2);
      expect(hysteresisRound(1.39, 2)).toBe(1);
    });

    it('should never overshoot back past the last value', () => {
      // raw above last but rounding with -h would drop below last
      expect(hysteresisRound(2.05, 2)).toBe(2);
      expect(hysteresisRound(1.95, 2)).toBe(2);
    });

    it('should resolve multi-cell jumps in one step', () => {
      expect(hysteresisRound(4.3, 1)).toBe(4);
      expect(hysteresisRound(0.7, 4)).toBe(1);
    });

    it('should hold exactly-equal raw values', () => {
      expect(hysteresisRound(2, 2)).toBe(2);
    });
  });

  describe('resizeSpanBounds', () => {
    const start: GridItemPosition = { col: 1, row: 2, colSpan: 2, rowSpan: 2 };

    it('should cap east growth at the grid right edge', () => {
      const bounds = resizeSpanBounds({ edge: 'e', start, constraints, columns: 4 });
      expect(bounds.maxColSpan).toBe(3); // columns 1..3
    });

    it('should cap west growth at column 0', () => {
      const bounds = resizeSpanBounds({ edge: 'w', start, constraints, columns: 4 });
      expect(bounds.maxColSpan).toBe(3); // right edge fixed at col 3
    });

    it('should cap north growth at row 0', () => {
      const bounds = resizeSpanBounds({ edge: 'n', start, constraints, columns: 4 });
      expect(bounds.maxRowSpan).toBe(4); // bottom edge fixed at row 4
    });

    it('should not cap south growth by grid bounds', () => {
      const bounds = resizeSpanBounds({ edge: 's', start, constraints, columns: 4 });
      expect(bounds.maxRowSpan).toBe(24);
    });

    it('should respect item constraints when tighter than the grid', () => {
      const tight: GridItemConstraints = { ...constraints, maxColSpan: 2, maxRowSpan: 3 };
      expect(resizeSpanBounds({ edge: 'e', start, constraints: tight, columns: 4 }).maxColSpan).toBe(2);
      expect(resizeSpanBounds({ edge: 's', start, constraints: tight, columns: 4 }).maxRowSpan).toBe(3);
    });

    it('should keep the range valid when min exceeds available space', () => {
      const wide: GridItemConstraints = { ...constraints, minColSpan: 6 };
      const bounds = resizeSpanBounds({
        edge: 'e',
        start: { col: 2, row: 0, colSpan: 2, rowSpan: 1 },
        constraints: wide,
        columns: 4,
      });
      expect(bounds.minColSpan).toBe(2); // capped to maxColSpan (columns 2..3)
      expect(bounds.maxColSpan).toBe(2);
    });

    it('should combine both axes for corner edges', () => {
      const bounds = resizeSpanBounds({ edge: 'ne', start, constraints, columns: 4 });
      expect(bounds.maxColSpan).toBe(3);
      expect(bounds.maxRowSpan).toBe(4);
    });
  });

  describe('clampResizeRect', () => {
    const start: GridItemPosition = { col: 1, row: 1, colSpan: 1, rowSpan: 1 };
    const startRect = positionToPixelRect(start, geometry); // { x: 110, y: 60, w: 100, h: 50 }
    const bounds = resizeSpanBounds({ edge: 'se', start, constraints, columns: 4 });

    it('should follow the pointer inside bounds', () => {
      const rect = clampResizeRect({ edge: 'e', dx: 55, dy: 0, startRect, bounds, geometry });
      expect(rect).toEqual({ x: 110, y: 60, width: 155, height: 50 });
    });

    it('should hard-clamp east growth at the grid right edge', () => {
      const rect = clampResizeRect({ edge: 'e', dx: 9999, dy: 0, startRect, bounds, geometry });
      expect(rect.x + rect.width).toBe(430); // spanWidth(3) from x=110
    });

    it('should hard-clamp at the min span when shrinking', () => {
      const rect = clampResizeRect({ edge: 'e', dx: -9999, dy: 0, startRect, bounds, geometry });
      expect(rect.width).toBe(100);
    });

    it('should keep the right edge fixed for west resizes', () => {
      const wBounds = resizeSpanBounds({ edge: 'w', start, constraints, columns: 4 });
      const rect = clampResizeRect({ edge: 'w', dx: -9999, dy: 0, startRect, bounds: wBounds, geometry });
      expect(rect.x + rect.width).toBe(210); // original right edge
      expect(rect.x).toBe(0); // grew to col 0, no further
    });

    it('should keep the bottom edge fixed for north resizes', () => {
      const nBounds = resizeSpanBounds({ edge: 'n', start, constraints, columns: 4 });
      const rect = clampResizeRect({ edge: 'n', dx: 0, dy: -9999, startRect, bounds: nBounds, geometry });
      expect(rect.y + rect.height).toBe(110); // original bottom edge
      expect(rect.y).toBe(0);
    });

    it('should resize both axes on corner edges', () => {
      const rect = clampResizeRect({ edge: 'se', dx: 120, dy: 70, startRect, bounds, geometry });
      expect(rect.width).toBe(220);
      expect(rect.height).toBe(120);
    });
  });

  describe('snapResizeSpan', () => {
    const start: GridItemPosition = { col: 1, row: 1, colSpan: 1, rowSpan: 1 };
    const bounds = resizeSpanBounds({ edge: 'se', start, constraints, columns: 4 });

    it('should keep the span while the edge is under the midpoint', () => {
      // width for a snap to 2 needs (rect.width + gap) / strideX ≥ 1.5+h → width ≥ 166
      const rect = { x: 110, y: 60, width: 160, height: 50 };
      const snap = snapResizeSpan({ edge: 'e', rect, start, bounds, geometry, lastSnap: start });
      expect(snap.colSpan).toBe(1);
    });

    it('should claim the next cell past the midpoint', () => {
      const rect = { x: 110, y: 60, width: 170, height: 50 };
      const snap = snapResizeSpan({ edge: 'e', rect, start, bounds, geometry, lastSnap: start });
      expect(snap.colSpan).toBe(2);
      expect(snap.col).toBe(1);
    });

    it('should recompute col from the fixed right edge for west resizes', () => {
      const wStart: GridItemPosition = { col: 2, row: 0, colSpan: 1, rowSpan: 1 };
      const wBounds = resizeSpanBounds({ edge: 'w', start: wStart, constraints, columns: 4 });
      const rect = { x: 110, y: 0, width: 210, height: 50 }; // grew one cell west
      const snap = snapResizeSpan({ edge: 'w', rect, start: wStart, bounds: wBounds, geometry, lastSnap: null });
      expect(snap.colSpan).toBe(2);
      expect(snap.col).toBe(1); // right edge stays at col 3
    });

    it('should recompute row from the fixed bottom edge for north resizes', () => {
      const nStart: GridItemPosition = { col: 0, row: 2, colSpan: 1, rowSpan: 1 };
      const nBounds = resizeSpanBounds({ edge: 'n', start: nStart, constraints, columns: 4 });
      const rect = { x: 0, y: 60, width: 100, height: 110 };
      const snap = snapResizeSpan({ edge: 'n', rect, start: nStart, bounds: nBounds, geometry, lastSnap: null });
      expect(snap.rowSpan).toBe(2);
      expect(snap.row).toBe(1);
    });

    it('should never exceed the bounds even for out-of-range rects', () => {
      const rect = { x: 110, y: 60, width: 9999, height: 50 };
      const snap = snapResizeSpan({ edge: 'e', rect, start, bounds, geometry, lastSnap: null });
      expect(snap.colSpan).toBe(bounds.maxColSpan);
    });
  });

  describe('projectDragCell', () => {
    it('should be independent of the grab point by construction', () => {
      // the caller passes the item's own top-left; two different grab points on the
      // same item produce the same float rect and therefore the same cell
      const cell = projectDragCell({ float: { x: 115, y: 62 }, colSpan: 1, geometry, lastTarget: null });
      expect(cell).toEqual({ col: 1, row: 1 });
    });

    it('should round to the nearest cell', () => {
      expect(projectDragCell({ float: { x: 54, y: 0 }, colSpan: 1, geometry, lastTarget: null }).col).toBe(0);
      expect(projectDragCell({ float: { x: 56, y: 0 }, colSpan: 1, geometry, lastTarget: null }).col).toBe(1);
    });

    it('should clamp so the item stays inside the columns', () => {
      const cell = projectDragCell({ float: { x: 9999, y: 0 }, colSpan: 2, geometry, lastTarget: null });
      expect(cell.col).toBe(2); // 4 columns - span 2
    });

    it('should not allow negative rows or cols', () => {
      const cell = projectDragCell({ float: { x: -500, y: -500 }, colSpan: 1, geometry, lastTarget: null });
      expect(cell).toEqual({ col: 0, row: 0 });
    });

    it('should apply hysteresis at the cell boundary', () => {
      // midpoint between col 0 and 1 is x = 55; with h=0.1 the up-boundary shifts to x = 66
      expect(
        projectDragCell({ float: { x: 60, y: 0 }, colSpan: 1, geometry, lastTarget: { col: 0, row: 0 } }).col,
      ).toBe(0);
      expect(
        projectDragCell({ float: { x: 67, y: 0 }, colSpan: 1, geometry, lastTarget: { col: 0, row: 0 } }).col,
      ).toBe(1);
    });

    it('should account for the container padding origin', () => {
      const g = computeGeometry({ contentWidth: 430, columns: 4, gap: 10, rowHeight: 50, originX: 20, originY: 20 });
      const cell = projectDragCell({ float: { x: 130, y: 80 }, colSpan: 1, geometry: g, lastTarget: null });
      expect(cell).toEqual({ col: 1, row: 1 });
    });
  });
});
