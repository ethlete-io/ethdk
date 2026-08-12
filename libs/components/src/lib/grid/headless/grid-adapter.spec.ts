import { describe, expect, it } from 'vitest';
import { createGridAdapter, fromGridPosition, mapGridLayout, toGridPosition } from './grid-adapter';
import { GridItemConfig } from './grid.types';

type BackendPosition = { x: number; y: number; cols: number; rows: number };

type BackendWidget = {
  uuid: string;
  kind: string;
  title: string;
  layout: { lg: BackendPosition; md: BackendPosition; sm: BackendPosition };
};

const createAdapter = () =>
  createGridAdapter({
    breakpoints: {
      lg: { columns: 12, minWidth: 1200 },
      md: { columns: 6, minWidth: 768 },
      sm: { columns: 2, minWidth: 0 },
    },
    fromExternal: (widget: BackendWidget) => ({
      id: widget.uuid,
      type: widget.kind,
      data: { title: widget.title },
      layout: mapGridLayout(widget.layout, toGridPosition),
    }),
    toExternal: (item) => ({
      uuid: item.id,
      kind: item.type,
      title: item.data.title,
      layout: mapGridLayout(item.layout, fromGridPosition),
    }),
  });

const WIDGET: BackendWidget = {
  uuid: 'widget-1',
  kind: 'team',
  title: 'Team Members',
  layout: {
    lg: { x: 1, y: 0, cols: 4, rows: 2 },
    md: { x: 2, y: 0, cols: 4, rows: 3 },
    sm: { x: 0, y: 3, cols: 1, rows: 2 },
  },
};

describe('grid adapter', () => {
  describe('mapGridLayout', () => {
    it('should map every breakpoint and keep the keys', () => {
      const mapped = mapGridLayout(WIDGET.layout, toGridPosition);

      expect(mapped).toEqual({
        lg: { col: 1, row: 0, colSpan: 4, rowSpan: 2 },
        md: { col: 2, row: 0, colSpan: 4, rowSpan: 3 },
        sm: { col: 0, row: 3, colSpan: 1, rowSpan: 2 },
      });
    });

    it('should pass the breakpoint name to the mapper', () => {
      const seen = mapGridLayout(WIDGET.layout, (_, breakpoint) => breakpoint);

      expect(seen).toEqual({ lg: 'lg', md: 'md', sm: 'sm' });
    });
  });

  describe('breakpoints', () => {
    it('should expose the declared breakpoints as grid breakpoint configs', () => {
      expect(createAdapter().breakpoints).toEqual([
        { name: 'lg', columns: 12, minWidth: 1200 },
        { name: 'md', columns: 6, minWidth: 768 },
        { name: 'sm', columns: 2, minWidth: 0 },
      ]);
    });
  });

  describe('fromExternal / toExternal', () => {
    it('should round trip a widget unchanged', () => {
      const adapter = createAdapter();

      expect(adapter.toExternal(adapter.fromExternal([WIDGET]))).toEqual([WIDGET]);
    });

    it('should map into grid item configs', () => {
      const items = createAdapter().fromExternal([WIDGET]);

      expect(items).toEqual([
        {
          id: 'widget-1',
          type: 'team',
          data: { title: 'Team Members' },
          layout: {
            lg: { col: 1, row: 0, colSpan: 4, rowSpan: 2 },
            md: { col: 2, row: 0, colSpan: 4, rowSpan: 3 },
            sm: { col: 0, row: 3, colSpan: 1, rowSpan: 2 },
          },
        },
      ]);
    });

    it('should map an item the grid has not placed yet to an empty layout', () => {
      const unplaced: GridItemConfig<string, { title: string }> = {
        id: 'widget-1',
        type: 'team',
        data: { title: 'Team Members' },
        layout: {},
      };

      expect(createAdapter().toExternal([unplaced])[0]?.layout).toEqual({});
    });
  });
});
