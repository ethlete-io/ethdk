import { describe, expect, it } from 'vitest';
import { serializeGridLayout, deserializeGridLayout } from './serialization';
import { GridBreakpointConfig, GridItemConfig, GridSerializedState } from '../grid.types';

describe('serialization', () => {
  const breakpoints: GridBreakpointConfig[] = [
    { name: 'lg', columns: 12, minWidth: 1200 },
    { name: 'md', columns: 6, minWidth: 768 },
    { name: 'sm', columns: 2, minWidth: 0 },
  ];

  const items: GridItemConfig[] = [
    {
      id: 'item-1',
      componentType: 'chart',
      layout: {
        lg: { col: 0, row: 0, colSpan: 4, rowSpan: 2 },
        md: { col: 0, row: 0, colSpan: 3, rowSpan: 2 },
      },
      constraints: { minColSpan: 2, maxColSpan: 8, minRowSpan: 1, maxRowSpan: 4 },
    },
    {
      id: 'item-2',
      componentType: 'table',
      layout: {
        lg: { col: 4, row: 0, colSpan: 4, rowSpan: 2 },
      },
      constraints: { minColSpan: 2, maxColSpan: 6, minRowSpan: 1, maxRowSpan: 3 },
    },
  ];

  describe('serializeGridLayout', () => {
    it('should produce a valid serialized state', () => {
      const result = serializeGridLayout({ items, breakpoints, rowHeight: 100 });

      expect(result.columns).toEqual({ lg: 12, md: 6, sm: 2 });
      expect(result.rowHeight).toBe(100);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.id).toBe('item-1');
      expect(result.items[0]?.componentType).toBe('chart');
      expect(result.items[0]?.layout.lg).toEqual({ col: 0, row: 0, colSpan: 4, rowSpan: 2 });
      expect(result.items[0]?.constraints.minColSpan).toBe(2);
    });

    it('should be JSON-serializable', () => {
      const result = serializeGridLayout({ items, breakpoints, rowHeight: 100 });
      const json = JSON.stringify(result);
      const parsed = JSON.parse(json);

      expect(parsed).toEqual(result);
    });
  });

  describe('deserializeGridLayout', () => {
    it('should round-trip serialize and deserialize', () => {
      const serialized = serializeGridLayout({ items, breakpoints, rowHeight: 100 });
      const minWidths = { lg: 1200, md: 768, sm: 0 };
      const deserialized = deserializeGridLayout(serialized, minWidths);

      expect(deserialized.rowHeight).toBe(100);
      expect(deserialized.breakpoints).toHaveLength(3);
      expect(deserialized.items).toHaveLength(2);
      expect(deserialized.items[0]?.id).toBe('item-1');
      expect(deserialized.items[0]?.layout.lg).toEqual({ col: 0, row: 0, colSpan: 4, rowSpan: 2 });
    });

    it('should reconstruct breakpoint configs with minWidth', () => {
      const state: GridSerializedState = {
        columns: { lg: 12, md: 6 },
        rowHeight: 120,
        items: [],
      };

      const result = deserializeGridLayout(state, { lg: 1200, md: 768 });

      expect(result.breakpoints).toContainEqual({ name: 'lg', columns: 12, minWidth: 1200 });
      expect(result.breakpoints).toContainEqual({ name: 'md', columns: 6, minWidth: 768 });
    });

    it('should default minWidth to 0 for unknown breakpoints', () => {
      const state: GridSerializedState = {
        columns: { custom: 8 },
        rowHeight: 100,
        items: [],
      };

      const result = deserializeGridLayout(state, {});

      expect(result.breakpoints[0]?.minWidth).toBe(0);
    });
  });
});
