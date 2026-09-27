import { Component } from '@angular/core';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import '../../../test-helpers';
import { CascaderDriver, mountCascader } from '../testing/cascader-driver';
import { CascaderDataSource, CascaderNode } from './headless/internals/cascader-tree';
import { CASCADER_IMPORTS } from './cascader.imports';

const TREE: Record<string, CascaderNode<string>[]> = {
  __root__: [
    { value: 'team-a', label: 'Team A', isLeaf: true },
    { value: 'team-b', label: 'Team B', isLeaf: true },
  ],
};

@Component({
  template: `<et-cascader [dataSource]="dataSource" placeholder="Pick a team" />`,
  imports: [CASCADER_IMPORTS],
})
class CascaderFocusRingTestHost {
  dataSource: CascaderDataSource<string> = {
    loadChildren: (parent) => TREE[parent ? parent.value : '__root__'] ?? [],
  };
}

describe('cascader node focus ring', () => {
  let driver: CascaderDriver<CascaderFocusRingTestHost>;

  beforeEach(() => {
    driver = mountCascader(CascaderFocusRingTestHost);
  });

  afterEach(() => {
    driver.closeAndRemovePanes();
  });

  it('gives every node the shared focus ring', async () => {
    await driver.open();

    const nodes = driver.nodesIn(0);

    expect(nodes).toHaveLength(2);
    expect(nodes.every((node) => node.classList.contains('et-focus-ring'))).toBe(true);
  });

  it('does not suppress the ring outline in the panel stylesheet', () => {
    const css = readFileSync(fileURLToPath(import.meta.url).replace(/[^/]+$/, 'cascader-panel.component.css'), 'utf8');
    const nodeRule = css.slice(css.indexOf('.et-cascader-node,'), css.indexOf('.et-cascader-node-label'));

    expect(nodeRule).not.toMatch(/outline:\s*none/);
  });
});
