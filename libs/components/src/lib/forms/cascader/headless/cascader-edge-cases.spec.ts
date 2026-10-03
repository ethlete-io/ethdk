import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { tick } from '../../../testing/driver-core';
import { CascaderDriver, mountCascader } from '../../testing/cascader-driver';
import { CASCADER_IMPORTS } from '../cascader.imports';
import { CascaderDataSource, CascaderNode } from './internals/cascader-tree';

const TREE: Record<string, CascaderNode<string>[]> = {
  __root__: [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Bravo', disabled: true },
    { value: 'c', label: 'Charlie' },
    { value: 'd', label: 'Delta', disabled: true },
  ],
  a: [{ value: 'a1', label: 'Alpha one' }],
  a1: [{ value: 'a1x', label: 'Alpha one x' }],
  a1x: [{ value: 'a1xy', label: 'Alpha one x y', isLeaf: true }],
  c: [{ value: 'c1', label: 'Charlie one', isLeaf: true }],
};

const findPath = (
  value: string,
  key = '__root__',
  ancestors: CascaderNode<string>[] = [],
): CascaderNode<string>[] | null => {
  for (const node of TREE[key] ?? []) {
    const path = [...ancestors, node];

    if (node.value === value) {
      return path;
    }

    const deeper = findPath(value, node.value, path);

    if (deeper) {
      return deeper;
    }
  }

  return null;
};

const source: CascaderDataSource<string> = {
  loadChildren: (parent) => TREE[parent ? parent.value : '__root__'] ?? [],
  resolvePath: (value) => findPath(value),
};

const emptySource: CascaderDataSource<string> = { loadChildren: () => [] };

@Component({
  template: `
    <et-cascader
      [value]="value()"
      [dataSource]="dataSource()"
      [multiple]="multiple()"
      (valueChange)="value.set($event)"
      placeholder="Pick"
    />
  `,
  imports: [CASCADER_IMPORTS],
})
class CascaderEdgeHost {
  value = signal<string | string[] | null>(null);
  multiple = signal(false);
  dataSource = signal<CascaderDataSource<string>>(source);
}

describe('CascaderDirective (null values, empty trees, deep paths)', () => {
  let driver: CascaderDriver<CascaderEdgeHost>;

  const settle = async () => {
    driver.detectChanges();
    tick();
    await driver.settle();
  };

  beforeEach(() => {
    driver = mountCascader(CascaderEdgeHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('starts a multi selection from a null value', async () => {
    driver.host.multiple.set(true);
    await settle();

    expect(driver.cascader.displayValue()).toBeNull();

    await driver.open();
    driver.drillTo(['Charlie', 'Charlie one']);

    expect(driver.host.value()).toEqual(['c1']);
  });

  it('clears a deep breadcrumb when the value is reset to null', async () => {
    driver.host.value.set('a1xy');
    await settle();

    expect(driver.cascader.displayValue()).toBe('Alpha / Alpha one / Alpha one x / Alpha one x y');

    driver.host.value.set(null);
    await settle();

    expect(driver.cascader.displayValue()).toBeNull();
    expect(driver.cascader.path()).toEqual([]);
  });

  it('commits a leaf four levels deep with its full chain', async () => {
    await driver.open();
    driver.drillTo(['Alpha', 'Alpha one', 'Alpha one x', 'Alpha one x y']);

    expect(driver.host.value()).toBe('a1xy');
    expect(driver.cascader.pathValue()).toEqual(['a', 'a1', 'a1x', 'a1xy']);
  });

  it('opens an empty tree without focusing anything', async () => {
    driver.host.dataSource.set(emptySource);
    await settle();
    await driver.open();

    expect(driver.cascader.columns()[0]).toMatchObject({ status: 'loaded', nodes: [] });
    expect(driver.cascader.focusedNode()).toBeNull();
  });

  it('drops the breadcrumb of a value the swapped source no longer has, keeping the value', async () => {
    driver.host.value.set('c1');
    await settle();

    expect(driver.cascader.displayValue()).toBe('Charlie / Charlie one');

    driver.host.dataSource.set({ loadChildren: source.loadChildren, resolvePath: () => null });
    await settle();

    expect(driver.cascader.displayValue()).toBeNull();
    expect(driver.host.value()).toBe('c1');
  });

  it('skips disabled nodes with the arrow keys, Home and End', async () => {
    await driver.open();

    driver.pressOnNode('Alpha', 'ArrowDown');
    tick();
    expect(driver.cascader.focusedNode()?.value).toBe('c');

    driver.pressOnNode('Charlie', 'ArrowDown');
    tick();
    expect(driver.cascader.focusedNode()?.value).toBe('c');

    driver.pressOnNode('Charlie', 'Home');
    tick();
    expect(driver.cascader.focusedNode()?.value).toBe('a');

    driver.pressOnNode('Alpha', 'End');
    tick();
    expect(driver.cascader.focusedNode()?.value).toBe('c');
  });

  it('does not commit or drill into a disabled node', async () => {
    await driver.open();
    driver.clickNode('Bravo');
    driver.pressOnNode('Bravo', 'ArrowRight');
    tick();

    expect(driver.host.value()).toBeNull();
    expect(driver.cascader.columns().length).toBe(1);
  });
});
