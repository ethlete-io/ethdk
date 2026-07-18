import { firstValueFrom, of } from 'rxjs';
import {
  CascaderNode,
  canHaveChildren,
  defaultCompareWith,
  indexOfNode,
  nodesEqual,
  toChildrenObservable,
} from './cascader-tree';

const node = (value: string, extra: Partial<CascaderNode<string>> = {}): CascaderNode<string> => ({
  value,
  label: value.toUpperCase(),
  ...extra,
});

describe('cascader-tree', () => {
  describe('canHaveChildren', () => {
    it('is true by default (children discovered lazily)', () => {
      expect(canHaveChildren(node('a'))).toBe(true);
    });

    it('is false for explicit leaves', () => {
      expect(canHaveChildren(node('a', { isLeaf: true }))).toBe(false);
      expect(canHaveChildren(node('a', { hasChildren: false }))).toBe(false);
    });

    it('is true when hasChildren is explicitly true', () => {
      expect(canHaveChildren(node('a', { hasChildren: true }))).toBe(true);
    });
  });

  describe('nodesEqual', () => {
    const compareWith = defaultCompareWith;

    it('compares by value', () => {
      expect(nodesEqual({ a: node('a'), b: node('a'), compareWith })).toBe(true);
      expect(nodesEqual({ a: node('a'), b: node('b'), compareWith })).toBe(false);
    });

    it('is false when either side is null', () => {
      expect(nodesEqual({ a: null, b: node('a'), compareWith })).toBe(false);
      expect(nodesEqual({ a: node('a'), b: null, compareWith })).toBe(false);
    });

    it('honors a custom comparator', () => {
      const nodes = [node('1'), node('2')];
      const byLoose = (a: string, b: string) => Number(a) === Number(b);

      expect(nodesEqual({ a: { value: '01', label: '' }, b: nodes[0]!, compareWith: byLoose })).toBe(true);
    });
  });

  describe('indexOfNode', () => {
    const compareWith = defaultCompareWith;
    const nodes = [node('a'), node('b'), node('c')];

    it('finds a node by value', () => {
      expect(indexOfNode({ nodes, node: node('b'), compareWith })).toBe(1);
    });

    it('returns -1 for a missing or null node', () => {
      expect(indexOfNode({ nodes, node: node('z'), compareWith })).toBe(-1);
      expect(indexOfNode({ nodes, node: null, compareWith })).toBe(-1);
    });
  });

  describe('toChildrenObservable', () => {
    it('wraps a sync array into a single emission', async () => {
      const nodes = [node('a')];

      await expect(firstValueFrom(toChildrenObservable(nodes))).resolves.toBe(nodes);
    });

    it('wraps a promise', async () => {
      const nodes = [node('a')];

      await expect(firstValueFrom(toChildrenObservable(Promise.resolve(nodes)))).resolves.toBe(nodes);
    });

    it('passes an observable through', async () => {
      const nodes = [node('a')];

      await expect(firstValueFrom(toChildrenObservable(of(nodes)))).resolves.toBe(nodes);
    });
  });
});
