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

      const result = compactLayout({ entries, columns: 12 });

      expect(result[0]?.position.row).toBe(0);
    });

    it('should not move items through each other', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 2, rowSpan: 2 } },
        { id: '2', position: { col: 0, row: 5, colSpan: 2, rowSpan: 1 } },
      ];

      const result = compactLayout({ entries, columns: 12 });
      const item2 = result.find((e) => e.id === '2');

      expect(item2?.position.row).toBe(2);
    });

    it('should allow side-by-side items at the same row', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
        { id: '2', position: { col: 4, row: 5, colSpan: 4, rowSpan: 1 } },
      ];

      const result = compactLayout({ entries, columns: 12 });
      const item2 = result.find((e) => e.id === '2');

      expect(item2?.position.row).toBe(0);
    });

    it('should clamp horizontally out-of-bounds positions into the grid', () => {
      // colSpan 12 / col 8 are 12-column values rendered in a 6-column grid (stale breakpoint data).
      const entries: GridLayoutEntry[] = [
        { id: 'opportunities', position: { col: 8, row: 2, colSpan: 4, rowSpan: 3 } },
      ];

      const result = compactLayout({ entries, columns: 6 });
      const pos = result[0]?.position;

      expect(pos?.col).toBe(2);
      expect(pos?.colSpan).toBe(4);
      expect((pos?.col ?? 0) + (pos?.colSpan ?? 0)).toBeLessThanOrEqual(6);
    });

    it('should never produce overlaps when clamping drops an item onto an occupied cell', () => {
      // Reproduces the resize bug: in a 6-col grid, opportunities sits at col 8 (out of bounds).
      // Clamping alone would slide it to col 2 - straight on top of contacts at col 0.
      const entries: GridLayoutEntry[] = [
        { id: 'managers', position: { col: 0, row: 0, colSpan: 6, rowSpan: 2 } },
        { id: 'contacts', position: { col: 0, row: 2, colSpan: 6, rowSpan: 3 } },
        { id: 'opportunities', position: { col: 8, row: 2, colSpan: 4, rowSpan: 3 } },
      ];

      const result = compactLayout({ entries, columns: 6 });

      // No pair of items may overlap, and every item stays in bounds.
      for (const entry of result) {
        expect(entry.position.col + entry.position.colSpan).toBeLessThanOrEqual(6);

        for (const other of result) {
          if (other.id === entry.id) continue;
          expect(itemsCollide(entry.position, other.position)).toBe(false);
        }
      }
    });

    it('should not pull an item above its row floor', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 1, colSpan: 2, rowSpan: 1 } },
        { id: '2', position: { col: 0, row: 5, colSpan: 2, rowSpan: 1 } },
      ];

      const result = compactLayout({ entries, columns: 12, rowFloors: new Map([['1', 1]]) });

      // Item 1 is floored at row 1; item 2 has no floor and stops right below it.
      expect(result.find((e) => e.id === '1')?.position.row).toBe(1);
      expect(result.find((e) => e.id === '2')?.position.row).toBe(2);
    });

    it('should still allow a floored item to return down to its floor after being pushed', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 4, colSpan: 2, rowSpan: 1 } }];

      const result = compactLayout({ entries, columns: 12, rowFloors: new Map([['1', 2]]) });

      expect(result[0]?.position.row).toBe(2);
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

    it('should cap a minimum colSpan wider than the grid at the column count', () => {
      const position: GridItemPosition = { col: 0, row: 0, colSpan: 1, rowSpan: 1 };
      const constraints = { minColSpan: 3, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 4 };

      const result = clampPosition({ position, constraints, columns: 1 });

      expect(result).toEqual({ col: 0, row: 0, colSpan: 1, rowSpan: 1 });
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

    describe('moving down over other items (escape upward)', () => {
      it('lets a smaller collider escape into the vacated origin instead of undoing the move', () => {
        // A tall item dragged down onto a shorter one below it: previously the short item was
        // pushed down and compaction pulled the tall one straight back to its origin (no-op).
        const entries: GridLayoutEntry[] = [
          { id: 'tall', position: { col: 0, row: 2, colSpan: 4, rowSpan: 2 } },
          { id: 'short', position: { col: 0, row: 2, colSpan: 4, rowSpan: 1 } },
        ];

        const result = resolveCollisions({
          entries,
          movedId: 'tall',
          columns: 12,
          originPosition: { col: 0, row: 0, colSpan: 4, rowSpan: 2 },
        });

        expect(result.find((e) => e.id === 'short')?.position).toEqual({ col: 0, row: 0, colSpan: 4, rowSpan: 1 });
        expect(result.find((e) => e.id === 'tall')?.position).toEqual({ col: 0, row: 1, colSpan: 4, rowSpan: 2 });
      });

      it('resolves the dashboard scenario: a wide item dropped onto a row with two colliders', () => {
        // The default-story layout (12 cols): chart-1 dragged down onto the text/chart-2 row.
        const entries: GridLayoutEntry[] = [
          { id: 'chart-1', position: { col: 0, row: 2, colSpan: 8, rowSpan: 2 } },
          { id: 'table-1', position: { col: 8, row: 0, colSpan: 4, rowSpan: 2 } },
          { id: 'text-1', position: { col: 0, row: 2, colSpan: 5, rowSpan: 2 } },
          { id: 'chart-2', position: { col: 5, row: 2, colSpan: 7, rowSpan: 2 } },
        ];

        const result = resolveCollisions({
          entries,
          movedId: 'chart-1',
          columns: 12,
          originPosition: { col: 0, row: 0, colSpan: 8, rowSpan: 2 },
        });

        // text-1 escapes up into the vacated origin, chart-1 keeps the dropped row,
        // chart-2 (blocked above by table-1) is pushed below.
        expect(result.find((e) => e.id === 'text-1')?.position).toMatchObject({ col: 0, row: 0 });
        expect(result.find((e) => e.id === 'chart-1')?.position).toMatchObject({ col: 0, row: 2 });
        expect(result.find((e) => e.id === 'chart-2')?.position).toMatchObject({ col: 5, row: 4 });
        expect(result.find((e) => e.id === 'table-1')?.position).toMatchObject({ col: 8, row: 0 });
      });

      it('still pushes down when nothing fits above the moved item', () => {
        // Moved only one row down: the collider (rowSpan 2) has no room above row 1,
        // so the previous push-down + compaction behavior applies unchanged.
        const entries: GridLayoutEntry[] = [
          { id: 'tall', position: { col: 0, row: 1, colSpan: 4, rowSpan: 2 } },
          { id: 'other', position: { col: 0, row: 2, colSpan: 4, rowSpan: 2 } },
        ];

        const result = resolveCollisions({
          entries,
          movedId: 'tall',
          columns: 12,
          originPosition: { col: 0, row: 0, colSpan: 4, rowSpan: 2 },
        });

        expect(result.find((e) => e.id === 'tall')?.position.row).toBe(0);
        expect(result.find((e) => e.id === 'other')?.position.row).toBe(2);
      });

      it('does not apply when moving up - colliders are pushed down into the vacated space', () => {
        const entries: GridLayoutEntry[] = [
          { id: 'moved', position: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } },
          { id: 'other', position: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } },
        ];

        const result = resolveCollisions({
          entries,
          movedId: 'moved',
          columns: 12,
          originPosition: { col: 0, row: 2, colSpan: 4, rowSpan: 2 },
        });

        expect(result.find((e) => e.id === 'moved')?.position.row).toBe(0);
        expect(result.find((e) => e.id === 'other')?.position.row).toBe(2);
      });

      it('does not apply without an origin (programmatic layout normalisation)', () => {
        const entries: GridLayoutEntry[] = [
          { id: 'a', position: { col: 0, row: 1, colSpan: 4, rowSpan: 1 } },
          { id: 'b', position: { col: 0, row: 1, colSpan: 4, rowSpan: 1 } },
        ];

        const result = resolveCollisions({ entries, movedId: 'a', columns: 12 });

        // plain push-down + compaction: a first, b below
        expect(result.find((e) => e.id === 'a')?.position.row).toBe(0);
        expect(result.find((e) => e.id === 'b')?.position.row).toBe(1);
      });
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
