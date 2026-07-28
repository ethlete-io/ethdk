import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
import { describeMixedStateContract } from '../../testing/mixed-state-contract';
import { CASCADER_IMPORTS } from '../cascader.imports';
import { CascaderDirective } from './cascader.directive';
import { CascaderDataSource, CascaderNode } from './internals/cascader-tree';

const TEST_COLOR_THEMES = [
  {
    name: 'default',
    isDefault: true,
    primary: {
      color: {
        default: '0 255 161',
        hover: '76 247 184',
        focus: '76 247 184',
        active: '0 198 126',
        disabled: '0 122 77',
      },
      onColor: { default: '0 0 0', disabled: '0 36 23' },
    },
  },
  {
    name: 'red',
    type: 'error' as const,
    primary: {
      color: { default: '255 0 0', hover: '255 76 76', focus: '255 76 76', active: '198 0 0', disabled: '128 32 32' },
      onColor: { default: '0 0 0', disabled: '48 0 0' },
    },
  },
] as const;

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

const flushFrames = () =>
  new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

describe('CascaderDirective', () => {
  let fixture: ComponentFixture<CascaderTestHost>;
  let cascader: CascaderDirective<string>;
  let trigger: HTMLElement;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  const open = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
  };

  const pane = () => Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane')).at(-1) ?? null;
  const columns = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="group"]') ?? []);
  const nodesIn = (columnIndex: number) =>
    Array.from(columns()[columnIndex]?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []);
  const nodeByLabel = (label: string) =>
    Array.from(pane()?.querySelectorAll<HTMLElement>('[role="treeitem"]') ?? []).find(
      (node) => node.textContent?.trim() === label,
    ) ?? null;

  beforeEach(() => {
    document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

    TestBed.configureTestingModule({
      imports: [CascaderTestHost],
      providers: [provideColorThemes(TEST_COLOR_THEMES)],
    });
    fixture = TestBed.createComponent(CascaderTestHost);
    fixture.detectChanges();
    cascader = fixture.debugElement.children[0]!.injector.get(CascaderDirective);
    trigger = fixture.nativeElement.querySelector('[role="combobox"]');
  });

  afterEach(async () => {
    cascader.hide();
    tick();
    await flushFrames();
  });

  it('renders a closed combobox trigger with a tree popup', () => {
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-haspopup')).toBe('tree');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });

  it('loads the root column on open', async () => {
    await open();

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(columns().length).toBe(1);
    expect(nodesIn(0).map((node) => node.textContent?.trim())).toEqual(['Euro', 'World Cup', 'Empty competition']);
    // branch nodes advertise their expandability
    expect(nodesIn(0)[0]!.getAttribute('aria-expanded')).toBe('false');
  });

  it('drills into a branch, opening a second column', async () => {
    await open();
    nodeByLabel('Euro')!.click();
    tick();

    expect(columns().length).toBe(2);
    expect(nodesIn(1).map((node) => node.textContent?.trim())).toEqual(['Group stage', 'Knockout']);
    expect(nodeByLabel('Euro')!.getAttribute('aria-expanded')).toBe('true');
    // a branch click does not commit in leaf mode
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('commits a leaf value and closes', async () => {
    await open();
    nodeByLabel('Euro')!.click();
    tick();
    nodeByLabel('Group stage')!.click();
    tick();
    nodeByLabel('Group A')!.click();
    tick();
    await flushFrames();

    expect(fixture.componentInstance.value()).toBe('euro-group-a');
    expect(cascader.pathValue()).toEqual(['euro', 'euro-group', 'euro-group-a']);
    expect(cascader.open()).toBe(false);
  });

  it('shows the breadcrumb of the committed path on the trigger', async () => {
    await open();
    nodeByLabel('World Cup')!.click();
    tick();
    nodeByLabel('Final')!.click();
    tick();
    await flushFrames();

    expect(cascader.displayValue()).toBe('World Cup / Final');
    expect(trigger.textContent).toContain('World Cup / Final');
  });

  it('re-truncates deeper columns when a shallower branch is re-picked', async () => {
    await open();
    nodeByLabel('Euro')!.click();
    tick();
    nodeByLabel('Group stage')!.click();
    tick();
    expect(columns().length).toBe(3);

    // drilling a different root branch collapses back to two columns
    nodeByLabel('World Cup')!.click();
    tick();

    expect(columns().length).toBe(2);
    expect(nodesIn(1).map((node) => node.textContent?.trim())).toEqual(['Final']);
  });

  it('commits an intermediate branch in any-level mode without closing', async () => {
    fixture.componentInstance.selectableLevels.set('any');
    fixture.detectChanges();

    await open();
    nodeByLabel('Euro')!.click();
    tick();

    expect(fixture.componentInstance.value()).toBe('euro');
    expect(cascader.open()).toBe(true);
    expect(columns().length).toBe(2);
  });

  it('shows an empty state for a branch with no children', async () => {
    await open();
    nodeByLabel('Empty competition')!.click();
    tick();

    expect(columns()[1]!.textContent).toContain('No options');
  });

  it('moves roving focus within and across columns with the keyboard', async () => {
    await open();
    const [euro] = nodesIn(0);

    euro!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    tick();
    expect(cascader.focusedNode()?.value).toBe('world');

    euro!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    tick();
    expect(cascader.focusedNode()?.value).toBe('euro');

    // ArrowRight drills into the focused branch
    euro!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    tick();
    await flushFrames();
    expect(columns().length).toBe(2);
    expect(cascader.focusedNode()?.value).toBe('euro-group');
    expect(cascader.focusedColumn()).toBe(1);
  });

  it('does not commit or open while disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    fixture.detectChanges();

    await open();

    expect(cascader.open()).toBe(false);
    expect(pane()).toBeNull();
  });

  it('clears the value', async () => {
    await open();
    nodeByLabel('World Cup')!.click();
    tick();
    nodeByLabel('Final')!.click();
    tick();
    await flushFrames();
    expect(fixture.componentInstance.value()).toBe('world-final');

    cascader.clearValue();
    tick();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(cascader.pathValue()).toEqual([]);
  });

  describe('multiple', () => {
    beforeEach(() => {
      fixture.componentInstance.multiple.set(true);
      fixture.detectChanges();
    });

    it('toggles leaf values without closing the panel', async () => {
      await open();
      nodeByLabel('Euro')!.click();
      tick();
      nodeByLabel('Group stage')!.click();
      tick();
      nodeByLabel('Group A')!.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['euro-group-a']);
      expect(cascader.open()).toBe(true);

      nodeByLabel('Group B')!.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['euro-group-a', 'euro-group-b']);

      // a second activation of a selected node deselects it
      nodeByLabel('Group A')!.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['euro-group-b']);
    });

    it('marks ancestors of a selection indeterminate, not selected', async () => {
      await open();
      nodeByLabel('Euro')!.click();
      tick();
      nodeByLabel('Group stage')!.click();
      tick();
      nodeByLabel('Group A')!.click();
      tick();

      expect(nodeByLabel('Group A')!.getAttribute('data-selected')).toBe('true');
      expect(nodeByLabel('Group stage')!.getAttribute('data-indeterminate')).toBe('true');
      expect(nodeByLabel('Euro')!.getAttribute('data-indeterminate')).toBe('true');
      expect(nodeByLabel('Euro')!.hasAttribute('data-selected')).toBe(false);
      expect(nodeByLabel('World Cup')!.hasAttribute('data-indeterminate')).toBe(false);

      // deselecting removes the ancestors' dash again
      nodeByLabel('Group A')!.click();
      tick();

      expect(nodeByLabel('Group stage')!.hasAttribute('data-indeterminate')).toBe(false);
      expect(nodeByLabel('Euro')!.hasAttribute('data-indeterminate')).toBe(false);
    });

    it('promotes an ancestor to selected once all its loaded descendants are checked', async () => {
      await open();
      nodeByLabel('Euro')!.click();
      tick();
      nodeByLabel('Group stage')!.click();
      tick();
      nodeByLabel('Group A')!.click();
      tick();
      nodeByLabel('Group B')!.click();
      tick();

      // every leaf under "Group stage" is checked — full check, not the dash
      expect(nodeByLabel('Group stage')!.getAttribute('data-selected')).toBe('true');
      expect(nodeByLabel('Group stage')!.hasAttribute('data-indeterminate')).toBe(false);

      // "Euro" also holds the (unselected) "Knockout" branch — still just indeterminate
      expect(nodeByLabel('Euro')!.getAttribute('data-indeterminate')).toBe('true');
      expect(nodeByLabel('Euro')!.hasAttribute('data-selected')).toBe(false);

      // the promotion is display-only — the value stays the exact leaves
      expect(fixture.componentInstance.value()).toEqual(['euro-group-a', 'euro-group-b']);

      // unchecking a leaf drops the ancestor back to the dash
      nodeByLabel('Group A')!.click();
      tick();

      expect(nodeByLabel('Group stage')!.hasAttribute('data-selected')).toBe(false);
      expect(nodeByLabel('Group stage')!.getAttribute('data-indeterminate')).toBe('true');
    });

    it('promotes a single-child ancestor and keeps the promotion after navigating away', async () => {
      await open();
      nodeByLabel('World Cup')!.click();
      tick();
      nodeByLabel('Final')!.click();
      tick();

      expect(nodeByLabel('World Cup')!.getAttribute('data-selected')).toBe('true');
      expect(nodeByLabel('World Cup')!.hasAttribute('data-indeterminate')).toBe(false);

      // drilling into another branch truncates the columns, but the loaded child lists are
      // remembered — "World Cup" must not fall back to indeterminate
      nodeByLabel('Euro')!.click();
      tick();

      expect(nodeByLabel('World Cup')!.getAttribute('data-selected')).toBe('true');
    });

    it('joins the selected labels on the trigger', async () => {
      await open();
      nodeByLabel('Euro')!.click();
      tick();
      nodeByLabel('Group stage')!.click();
      tick();
      nodeByLabel('Group A')!.click();
      tick();
      nodeByLabel('Group B')!.click();
      tick();

      expect(cascader.displayValue()).toBe('Group A, Group B');
    });

    it('toggles branches too in any-level mode (while still drilling)', async () => {
      fixture.componentInstance.selectableLevels.set('any');
      fixture.detectChanges();

      await open();
      nodeByLabel('Euro')!.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['euro']);
      expect(columns().length).toBe(2);

      nodeByLabel('Euro')!.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual([]);
    });

    it('clears to an empty array', async () => {
      await open();
      nodeByLabel('World Cup')!.click();
      tick();
      nodeByLabel('Final')!.click();
      tick();
      expect(fixture.componentInstance.value()).toEqual(['world-final']);

      cascader.clearValue();
      tick();

      expect(fixture.componentInstance.value()).toEqual([]);
      expect(cascader.hasValue()).toBe(false);
    });

    it('reports the tree as multiselectable', async () => {
      await open();

      expect(pane()?.querySelector('.et-cascader-panel')?.getAttribute('aria-multiselectable')).toBe('true');
    });

    it('resolves programmatically set values through resolvePath', async () => {
      const resolvingSource: CascaderDataSource<string> = {
        loadChildren: syncSource.loadChildren,
        resolvePath: (value) => searchTree('').find((path) => path[path.length - 1]?.value === value) ?? null,
      };

      fixture.componentInstance.dataSource.set(resolvingSource);
      fixture.componentInstance.value.set(['euro-group-b']);
      fixture.detectChanges();
      tick();
      await flushFrames();
      tick();

      expect(cascader.displayValue()).toBe('Group B');

      await open();

      expect(nodeByLabel('Euro')!.getAttribute('data-indeterminate')).toBe('true');
    });

    it('toggles search results while keeping the panel and query alive', async () => {
      fixture.componentInstance.dataSource.set(searchableSource);
      fixture.detectChanges();

      await open();

      const input = pane()!.querySelector<HTMLInputElement>('.et-cascader-search input')!;

      input.value = 'group';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      tick();
      await flushFrames();
      tick();

      // result 0 is the "Group stage" branch (re-roots in leaf mode) — toggle the "Group A" leaf
      const options = Array.from(pane()!.querySelectorAll<HTMLElement>('[role="option"]'));
      const leafOption = options.find((option) => option.textContent!.includes('Group A'))!;

      leafOption.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['euro-group-a']);
      expect(cascader.open()).toBe(true);
      expect(cascader.searchQuery()).toBe('group');
      expect(leafOption.getAttribute('data-selected')).toBe('true');

      leafOption.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual([]);
    });
  });

  describe('flat search', () => {
    const searchInput = () => pane()?.querySelector<HTMLInputElement>('.et-cascader-search input') ?? null;
    const results = () => Array.from(pane()?.querySelectorAll<HTMLElement>('[role="option"]') ?? []);

    const typeQuery = async (query: string) => {
      const input = searchInput()!;

      input.value = query;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      tick();
      await flushFrames();
      tick();
    };

    beforeEach(async () => {
      fixture.componentInstance.dataSource.set(searchableSource);
      fixture.detectChanges();
      await open();
    });

    it('renders a search input only when the data source has a search hook', async () => {
      expect(searchInput()).toBeTruthy();

      cascader.hide();
      tick();
      await flushFrames();

      fixture.componentInstance.dataSource.set(syncSource);
      fixture.detectChanges();
      await open();

      expect(searchInput()).toBeNull();
    });

    it('swaps the columns for a flat result list while a query is active', async () => {
      await typeQuery('group a');

      expect(columns().length).toBe(0);
      expect(results().length).toBe(1);
      expect(results()[0]!.textContent?.replace(/\s+/g, ' ').trim()).toBe('Euro / Group stage / Group A');
      // the panel reports itself as the listbox owning the options
      expect(pane()?.querySelector('.et-cascader-panel')?.getAttribute('role')).toBe('listbox');

      await typeQuery('');

      expect(results().length).toBe(0);
      expect(columns().length).toBeGreaterThan(0);
    });

    it('commits a leaf result with its full path and closes', async () => {
      await typeQuery('group a');

      results()[0]!.click();
      tick();
      await flushFrames();

      expect(fixture.componentInstance.value()).toBe('euro-group-a');
      expect(cascader.pathValue()).toEqual(['euro', 'euro-group', 'euro-group-a']);
      expect(cascader.open()).toBe(false);
    });

    it('re-roots the columns onto a branch-only match instead of committing (leaf mode)', async () => {
      await typeQuery('knockout');

      results()[0]!.click();
      tick();
      await flushFrames();
      tick();

      expect(fixture.componentInstance.value()).toBeNull();
      expect(cascader.open()).toBe(true);
      expect(cascader.searchQuery()).toBe('');
      // root, Euro's children, Knockout's (empty) children
      expect(columns().length).toBe(3);
      expect(nodeByLabel('Knockout')!.getAttribute('aria-expanded')).toBe('true');
    });

    it('clears the query on the first Escape and closes on the second', async () => {
      await typeQuery('group');
      expect(results().length).toBeGreaterThan(0);

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      tick();
      await flushFrames();

      expect(cascader.open()).toBe(true);
      expect(cascader.searchQuery()).toBe('');

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
      tick();
      await flushFrames();

      expect(cascader.open()).toBe(false);
    });

    it('routes typing on a focused node into the search input', async () => {
      const euro = nodeByLabel('Euro')!;

      euro.dispatchEvent(new KeyboardEvent('keydown', { key: 'g', bubbles: true, cancelable: true }));
      tick();
      await flushFrames();
      tick();

      expect(cascader.searchQuery()).toBe('g');
      expect(document.activeElement).toBe(searchInput());
    });

    it('moves roving focus from the input into the results and back', async () => {
      await typeQuery('group');

      const input = searchInput()!;

      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      tick();
      expect(cascader.focusedSearchIndex()).toBe(0);

      results()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      tick();
      expect(cascader.focusedSearchIndex()).toBe(1);

      results()[1]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      tick();
      results()[0]!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true }));
      tick();

      expect(cascader.focusedSearchIndex()).toBe(-1);
      expect(document.activeElement).toBe(input);
    });

    it('Enter in the input activates the first result', async () => {
      await typeQuery('final');

      searchInput()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
      tick();
      await flushFrames();

      expect(fixture.componentInstance.value()).toBe('world-final');
      expect(cascader.open()).toBe(false);
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

      fixture.componentInstance.dataSource.set(flaky);
      fixture.detectChanges();

      await typeQuery('group');
      await Promise.resolve();
      await Promise.resolve();
      tick();

      const errorRow = pane()?.querySelector<HTMLElement>('.et-cascader-results .et-cascader-state--error');

      expect(errorRow).toBeTruthy();

      errorRow!.querySelector('button')!.click();
      tick();
      await flushFrames();
      tick();

      expect(results().length).toBeGreaterThan(0);
    });

    it('shows an empty state when nothing matches', async () => {
      await typeQuery('zzz');

      expect(results().length).toBe(0);
      expect(pane()?.querySelector('.et-cascader-results')?.textContent).toContain('No matches');
    });
  });

  describe('deep nesting', () => {
    const crumbs = () => Array.from(pane()?.querySelectorAll<HTMLElement>('.et-cascader-breadcrumb') ?? []);
    const crumbLabels = () => crumbs().map((crumb) => crumb.textContent?.trim());
    const offstage = (columnIndex: number) =>
      columns()[columnIndex]?.classList.contains('et-cascader-column--offstage') ?? false;
    const trackStyle = () => pane()?.querySelector<HTMLElement>('.et-cascader-columns-track')?.getAttribute('style');

    const drillTo = (labels: string[]) => {
      for (const label of labels) {
        nodeByLabel(label)!.click();
        tick();
      }
    };

    beforeEach(async () => {
      fixture.componentInstance.dataSource.set(deepSource);
      fixture.detectChanges();
      await open();
    });

    it('collapses older levels into breadcrumbs once the drill exceeds the window', async () => {
      drillTo(['Region 1', 'Country 1', 'League 1']);

      // four levels are drilled — all stay mounted on the track, the root slides offstage
      expect(cascader.columns().length).toBe(4);
      expect(columns().length).toBe(4);
      expect(cascader.visibleColumnStart()).toBe(1);
      // the row shows the FULL drilled trail, not just the levels hidden on the left
      expect(crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1']);
      expect([offstage(0), offstage(1), offstage(2), offstage(3)]).toEqual([true, false, false, false]);
      expect(trackStyle()).toContain('--_et-cascader-column-window-start: 1');
    });

    it('slides the window back on a breadcrumb click without truncating the drill', async () => {
      drillTo(['Region 1', 'Country 1', 'League 1']);

      crumbs()[0]!.click();
      tick();

      expect(cascader.columns().length).toBe(4);
      expect(cascader.visibleColumnStart()).toBe(0);
      // the crumb row mirrors the drill, not the window — sliding back must not rebuild it
      expect(crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1']);
      expect(cascader.focusedNode()?.label).toBe('Region 1');
      // the deepest column slid offstage instead of being truncated
      expect([offstage(0), offstage(3)]).toEqual([false, true]);
      expect(trackStyle()).toContain('--_et-cascader-column-window-start: 0');
    });

    it('slides forward again when the still-expanded branch is re-activated', async () => {
      drillTo(['Region 1', 'Country 1', 'League 1']);
      crumbs()[0]!.click();
      tick();

      // League 1 is still expanded — activating it reveals its children instead of reloading
      nodeByLabel('League 1')!.click();
      tick();

      expect(cascader.columns().length).toBe(4);
      expect(cascader.visibleColumnStart()).toBe(1);
      expect(crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1']);
      expect([offstage(0), offstage(3)]).toEqual([true, false]);
    });

    it('slides the window when ArrowLeft moves focus past its edge', async () => {
      drillTo(['Region 1', 'Country 1', 'League 1']);

      // Country 1 sits in the leftmost visible column — ArrowLeft targets the collapsed root
      nodeByLabel('Country 1')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
      tick();

      expect(cascader.focusedNode()?.label).toBe('Region 1');
      expect(cascader.visibleColumnStart()).toBe(0);
      expect(cascader.columns().length).toBe(4);
      expect(offstage(0)).toBe(false);
    });

    it('truncates and re-anchors when a node in a revealed column is activated', async () => {
      drillTo(['Region 1', 'Country 1', 'League 1']);
      crumbs()[0]!.click();
      tick();

      nodeByLabel('Region 2')!.click();
      tick();

      expect(cascader.columns().length).toBe(2);
      expect(cascader.visibleColumnStart()).toBe(0);
      // the drill changed — now the crumb row updates (and empties, everything fits again)
      expect(crumbs().length).toBe(0);
      expect([offstage(0), offstage(1)]).toEqual([false, false]);
    });

    it('keeps every crumb clickable — each anchors the window at its own column', async () => {
      drillTo(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);

      // six columns: the row lists the whole drilled trail and never rebuilds on slides
      expect(crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);

      crumbs()[0]!.click();
      tick();
      expect(cascader.visibleColumnStart()).toBe(0);

      crumbs()[2]!.click();
      tick();
      expect(cascader.visibleColumnStart()).toBe(2);

      // the deepest crumbs clamp to the deep end of the window
      crumbs()[4]!.click();
      tick();
      expect(cascader.visibleColumnStart()).toBe(3);
      expect(cascader.focusedNode()?.label).toBe('Team 1');

      crumbs()[1]!.click();
      tick();
      expect(cascader.visibleColumnStart()).toBe(1);
      expect(cascader.focusedNode()?.label).toBe('Country 1');
      // the drill never changed, so neither did the crumbs
      expect(cascader.columns().length).toBe(6);
      expect(crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);
    });

    it('re-opens a committed deep value with the window anchored at the deep end', async () => {
      drillTo(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1', 'Player 1']);
      await flushFrames();

      expect(fixture.componentInstance.value()).toBe('0/0/0/0/0/0');
      expect(cascader.open()).toBe(false);

      await open();

      expect(cascader.columns().length).toBe(6);
      expect(cascader.visibleColumnStart()).toBe(3);
      expect(crumbLabels()).toEqual(['Region 1', 'Country 1', 'League 1', 'Club 1', 'Team 1']);
      expect(nodeByLabel('Player 1')!.getAttribute('data-selected')).toBe('true');
    });

    it('respects a custom maxVisibleColumns', async () => {
      fixture.componentInstance.maxVisibleColumns.set(2);
      fixture.detectChanges();

      drillTo(['Region 1', 'Country 1']);

      expect(cascader.columns().length).toBe(3);
      expect(cascader.visibleColumnStart()).toBe(1);
      expect(crumbLabels()).toEqual(['Region 1', 'Country 1']);
      expect([offstage(0), offstage(1), offstage(2)]).toEqual([true, false, false]);
    });
  });

  it('supports an async (promise) data source', async () => {
    const asyncSource: CascaderDataSource<string> = {
      loadChildren: (parent) => Promise.resolve(TREE[parent ? parent.value : '__root__'] ?? []),
    };

    fixture.componentInstance.dataSource.set(asyncSource);
    fixture.detectChanges();

    await open();
    // the column shows a loading state until the promise resolves
    await flushFrames();
    await Promise.resolve();
    tick();

    expect(nodesIn(0).length).toBe(3);
  });

  it('surfaces a load error with a retry control', async () => {
    let attempts = 0;
    const failingSource: CascaderDataSource<string> = {
      loadChildren: () => {
        attempts += 1;

        return attempts === 1 ? Promise.reject(new Error('boom')) : TREE['__root__']!;
      },
    };

    fixture.componentInstance.dataSource.set(failingSource);
    fixture.detectChanges();

    await open();
    await flushFrames();
    await Promise.resolve();
    await Promise.resolve();
    tick();

    const errorRow = pane()?.querySelector<HTMLElement>('.et-cascader-state--error');

    expect(errorRow).toBeTruthy();

    errorRow!.querySelector('button')!.click();
    tick();
    await flushFrames();
    await Promise.resolve();
    tick();

    expect(nodesIn(0).length).toBe(3);
  });

  describe('mixed', () => {
    it('shows the mixed label instead of the breadcrumb and reopens at the root', async () => {
      await open();
      nodeByLabel('Euro')!.click();
      tick();
      nodeByLabel('Group stage')!.click();
      tick();
      nodeByLabel('Group A')!.click();
      tick();
      await flushFrames();
      expect(cascader.displayValue()).toBe('Euro / Group stage / Group A');

      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();

      expect(cascader.displayValue()).toBe('Mixed');
      expect(trigger.textContent).toContain('Mixed');
      // the raw value and its chain survive masking untouched
      expect(fixture.componentInstance.value()).toBe('euro-group-a');
      expect(cascader.pathValue()).toEqual(['euro', 'euro-group', 'euro-group-a']);

      await open();

      // the hidden branch is not re-opened, and nothing reports selected
      expect(columns().length).toBe(1);
      expect(nodeByLabel('Euro')!.getAttribute('aria-selected')).toBe('false');
      expect(pane()!.querySelectorAll('[data-selected]').length).toBe(0);
    });

    it('masks multi selection checkmarks and indeterminate dashes while mixed', async () => {
      fixture.componentInstance.multiple.set(true);
      fixture.detectChanges();

      await open();
      nodeByLabel('Euro')!.click();
      tick();
      nodeByLabel('Group stage')!.click();
      tick();
      nodeByLabel('Group A')!.click();
      tick();
      expect(nodeByLabel('Group A')!.getAttribute('data-selected')).toBe('true');

      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();
      tick();

      expect(nodeByLabel('Group A')!.hasAttribute('data-selected')).toBe(false);
      expect(nodeByLabel('Group A')!.getAttribute('aria-selected')).toBe('false');
      expect(nodeByLabel('Group stage')!.hasAttribute('data-indeterminate')).toBe(false);
      expect(nodeByLabel('Euro')!.hasAttribute('data-indeterminate')).toBe(false);
      expect(cascader.displayValue()).toBe('Mixed');
      // masking is presentation only — the raw array is preserved
      expect(fixture.componentInstance.value()).toEqual(['euro-group-a']);
    });

    it('replaces the hidden multi selection on the first toggle, then toggles normally', async () => {
      fixture.componentInstance.multiple.set(true);
      fixture.componentInstance.value.set(['euro-group-a', 'world-final']);
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();

      await open();
      nodeByLabel('Euro')!.click();
      tick();
      nodeByLabel('Group stage')!.click();
      tick();
      // "Group A" is part of the hidden raw selection — the first commit must still SELECT it
      // into a fresh array, never toggle it away against the hidden value
      nodeByLabel('Group A')!.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['euro-group-a']);
      expect(fixture.componentInstance.mixed()).toBe(false);
      expect(nodeByLabel('Group A')!.getAttribute('data-selected')).toBe('true');

      // later commits behave normally again
      nodeByLabel('Group B')!.click();
      tick();

      expect(fixture.componentInstance.value()).toEqual(['euro-group-a', 'euro-group-b']);
    });

    it('keeps mixed through searching and query deletion, resolving only on a result commit', async () => {
      fixture.componentInstance.dataSource.set(searchableSource);
      fixture.componentInstance.value.set('world-final');
      fixture.componentInstance.mixed.set(true);
      fixture.detectChanges();

      await open();
      expect(fixture.componentInstance.mixed()).toBe(true);

      const input = pane()!.querySelector<HTMLInputElement>('.et-cascader-search input')!;
      const typeQuery = async (query: string) => {
        input.value = query;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        tick();
        await flushFrames();
        tick();
      };

      await typeQuery('group a');

      const results = Array.from(pane()!.querySelectorAll<HTMLElement>('[role="option"]'));

      expect(results.length).toBe(1);
      expect(fixture.componentInstance.mixed()).toBe(true);

      // deleting the query (keyboard erase) never mass-clears the hidden value
      await typeQuery('');

      expect(fixture.componentInstance.mixed()).toBe(true);
      expect(fixture.componentInstance.value()).toBe('world-final');

      await typeQuery('group a');
      pane()!.querySelector<HTMLElement>('[role="option"]')!.click();
      tick();
      await flushFrames();

      expect(fixture.componentInstance.value()).toBe('euro-group-a');
      expect(fixture.componentInstance.mixed()).toBe(false);
    });
  });
});

const setupContractFixture = (multiple: boolean) => {
  document.querySelectorAll('.et-overlay-runtime-entry').forEach((entry) => entry.remove());

  TestBed.configureTestingModule({
    imports: [CascaderTestHost],
    providers: [provideColorThemes(TEST_COLOR_THEMES)],
  });

  const fixture = TestBed.createComponent(CascaderTestHost);

  fixture.componentInstance.multiple.set(multiple);
  fixture.detectChanges();

  const cascader = fixture.debugElement.children[0]!.injector.get(CascaderDirective) as CascaderDirective<string>;
  const trigger = fixture.nativeElement.querySelector('[role="combobox"]') as HTMLElement;
  const tick = () => TestBed.inject(ApplicationRef).tick();
  const nodeByLabel = (label: string) =>
    Array.from(document.querySelectorAll<HTMLElement>('.et-overlay-runtime-pane [role="treeitem"]')).find(
      (node) => node.textContent?.trim() === label,
    ) ?? null;

  // a real pointer commit: open the panel, drill Euro → Group stage, pick the "Group A" leaf
  const commitGroupA = async () => {
    trigger.click();
    tick();
    await flushFrames();
    tick();
    nodeByLabel('Euro')!.click();
    tick();
    nodeByLabel('Group stage')!.click();
    tick();
    nodeByLabel('Group A')!.click();
    tick();
    await flushFrames();
  };

  return { fixture, cascader, tick, commitGroupA };
};

describe('CascaderDirective (single, mixed contract)', () => {
  describeMixedStateContract(() => {
    const { fixture, cascader, tick, commitGroupA } = setupContractFixture(false);

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set('world-final');
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
      },
      rawValue: () => 'world-final',
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.nativeElement.querySelector('et-cascader') as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set('euro-group-b');
        fixture.detectChanges();
      },
      externallyWrittenValue: () => 'euro-group-b',
      commit: commitGroupA,
      committedValue: () => 'euro-group-a',
      assertMasked: () => {
        expect(cascader.displayValue()).toBe('Mixed');
        expect(fixture.nativeElement.querySelector('.et-cascader-value')?.textContent?.trim()).toBe('Mixed');
      },
      clear: () => {
        cascader.clearValue();
        tick();
      },
      emptyValue: () => null,
    };
  });
});

describe('CascaderDirective (multiple, mixed contract)', () => {
  describeMixedStateContract(() => {
    const { fixture, cascader, tick, commitGroupA } = setupContractFixture(true);

    return {
      enterMixed: () => {
        fixture.componentInstance.value.set(['euro-group-a', 'world-final']);
        fixture.componentInstance.mixed.set(true);
        fixture.detectChanges();
      },
      rawValue: () => ['euro-group-a', 'world-final'],
      value: () => fixture.componentInstance.value(),
      mixed: () => fixture.componentInstance.mixed(),
      hostElement: () => fixture.nativeElement.querySelector('et-cascader') as HTMLElement,
      writeValueExternally: () => {
        fixture.componentInstance.value.set(['euro-group-b']);
        fixture.detectChanges();
      },
      externallyWrittenValue: () => ['euro-group-b'],
      // "Group A" is inside the hidden raw array — replace semantics must still yield a fresh
      // one-entry array instead of toggling it away
      commit: commitGroupA,
      committedValue: () => ['euro-group-a'],
      assertMasked: () => {
        expect(cascader.displayValue()).toBe('Mixed');
        expect(fixture.nativeElement.querySelector('.et-cascader-value')?.textContent?.trim()).toBe('Mixed');
      },
      clear: () => {
        cascader.clearValue();
        tick();
      },
      emptyValue: () => [],
    };
  });
});
