import { describe, expect, it } from 'vitest';
import { resolveBreakpoint, mapLayoutToBreakpoint, DEFAULT_BREAKPOINTS } from './responsive';
import { GridBreakpointConfig, GridLayoutEntry } from '../grid.types';

describe('responsive', () => {
  describe('resolveBreakpoint', () => {
    it('should resolve to lg for wide containers', () => {
      expect(resolveBreakpoint(DEFAULT_BREAKPOINTS, 1400)).toBe('lg');
    });

    it('should resolve to md for medium containers', () => {
      expect(resolveBreakpoint(DEFAULT_BREAKPOINTS, 900)).toBe('md');
    });

    it('should resolve to sm for narrow containers', () => {
      expect(resolveBreakpoint(DEFAULT_BREAKPOINTS, 400)).toBe('sm');
    });

    it('should resolve to the exact boundary', () => {
      expect(resolveBreakpoint(DEFAULT_BREAKPOINTS, 1200)).toBe('lg');
      expect(resolveBreakpoint(DEFAULT_BREAKPOINTS, 768)).toBe('md');
      expect(resolveBreakpoint(DEFAULT_BREAKPOINTS, 0)).toBe('sm');
    });

    it('should use custom breakpoints', () => {
      const custom: GridBreakpointConfig[] = [
        { name: 'xl', columns: 16, minWidth: 1600 },
        { name: 'lg', columns: 12, minWidth: 1000 },
        { name: 'sm', columns: 4, minWidth: 0 },
      ];

      expect(resolveBreakpoint(custom, 1600)).toBe('xl');
      expect(resolveBreakpoint(custom, 1200)).toBe('lg');
      expect(resolveBreakpoint(custom, 500)).toBe('sm');
    });
  });

  describe('mapLayoutToBreakpoint', () => {
    it('should return entries unchanged when target has more columns', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 2 } }];

      const result = mapLayoutToBreakpoint({ entries, fromColumns: 6, toColumns: 12 });

      expect(result).toEqual(entries);
    });

    it('should reflow items into fewer columns', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 6, rowSpan: 1 } },
        { id: '2', position: { col: 6, row: 0, colSpan: 6, rowSpan: 1 } },
      ];

      const result = mapLayoutToBreakpoint({ entries, fromColumns: 12, toColumns: 6 });

      expect(result[0]?.position.col).toBe(0);
      expect(result[0]?.position.colSpan).toBe(6);
      expect(result[1]?.position.row).toBe(1);
      expect(result[1]?.position.colSpan).toBe(6);
    });

    it('should clamp colSpan to target columns', () => {
      const entries: GridLayoutEntry[] = [{ id: '1', position: { col: 0, row: 0, colSpan: 8, rowSpan: 1 } }];

      const result = mapLayoutToBreakpoint({ entries, fromColumns: 12, toColumns: 4 });

      expect(result[0]?.position.colSpan).toBe(4);
    });

    it('should maintain order when reflowing', () => {
      const entries: GridLayoutEntry[] = [
        { id: '1', position: { col: 0, row: 0, colSpan: 4, rowSpan: 1 } },
        { id: '2', position: { col: 4, row: 0, colSpan: 4, rowSpan: 1 } },
        { id: '3', position: { col: 8, row: 0, colSpan: 4, rowSpan: 1 } },
      ];

      const result = mapLayoutToBreakpoint({ entries, fromColumns: 12, toColumns: 2 });

      expect(result[0]?.id).toBe('1');
      expect(result[1]?.id).toBe('2');
      expect(result[2]?.id).toBe('3');
      const row0 = result[0]?.position.row ?? 0;
      const row1 = result[1]?.position.row ?? 0;
      const row2 = result[2]?.position.row ?? 0;
      expect(row0).toBeLessThan(row1);
      expect(row1).toBeLessThan(row2);
    });
  });
});
