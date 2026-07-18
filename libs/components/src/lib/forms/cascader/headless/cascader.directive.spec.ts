import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideColorThemes } from '@ethlete/core';
import '../../../../test-helpers';
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

@Component({
  template: `
    <et-cascader
      [value]="value()"
      [dataSource]="dataSource()"
      [selectableLevels]="selectableLevels()"
      [disabled]="disabled()"
      [multiple]="multiple()"
      (valueChange)="value.set($event)"
      (touchedChange)="touched.set($event)"
      placeholder="Pick a match"
    />
  `,
  imports: [CASCADER_IMPORTS],
})
class CascaderTestHost {
  value = signal<string | string[] | null>(null);
  touched = signal(false);
  disabled = signal(false);
  multiple = signal(false);
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
});
