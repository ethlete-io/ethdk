import { Component, signal } from '@angular/core';
import '../../../../test-helpers';
import { flushFrames, tick } from '../../../testing/driver-core';
import { CascaderDriver, mountCascader } from '../../testing/cascader-driver';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { CASCADER_IMPORTS } from '../cascader.imports';
import { CascaderDataSource, CascaderNode } from './internals/cascader-tree';

// competition → stage → tournament, three levels, synchronous
const TREE: Record<string, CascaderNode<string>[]> = {
  __root__: [
    { value: 'euro', label: 'Euro' },
    { value: 'world', label: 'World Cup' },
    { value: 'empty-comp', label: 'Empty competition' },
  ],
  euro: [
    { value: 'euro-group', label: 'Group stage' },
    { value: 'euro-ko', label: 'Knockout' },
  ],
  'euro-group': [
    { value: 'euro-group-a', label: 'Group A', isLeaf: true },
    { value: 'euro-group-b', label: 'Group B', isLeaf: true },
  ],
  world: [{ value: 'world-final', label: 'Final', isLeaf: true }],
  'empty-comp': [],
};

const syncSource: CascaderDataSource<string> = {
  loadChildren: (parent) => TREE[parent ? parent.value : '__root__'] ?? [],
};

// flat search over the static tree: a depth-first walk collecting every matching path
const searchTree = (query: string): CascaderNode<string>[][] => {
  const results: CascaderNode<string>[][] = [];
  const needle = query.toLowerCase();

  const walk = (key: string, ancestors: CascaderNode<string>[]) => {
    for (const node of TREE[key] ?? []) {
      const path = [...ancestors, node];

      if (node.label.toLowerCase().includes(needle)) {
        results.push(path);
      }

      walk(node.value, path);
    }
  };

  walk('__root__', []);

  return results;
};

const searchableSource: CascaderDataSource<string> = {
  loadChildren: syncSource.loadChildren,
  search: (query) => searchTree(query),
};

// a generated six-level hierarchy, deeper than the default column window
const DEEP_LEVEL_NAMES = ['Region', 'Country', 'League', 'Club', 'Team', 'Player'];

const deepSource: CascaderDataSource<string> = {
  loadChildren: (parent) => {
    const depth = parent ? parent.value.split('/').length : 0;
    const name = DEEP_LEVEL_NAMES[depth]!;

    // Deliberately not template literals: an interpolated one above the inline template below
    // breaks Angular language service completions there. See
    // `ethlete/no-template-literal-before-inline-template`.
    return Array.from({ length: 3 }, (_, index) => ({
      value: parent ? parent.value + '/' + index : String(index),
      label: name + ' ' + (index + 1),
      isLeaf: depth === DEEP_LEVEL_NAMES.length - 1,
    }));
  },
};

@Component({
  template: `
    <et-cascader
      [value]="value()"
      [mixed]="mixed()"
      [dataSource]="dataSource()"
      [selectableLevels]="selectableLevels()"
      [disabled]="disabled()"
      [multiple]="multiple()"
      [maxVisibleColumns]="maxVisibleColumns()"
      (valueChange)="value.set($event)"
      (mixedChange)="mixed.set($event)"
      (touchedChange)="touched.set($event)"
      placeholder="Pick a match"
    />
  `,
  imports: [CASCADER_IMPORTS],
})
class CascaderTestHost {
  value = signal<string | string[] | null>(null);
  mixed = signal(false);
  touched = signal(false);
  disabled = signal(false);
  multiple = signal(false);
  maxVisibleColumns = signal(3);
  selectableLevels = signal<'leaf' | 'any'>('leaf');
  dataSource = signal<CascaderDataSource<string>>(syncSource);
}

describe('CascaderDirective', () => {
  let driver: CascaderDriver<CascaderTestHost>;

  beforeEach(() => {
    driver = mountCascader(CascaderTestHost);
  });

  afterEach(async () => {
    await driver.close();
  });

  it('renders a closed combobox trigger with a tree popup', () => {
    expect(driver.trigger().getAttribute('role')).toBe('combobox');
    expect(driver.trigger().getAttribute('aria-haspopup')).toBe('tree');
    expect(driver.trigger().getAttribute('aria-expanded')).toBe('false');
  });

  it('loads the root column on open', async () => {
    await driver.open();

    expect(driver.trigger().getAttribute('aria-expanded')).toBe('true');
    expect(driver.columns().length).toBe(1);
    expect(driver.nodesIn(0).map((node) => node.textContent?.trim())).toEqual([
      'Euro',
      'World Cup',
      'Empty competition',
    ]);
    // branch nodes advertise their expandability
    expect(driver.nodesIn(0)[0]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('drills into a branch, opening a second column', async () => {
    await driver.open();
    driver.clickNode('Euro');

    expect(driver.columns().length).toBe(2);
    expect(driver.nodesIn(1).map((node) => node.textContent?.trim())).toEqual(['Group stage', 'Knockout']);
    expect(driver.nodeByLabel('Euro')!.getAttribute('aria-expanded')).toBe('true');
    // a branch click does not commit in leaf mode
    expect(driver.host.value()).toBeNull();
  });

  it('commits a leaf value and closes', async () => {
    await driver.open();
    driver.clickNode('Euro');
    driver.clickNode('Group stage');
    driver.clickNode('Group A');
    await flushFrames();

    expect(driver.host.value()).toBe('euro-group-a');
    expect(driver.cascader.pathValue()).toEqual(['euro', 'euro-group', 'euro-group-a']);
    expect(driver.cascader.open()).toBe(false);
  });

  it('shows the breadcrumb of the committed path on the trigger', async () => {
    await driver.open();
    driver.clickNode('World Cup');
    driver.clickNode('Final');
    await flushFrames();

    expect(driver.cascader.displayValue()).toBe('World Cup / Final');
    expect(driver.trigger().textContent).toContain('World Cup / Final');
  });

  it('re-truncates deeper columns when a shallower branch is re-picked', async () => {
    await driver.open();
    driver.clickNode('Euro');
    driver.clickNode('Group stage');
    expect(driver.columns().length).toBe(3);

    // drilling a different root branch collapses back to two columns
    driver.clickNode('World Cup');

    expect(driver.columns().length).toBe(2);
    expect(driver.nodesIn(1).map((node) => node.textContent?.trim())).toEqual(['Final']);
  });

  it('keeps the deeper columns when a level resolves after its own child', async () => {
    await driver.open();
    driver.clickNode('Euro');
    driver.clickNode('Group stage');
    driver.clickNode('Group A');
    await flushFrames();

    const pending = new Map<string, (nodes: CascaderNode<string>[]) => void>();
    const outOfOrderSource: CascaderDataSource<string> = {
      loadChildren: (parent) =>
        new Promise<CascaderNode<string>[]>((resolve) => pending.set(parent ? parent.value : '__root__', resolve)),
    };

    const settle = async (key: string) => {
      pending.get(key)!(TREE[key] ?? []);
      await Promise.resolve();
      await Promise.resolve();
      tick();
    };

    driver.host.dataSource.set(outOfOrderSource);
    driver.detectChanges();

    // re-opening onto the committed branch starts all three levels at once
    await driver.open();
    await flushFrames();

    // the deepest level answers first, the root last
    await settle('euro-group');
    await settle('euro');
    await settle('__root__');

    expect(driver.cascader.columns().length).toBe(3);
    expect(driver.nodeLabels(0)).toEqual(['Euro', 'World Cup', 'Empty competition']);
    expect(driver.nodeLabels(2)).toEqual(['Group A', 'Group B']);
  });

  it('drops the committed breadcrumb when the value is replaced from outside', async () => {
    await driver.open();
    driver.clickNode('World Cup');
    driver.clickNode('Final');
    await flushFrames();

    expect(driver.cascader.displayValue()).toBe('World Cup / Final');

    driver.host.value.set('euro-group-a');
    driver.detectChanges();
    tick();

    expect(driver.cascader.displayValue()).toBeNull();
    expect(driver.cascader.path()).toEqual([]);
  });

  it('commits an intermediate branch in any-level mode without closing', async () => {
    driver.host.selectableLevels.set('any');
    driver.detectChanges();

    await driver.open();
    driver.clickNode('Euro');

    expect(driver.host.value()).toBe('euro');
    expect(driver.cascader.open()).toBe(true);
    expect(driver.columns().length).toBe(2);
  });

  it('shows an empty state for a branch with no children', async () => {
    await driver.open();
    driver.clickNode('Empty competition');

    expect(driver.columns()[1]!.textContent).toContain('No options');
  });

  it('moves roving focus within and across columns with the keyboard', async () => {
    await driver.open();
    driver.pressOnNode('Euro', 'ArrowDown');
    expect(driver.cascader.focusedNode()?.value).toBe('world');

    driver.pressOnNode('Euro', 'ArrowUp');
    expect(driver.cascader.focusedNode()?.value).toBe('euro');

    // ArrowRight drills into the focused branch
    driver.pressOnNode('Euro', 'ArrowRight');
    await flushFrames();
    expect(driver.columns().length).toBe(2);
    expect(driver.cascader.focusedNode()?.value).toBe('euro-group');
    expect(driver.cascader.focusedColumn()).toBe(1);
  });

  it('does not commit or open while disabled', async () => {
    driver.host.disabled.set(true);
    driver.detectChanges();

    await driver.open();

    expect(driver.cascader.open()).toBe(false);
    expect(driver.pane()).toBeNull();
  });

  it('clears the value', async () => {
    await driver.open();
    driver.clickNode('World Cup');
    driver.clickNode('Final');
    await flushFrames();
    expect(driver.host.value()).toBe('world-final');

    driver.cascader.clearValue();
    tick();

    expect(driver.host.value()).toBeNull();
    expect(driver.cascader.pathValue()).toEqual([]);
  });

  describe('multiple', () => {
    beforeEach(() => {
      driver.host.multiple.set(true);
      driver.detectChanges();
    });

    it('toggles leaf values without closing the panel', async () => {
      await driver.open();
      driver.clickNode('Euro');
      driver.clickNode('Group stage');
      driver.clickNode('Group A');

      expect(driver.host.value()).toEqual(['euro-group-a']);
      expect(driver.cascader.open()).toBe(true);

      driver.clickNode('Group B');

      expect(driver.host.value()).toEqual(['euro-group-a', 'euro-group-b']);

      // a second activation of a selected node deselects it
      driver.clickNode('Group A');

      expect(driver.host.value()).toEqual(['euro-group-b']);
    });

    it('marks ancestors of a selection indeterminate, not selected', async () => {
      await driver.open();
      driver.clickNode('Euro');
      driver.clickNode('Group stage');
      driver.clickNode('Group A');

      expect(driver.nodeByLabel('Group A')!.getAttribute('data-selected')).toBe('true');
      expect(driver.nodeByLabel('Group stage')!.getAttribute('data-indeterminate')).toBe('true');
      expect(driver.nodeByLabel('Euro')!.getAttribute('data-indeterminate')).toBe('true');
      expect(driver.nodeByLabel('Euro')!.hasAttribute('data-selected')).toBe(false);
      expect(driver.nodeByLabel('World Cup')!.hasAttribute('data-indeterminate')).toBe(false);

      // deselecting removes the ancestors' dash again
      driver.clickNode('Group A');

      expect(driver.nodeByLabel('Group stage')!.hasAttribute('data-indeterminate')).toBe(false);
      expect(driver.nodeByLabel('Euro')!.hasAttribute('data-indeterminate')).toBe(false);
    });

    it('promotes an ancestor to selected once all its loaded descendants are checked', async () => {
      await driver.open();
      driver.clickNode('Euro');
      driver.clickNode('Group stage');
      driver.clickNode('Group A');
      driver.clickNode('Group B');

      // every leaf under "Group stage" is checked - full check, not the dash
      expect(driver.nodeByLabel('Group stage')!.getAttribute('data-selected')).toBe('true');
      expect(driver.nodeByLabel('Group stage')!.hasAttribute('data-indeterminate')).toBe(false);

      // "Euro" also holds the (unselected) "Knockout" branch - still just indeterminate
      expect(driver.nodeByLabel('Euro')!.getAttribute('data-indeterminate')).toBe('true');
      expect(driver.nodeByLabel('Euro')!.hasAttribute('data-selected')).toBe(false);

      // the promotion is display-only - the value stays the exact leaves
      expect(driver.host.value()).toEqual(['euro-group-a', 'euro-group-b']);

      // unchecking a leaf drops the ancestor back to the dash
      driver.clickNode('Group A');

      expect(driver.nodeByLabel('Group stage')!.hasAttribute('data-selected')).toBe(false);
      expect(driver.nodeByLabel('Group stage')!.getAttribute('data-indeterminate')).toBe('true');
    });

    it('promotes a single-child ancestor and keeps the promotion after navigating away', async () => {
      await driver.open();
      driver.clickNode('World Cup');
      driver.clickNode('Final');

      expect(driver.nodeByLabel('World Cup')!.getAttribute('data-selected')).toBe('true');
      expect(driver.nodeByLabel('World Cup')!.hasAttribute('data-indeterminate')).toBe(false);

      // drilling into another branch truncates the columns, but the loaded child lists are
      // remembered - "World Cup" must not fall back to indeterminate
      driver.clickNode('Euro');

      expect(driver.nodeByLabel('World Cup')!.getAttribute('data-selected')).toBe('true');
    });

    it('joins the selected labels on the trigger', async () => {
      await driver.open();
      driver.clickNode('Euro');
      driver.clickNode('Group stage');
      driver.clickNode('Group A');
      driver.clickNode('Group B');

      expect(driver.cascader.displayValue()).toBe('Group A, Group B');
    });

    it('toggles branches too in any-level mode (while still drilling)', async () => {
      driver.host.selectableLevels.set('any');
      driver.detectChanges();

      await driver.open();
      driver.clickNode('Euro');

      expect(driver.host.value()).toEqual(['euro']);
      expect(driver.columns().length).toBe(2);

      driver.clickNode('Euro');

      expect(driver.host.value()).toEqual([]);
    });

    it('clears to an empty array', async () => {
      await driver.open();
      driver.clickNode('World Cup');
      driver.clickNode('Final');
      expect(driver.host.value()).toEqual(['world-final']);

      driver.cascader.clearValue();
      tick();

      expect(driver.host.value()).toEqual([]);
      expect(driver.cascader.hasValue()).toBe(false);
    });

    it('reports the tree as multiselectable', async () => {
      await driver.open();

      expect(driver.panel()?.getAttribute('aria-multiselectable')).toBe('true');
    });

    it('resolves programmatically set values through resolvePath', async () => {
      const resolvingSource: CascaderDataSource<string> = {
        loadChildren: syncSource.loadChildren,
        resolvePath: (value) => searchTree('').find((path) => path[path.length - 1]?.value === value) ?? null,
      };

      driver.host.dataSource.set(resolvingSource);
      driver.host.value.set(['euro-group-b']);
      driver.detectChanges();
      tick();
      await driver.settle();

      expect(driver.cascader.displayValue()).toBe('Group B');

      await driver.open();

      expect(driver.nodeByLabel('Euro')!.getAttribute('data-indeterminate')).toBe('true');
    });

    it('toggles search results while keeping the panel and query alive', async () => {
      driver.host.dataSource.set(searchableSource);
      driver.detectChanges();

      await driver.open();

      await driver.type('group');

      // result 0 is the "Group stage" branch (re-roots in leaf mode) - toggle the "Group A" leaf
      const leafOption = driver.results().find((option) => option.textContent!.includes('Group A'))!;

      driver.click(leafOption);

      expect(driver.host.value()).toEqual(['euro-group-a']);
      expect(driver.cascader.open()).toBe(true);
      expect(driver.cascader.searchQuery()).toBe('group');
      expect(leafOption.getAttribute('data-selected')).toBe('true');

      driver.click(leafOption);

      expect(driver.host.value()).toEqual([]);
    });
  });

  describe('flat search', () => {
    beforeEach(async () => {
      driver.host.dataSource.set(searchableSource);
      driver.detectChanges();
      await driver.open();
    });

    it('renders a search input only when the data source has a search hook', async () => {
      expect(driver.searchInput()).toBeTruthy();

      driver.cascader.hide();
      tick();
      await flushFrames();

      driver.host.dataSource.set(syncSource);
      driver.detectChanges();
      await driver.open();

      expect(driver.searchInput()).toBeNull();
    });

    it('swaps the columns for a flat result list while a query is active', async () => {
      await driver.type('group a');

      expect(driver.columns().length).toBe(0);
      expect(driver.results().length).toBe(1);
      expect(driver.results()[0]!.textContent?.replace(/\s+/g, ' ').trim()).toBe('Euro / Group stage / Group A');
      // the panel reports itself as the listbox owning the options
      expect(driver.panel()?.getAttribute('role')).toBe('listbox');

      await driver.type('');

      expect(driver.results().length).toBe(0);
      expect(driver.columns().length).toBeGreaterThan(0);
    });

    it('commits a leaf result with its full path and closes', async () => {
      await driver.type('group a');

      driver.clickResult(0);
      await flushFrames();

      expect(driver.host.value()).toBe('euro-group-a');
      expect(driver.cascader.pathValue()).toEqual(['euro', 'euro-group', 'euro-group-a']);
      expect(driver.cascader.open()).toBe(false);
    });

    it('re-roots the columns onto a branch-only match instead of committing (leaf mode)', async () => {
      await driver.type('knockout');

      driver.clickResult(0);
      await driver.settle();

      expect(driver.host.value()).toBeNull();
      expect(driver.cascader.open()).toBe(true);
      expect(driver.cascader.searchQuery()).toBe('');
      // root, Euro's children, Knockout's (empty) children
      expect(driver.columns().length).toBe(3);
      expect(driver.nodeByLabel('Knockout')!.getAttribute('aria-expanded')).toBe('true');
    });

    it('clears the query on the first Escape and closes on the second', async () => {
      await driver.type('group');
      expect(driver.results().length).toBeGreaterThan(0);

      driver.escape();
      await flushFrames();

      expect(driver.cascader.open()).toBe(true);
      expect(driver.cascader.searchQuery()).toBe('');

      driver.escape();
      await flushFrames();

      expect(driver.cascader.open()).toBe(false);
    });

    it('routes typing on a focused node into the search input', async () => {
      driver.pressOnNode('Euro', 'g');
      await driver.settle();

      expect(driver.cascader.searchQuery()).toBe('g');
      expect(document.activeElement).toBe(driver.searchInput());
    });

    it('leaves Space to the focused node instead of typing it into the search input', async () => {
      const event = driver.pressOnNode('Euro', ' ');
      await driver.settle();

      expect(event.defaultPrevented).toBe(false);
      expect(driver.cascader.searchQuery()).toBe('');
    });

    it('moves roving focus from the input into the results and back', async () => {
      await driver.type('group');

      const input = driver.searchInput()!;

      driver.pressInSearch('ArrowDown');
      expect(driver.cascader.focusedSearchIndex()).toBe(0);

      driver.pressOnResult(0, 'ArrowDown');
      expect(driver.cascader.focusedSearchIndex()).toBe(1);

      driver.pressOnResult(1, 'ArrowUp');
      driver.pressOnResult(0, 'ArrowUp');

      expect(driver.cascader.focusedSearchIndex()).toBe(-1);
      expect(document.activeElement).toBe(input);
    });

    it('Enter in the input activates the first result', async () => {
      await driver.type('final');

      driver.pressInSearch('Enter');
      await flushFrames();

      expect(driver.host.value()).toBe('world-final');
      expect(driver.cascader.open()).toBe(false);
    });

    it('surfaces a search error with a retry control', async () => {
      let attempts = 0;
      const flaky: CascaderDataSource<string> = {
        loadChildren: syncSource.loadChildren,
        search: (query) => {
          attempts += 1;

          return attempts === 1 ? Promise.reject(new Error('boom')) : searchTree(query);
        },
      };

      driver.host.dataSource.set(flaky);
      driver.detectChanges();

      await driver.type('group');
      await Promise.resolve();
      await Promise.resolve();
      tick();

      expect(driver.paneEl('.et-cascader-results .et-cascader-state--error')).toBeTruthy();

      driver.clickInPane('.et-cascader-results .et-cascader-state--error button');
      await driver.settle();

      expect(driver.results().length).toBeGreaterThan(0);
    });

    it('shows an empty state when nothing matches', async () => {
      await driver.type('zzz');

      expect(driver.results().length).toBe(0);
      expect(driver.paneEl('.et-cascader-results')?.textContent).toContain('No matches');
    });
  });

  describe('deep nesting', () => {
    const offstage = (columnIndex: number) =>
      driver.columns()[columnIndex]?.classList.contains('et-cascader-column--offstage') ?? false;
    const trackStyle = () => driver.paneEl('.et-cascader-columns-track')?.getAttribute('style');

    beforeEach(async () => {
      driver.host.dataSource.set(deepSource);
      driver.detectChanges();
      await driver.open();
    });

    it('collapses older levels into breadcrumbs once the drill exceeds the window', async () => {
      driver.drillTo(['Region 1', 'Country 1', 'League 1']);

      // four levels are drilled - all stay mounted on the track, the root slides offstage
      expect(driver.cascader.columns().length).toBe(4);
      expect(driver.columns().length).toBe(4);
      expect(driver.cascader.visibleColumnStart()).toBe(1);
      // the row shows the FULL drilled trail, not just the levels hidden on the left
      expect(driver.crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1']);
      expect([offstage(0), offstage(1), offstage(2), offstage(3)]).toEqual([true, false, false, false]);
      expect(trackStyle()).toContain('--_et-cascader-column-window-start: 1');
    });

    it('slides the window back on a breadcrumb click without truncating the drill', async () => {
      driver.drillTo(['Region 1', 'Country 1', 'League 1']);

      driver.clickCrumb(0);

      expect(driver.cascader.columns().length).toBe(4);
      expect(driver.cascader.visibleColumnStart()).toBe(0);
      // the crumb row mirrors the drill, not the window - sliding back must not rebuild it
      expect(driver.crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1']);
      expect(driver.cascader.focusedNode()?.label).toBe('Region 1');
      // the deepest column slid offstage instead of being truncated
      expect([offstage(0), offstage(3)]).toEqual([false, true]);
      expect(trackStyle()).toContain('--_et-cascader-column-window-start: 0');
    });

    it('slides forward again when the still-expanded branch is re-activated', async () => {
      driver.drillTo(['Region 1', 'Country 1', 'League 1']);
      driver.clickCrumb(0);

      // League 1 is still expanded - activating it reveals its children instead of reloading
      driver.clickNode('League 1');

      expect(driver.cascader.columns().length).toBe(4);
      expect(driver.cascader.visibleColumnStart()).toBe(1);
      expect(driver.crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1']);
      expect([offstage(0), offstage(3)]).toEqual([true, false]);
    });

    it('slides the window when ArrowLeft moves focus past its edge', async () => {
      driver.drillTo(['Region 1', 'Country 1', 'League 1']);

      // Country 1 sits in the leftmost visible column - ArrowLeft targets the collapsed root
      driver.pressOnNode('Country 1', 'ArrowLeft');

      expect(driver.cascader.focusedNode()?.label).toBe('Region 1');
      expect(driver.cascader.visibleColumnStart()).toBe(0);
      expect(driver.cascader.columns().length).toBe(4);
      expect(offstage(0)).toBe(false);
    });

    it('truncates and re-anchors when a node in a revealed column is activated', async () => {
      driver.drillTo(['Region 1', 'Country 1', 'League 1']);
      driver.clickCrumb(0);

      driver.clickNode('Region 2');

      expect(driver.cascader.columns().length).toBe(2);
      expect(driver.cascader.visibleColumnStart()).toBe(0);
      // the drill changed - now the crumb row updates (and empties, everything fits again)
      expect(driver.crumbs().length).toBe(0);
      expect([offstage(0), offstage(1)]).toEqual([false, false]);
    });

    it('keeps every crumb clickable - each anchors the window at its own column', async () => {
      driver.drillTo(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);

      // six columns: the row lists the whole drilled trail and never rebuilds on slides
      expect(driver.crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);

      driver.clickCrumb(0);
      expect(driver.cascader.visibleColumnStart()).toBe(0);

      driver.clickCrumb(2);
      expect(driver.cascader.visibleColumnStart()).toBe(2);

      // the deepest crumbs clamp to the deep end of the window
      driver.clickCrumb(4);
      expect(driver.cascader.visibleColumnStart()).toBe(3);
      expect(driver.cascader.focusedNode()?.label).toBe('Team 1');

      driver.clickCrumb(1);
      expect(driver.cascader.visibleColumnStart()).toBe(1);
      expect(driver.cascader.focusedNode()?.label).toBe('Country 1');
      // the drill never changed, so neither did the crumbs
      expect(driver.cascader.columns().length).toBe(6);
      expect(driver.crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);
    });

    it('re-opens a committed deep value with the window anchored at the deep end', async () => {
      driver.drillTo(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1', 'Player 1']);
      await flushFrames();

      expect(driver.host.value()).toBe('0/0/0/0/0/0');
      expect(driver.cascader.open()).toBe(false);

      await driver.open();

      expect(driver.cascader.columns().length).toBe(6);
      expect(driver.cascader.visibleColumnStart()).toBe(3);
      expect(driver.crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);
      expect(driver.nodeByLabel('Player 1')!.getAttribute('data-selected')).toBe('true');
    });

    it('respects a custom maxVisibleColumns', async () => {
      driver.host.maxVisibleColumns.set(2);
      driver.detectChanges();

      driver.drillTo(['Region 1', 'Country 1']);

      expect(driver.cascader.columns().length).toBe(3);
      expect(driver.cascader.visibleColumnStart()).toBe(1);
      expect(driver.crumbLabels()).toEqual(['Region 1', 'Country 1']);
      expect([offstage(0), offstage(1), offstage(2)]).toEqual([true, false, false]);
    });
  });

  it('supports an async (promise) data source', async () => {
    const asyncSource: CascaderDataSource<string> = {
      loadChildren: (parent) => Promise.resolve(TREE[parent ? parent.value : '__root__'] ?? []),
    };

    driver.host.dataSource.set(asyncSource);
    driver.detectChanges();

    await driver.open();
    // the column shows a loading state until the promise resolves
    await flushFrames();
    await Promise.resolve();
    tick();

    expect(driver.nodesIn(0).length).toBe(3);
  });

  it('surfaces a load error with a retry control', async () => {
    let attempts = 0;
    const failingSource: CascaderDataSource<string> = {
      loadChildren: () => {
        attempts += 1;

        return attempts === 1 ? Promise.reject(new Error('boom')) : TREE['__root__']!;
      },
    };

    driver.host.dataSource.set(failingSource);
    driver.detectChanges();

    await driver.open();
    await flushFrames();
    await Promise.resolve();
    await Promise.resolve();
    tick();

    expect(driver.paneEl('.et-cascader-state--error')).toBeTruthy();

    driver.clickInPane('.et-cascader-state--error button');
    await flushFrames();
    await Promise.resolve();
    tick();

    expect(driver.nodesIn(0).length).toBe(3);
  });

  describe('mixed', () => {
    it('shows the mixed label instead of the breadcrumb and reopens at the root', async () => {
      await driver.open();
      driver.clickNode('Euro');
      driver.clickNode('Group stage');
      driver.clickNode('Group A');
      await flushFrames();
      expect(driver.cascader.displayValue()).toBe('Euro / Group stage / Group A');

      driver.host.mixed.set(true);
      driver.detectChanges();

      expect(driver.cascader.displayValue()).toBe('Mixed');
      expect(driver.trigger().textContent).toContain('Mixed');
      // the raw value and its chain survive masking untouched
      expect(driver.host.value()).toBe('euro-group-a');
      expect(driver.cascader.pathValue()).toEqual(['euro', 'euro-group', 'euro-group-a']);

      await driver.open();

      // the hidden branch is not re-opened, and nothing reports selected
      expect(driver.columns().length).toBe(1);
      expect(driver.nodeByLabel('Euro')!.getAttribute('aria-selected')).toBe('false');
      expect(driver.paneEls('[data-selected]').length).toBe(0);
    });

    it('masks multi selection checkmarks and indeterminate dashes while mixed', async () => {
      driver.host.multiple.set(true);
      driver.detectChanges();

      await driver.open();
      driver.clickNode('Euro');
      driver.clickNode('Group stage');
      driver.clickNode('Group A');
      expect(driver.nodeByLabel('Group A')!.getAttribute('data-selected')).toBe('true');

      driver.host.mixed.set(true);
      driver.detectChanges();
      tick();

      expect(driver.nodeByLabel('Group A')!.hasAttribute('data-selected')).toBe(false);
      expect(driver.nodeByLabel('Group A')!.getAttribute('aria-selected')).toBe('false');
      expect(driver.nodeByLabel('Group stage')!.hasAttribute('data-indeterminate')).toBe(false);
      expect(driver.nodeByLabel('Euro')!.hasAttribute('data-indeterminate')).toBe(false);
      expect(driver.cascader.displayValue()).toBe('Mixed');
      // masking is presentation only - the raw array is preserved
      expect(driver.host.value()).toEqual(['euro-group-a']);
    });

    it('replaces the hidden multi selection on the first toggle, then toggles normally', async () => {
      driver.host.multiple.set(true);
      driver.host.value.set(['euro-group-a', 'world-final']);
      driver.host.mixed.set(true);
      driver.detectChanges();

      await driver.open();
      driver.clickNode('Euro');
      driver.clickNode('Group stage');
      // "Group A" is part of the hidden raw selection - the first commit must still SELECT it
      // into a fresh array, never toggle it away against the hidden value
      driver.clickNode('Group A');

      expect(driver.host.value()).toEqual(['euro-group-a']);
      expect(driver.host.mixed()).toBe(false);
      expect(driver.nodeByLabel('Group A')!.getAttribute('data-selected')).toBe('true');

      // later commits behave normally again
      driver.clickNode('Group B');

      expect(driver.host.value()).toEqual(['euro-group-a', 'euro-group-b']);
    });

    it('keeps mixed through searching and query deletion, resolving only on a result commit', async () => {
      driver.host.dataSource.set(searchableSource);
      driver.host.value.set('world-final');
      driver.host.mixed.set(true);
      driver.detectChanges();

      await driver.open();
      expect(driver.host.mixed()).toBe(true);

      await driver.type('group a');

      expect(driver.results().length).toBe(1);
      expect(driver.host.mixed()).toBe(true);

      // deleting the query (keyboard erase) never mass-clears the hidden value
      await driver.type('');

      expect(driver.host.mixed()).toBe(true);
      expect(driver.host.value()).toBe('world-final');

      await driver.type('group a');
      driver.clickResult(0);
      await flushFrames();

      expect(driver.host.value()).toBe('euro-group-a');
      expect(driver.host.mixed()).toBe(false);
    });
  });
});

const setupContract = (multiple: boolean) => {
  const driver = mountCascader(CascaderTestHost);

  driver.host.multiple.set(multiple);
  driver.detectChanges();

  // a real pointer commit: open the panel, drill Euro → Group stage, pick the "Group A" leaf
  const commitGroupA = async () => {
    await driver.open();
    driver.drillTo(['Euro', 'Group stage', 'Group A']);
    await flushFrames();
  };

  return { driver, commitGroupA };
};

describe('CascaderDirective (single, mixed contract)', () => {
  describeMixedStateContract(() => {
    const { driver, commitGroupA } = setupContract(false);

    return {
      enterMixed: () => {
        driver.host.value.set('world-final');
        driver.host.mixed.set(true);
        driver.detectChanges();
      },
      rawValue: () => 'world-final',
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set('euro-group-b');
        driver.detectChanges();
      },
      externallyWrittenValue: () => 'euro-group-b',
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.detectChanges();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.valueText() ?? '',
      commit: commitGroupA,
      committedValue: () => 'euro-group-a',
      assertMasked: () => {
        expect(driver.cascader.displayValue()).toBe('Mixed');
        expect(driver.valueText()).toBe('Mixed');
      },
      clear: () => {
        driver.cascader.clearValue();
        tick();
      },
      emptyValue: () => null,
    };
  });
});

describe('CascaderDirective (multiple, mixed contract)', () => {
  describeMixedStateContract(() => {
    const { driver, commitGroupA } = setupContract(true);

    return {
      enterMixed: () => {
        driver.host.value.set(['euro-group-a', 'world-final']);
        driver.host.mixed.set(true);
        driver.detectChanges();
      },
      rawValue: () => ['euro-group-a', 'world-final'],
      value: () => driver.host.value(),
      mixed: () => driver.host.mixed(),
      hostElement: () => driver.element(),
      writeValueExternally: () => {
        driver.host.value.set(['euro-group-b']);
        driver.detectChanges();
      },
      externallyWrittenValue: () => ['euro-group-b'],
      resolveMixedFromConsumer: () => {
        driver.host.mixed.set(false);
        driver.detectChanges();
      },
      mixedLabel: () => 'Mixed',
      mixedDisplayText: () => driver.valueText() ?? '',
      // "Group A" is inside the hidden raw array - replace semantics must still yield a fresh
      // one-entry array instead of toggling it away
      commit: commitGroupA,
      committedValue: () => ['euro-group-a'],
      assertMasked: () => {
        expect(driver.cascader.displayValue()).toBe('Mixed');
        expect(driver.valueText()).toBe('Mixed');
      },
      clear: () => {
        driver.cascader.clearValue();
        tick();
      },
      emptyValue: () => [],
    };
  });
});
