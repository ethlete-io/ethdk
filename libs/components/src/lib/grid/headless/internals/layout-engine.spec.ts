import { describe, expect, it } from 'vitest';
import {
  autoPlace,
  clampPosition,
  compactLayout,
  computeGridHeight,
  findCollision,
  itemsCollide,
  resolveCollisions,
} from './layout-engine';
import { GridItemPosition, GridLayoutEntry } from '../grid.types';

describe('layout-engine', () => {
  describe('itemsCollide', () => {
    it('should detect overlapping items', () => {
      const a: GridItemPosition = { col: 0, row: 0, colSpan: 2, rowSpan: 2 };
      const b: GridItemPosition = { col: 1, row: 1, colSpan: 2, rowSpan: 2 };

      expect(itemsCollide(a, b)).toBe(true);
    });

    it('should not detect non-overlapping items', () => {
      const a: GridItemPosition = { col: 0, row: 0, colSpan: 2, rowSpan: 2 };
      const b: GridItemPosition = { col: 2, row: 0, colSpan: 2, rowSpan: 2 };

      expect(itemsCollide(a, b)).toBe(false);
    });

    it('should not detect items that are adjacent vertically', () => {
      const a: GridItemPosition = { col: 0, row: 0, colSpan: 2, rowSpan: 1 };
      const b: GridItemPosition = { col: 0, row: 1, colSpan: 2, rowSpan: 1 };

      expect(itemsCollide(a, b)).toBe(false);
    });

    it('should detect single-cell overlap', () => {
      const a: GridItemPosition = { col: 0, row: 0, colSpan: 3, rowSpan: 3 };
      const b: GridItemPosition = { col: 2, row: 2, colSpan: 1, rowSpan: 1 };

      expect(itemsCollide(a, b)).toBe(true);
    });
  });

  describe('findCollision', () => {
    it('should return the colliding entry', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 2, rowSpan: 2 } },
        { id: '2', position: { col: 4, row: 0, colSpan: 2, rowSpan: 2 } },
      ];

      const result = findCollision({ entries, position: { col: 1, row: 1, colSpan: 2, rowSpan: 2 } });

      expect(result?.id).toBe('1');
    });

    it('should return undefined when no collision', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 0, colSpan: 2, rowSpan: 2 } }];

      const result = findCollision({ entries, position: { col: 3, row: 0, colSpan: 2, rowSpan: 2 } });

      expect(result).toBeUndefined();
    });

    it('should exclude specified id', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 4 } }];

      const result = findCollision({ entries, position: { col: 0, row: 0, colSpan: 2, rowSpan: 2 }, excludeId: '1' });

      expect(result).toBeUndefined();
    });
  });

  describe('compactLayout', () => {
    it('should move items up when space is available', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 3, colSpan: 2, rowSpan: 1 } }];

      const result = compactLayout(entries, 12);

      expect(result[0]?.position.row).toBe(0);
    });

    it('should not move items through each other', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 2, rowSpan: 2 } },
        { id: '2', position: { col: 0, row: 5, colSpan: 2, rowSpan: 1 } },
      ];

      const result = compactLayout(entries, 12);
      const item2 = result.find((e) => e.id === '2');

      expect(item2?.position.row).toBe(2);
    });

    it('should allow side-by-side items at the same row', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
        { id: '2', position: { col: 4, row: 5, colSpan: 4, rowSpan: 1 } },
      ];

      const result = compactLayout(entries, 12);
      const item2 = result.find((e) => e.id === '2');

      expect(item2?.position.row).toBe(0);
    });
  });

  describe('autoPlace', () => {
    it('should place at origin when grid is empty', () => {
      const result = autoPlace({ entries: [], colSpan: 3, rowSpan: 2, columns: 12 });

      expect(result).toEqual({ col: 0, row: 0, colSpan: 3, rowSpan: 2 });
    });

    it('should place next to existing item', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } }];

      const result = autoPlace({ entries, colSpan: 4, rowSpan: 2, columns: 12 });

      expect(result.col).toBe(4);
      expect(result.row).toBe(0);
    });

    it('should wrap to next row when no space', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 0, colSpan: 12, rowSpan: 1 } }];

      const result = autoPlace({ entries, colSpan: 4, rowSpan: 1, columns: 12 });

      expect(result.row).toBe(1);
      expect(result.col).toBe(0);
    });

    it('should clamp colSpan to column count', () => {
      const result = autoPlace({ entries: [], colSpan: 20, rowSpan: 1, columns: 6 });

      expect(result.colSpan).toBe(6);
    });
  });

  describe('clampPosition', () => {
    it('should clamp colSpan to constraints', () => {
      const position: GridItemPosition = { col: 0, row: 0, colSpan: 10, rowSpan: 1 };
      const constraints = { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 4 };

      const result = clampPosition({ position, constraints, columns: 12 });

      expect(result.colSpan).toBe(6);
    });

    it('should clamp rowSpan to constraints', () => {
      const position: GridItemPosition = { col: 0, row: 0, colSpan: 3, rowSpan: 8 };
      const constraints = { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 4 };

      const result = clampPosition({ position, constraints, columns: 12 });

      expect(result.rowSpan).toBe(4);
    });

    it('should clamp col to prevent overflow', () => {
      const position: GridItemPosition = { col: 11, row: 0, colSpan: 3, rowSpan: 1 };
      const constraints = { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 4 };

      const result = clampPosition({ position, constraints, columns: 12 });

      expect(result.col).toBe(9);
      expect(result.colSpan).toBe(3);
    });

    it('should enforce minimum colSpan', () => {
      const position: GridItemPosition = { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
      const constraints = { minColSpan: 3, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 4 };

      const result = clampPosition({ position, constraints, columns: 12 });

      expect(result.colSpan).toBe(3);
    });
  });

  describe('resolveCollisions', () => {
    it('should push overlapping items down', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } },
        { id: '2', position: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } },
      ];

      const result = resolveCollisions({ entries, movedId: '1', columns: 12 });
      const item2 = result.find((e) => e.id === '2');

      expect(item2?.position.row).toBe(2);
    });

    it('should compact after resolving', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
        { id: '2', position: { col: 4, row: 5, colSpan: 4, rowSpan: 1 } },
      ];

      const result = resolveCollisions({ entries, movedId: '1', columns: 12 });
      const item2 = result.find((e) => e.id === '2');

      expect(item2?.position.row).toBe(0);
    });
  });

  describe('computeGridHeight', () => {
    it('should return 0 for empty layout', () => {
      expect(computeGridHeight([])).toBe(0);
    });

    it('should return max row + rowSpan', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } },
        { id: '2', position: { col: 0, row: 2, colSpan: 4, rowSpan: 3 } },
      ];

      expect(computeGridHeight(entries)).toBe(5);
    });
  });
});
