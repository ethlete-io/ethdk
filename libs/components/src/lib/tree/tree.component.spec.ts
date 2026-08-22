import { ApplicationRef, Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import '../../test-helpers';
import { ICON_IMPORTS, IconDefinition, provideIcons } from '../icon';
import { TreeDataSource, TreeDirective, TreeNode, TreeSelectionMode } from './headless';
import { TREE_IMPORTS } from './tree.imports';

// files → folders, three levels, synchronous
const TREE: Record<string, TreeNode<string>[]> = {
  __root__: [
    { value: 'src', label: 'src' },
    { value: 'docs', label: 'docs' },
    { value: 'readme', label: 'README.md', isLeaf: true },
    { value: 'empty', label: 'empty' },
  ],
  src: [
    { value: 'src/app', label: 'app' },
    { value: 'src/main', label: 'main.ts', isLeaf: true },
    { value: 'src/locked', label: 'locked', disabled: true },
  ],
  'src/app': [{ value: 'src/app/routes', label: 'routes.ts', isLeaf: true }],
  docs: [{ value: 'docs/guide', label: 'guide.md', isLeaf: true }],
  empty: [],
};

const keyOf = (parent: TreeNode<string> | null) => (parent ? parent.value : '__root__');

const syncSource: TreeDataSource<string> = {
  loadChildren: (parent) => TREE[keyOf(parent)] ?? [],
};

@Component({
  selector: 'et-test-tree-host',
  template: `
    <et-tree
      [dataSource]="dataSource()"
      [selectionMode]="selectionMode()"
      [value]="value()"
      [expandedValues]="expandedValues()"
      [disabled]="disabled()"
      (valueChange)="value.set($event)"
      (expandedValuesChange)="expandedValues.set($event)"
      (nodeActivate)="activatedLabels.push($event.label)"
    />
  `,
  imports: [TREE_IMPORTS],
})
class TreeHostComponent {
  public dataSource = signal<TreeDataSource<string> | null>(syncSource);
  public selectionMode = signal<TreeSelectionMode>('single');
  public value = signal<string | string[] | null>(null);
  public expandedValues = signal<readonly string[]>([]);
  public disabled = signal(false);
  public activatedLabels: string[] = [];
}

// no bindings at all, so the component's own input defaults are the ones under test
@Component({
  selector: 'et-test-tree-default-host',
  template: `<et-tree [dataSource]="dataSource" />`,
  imports: [TREE_IMPORTS],
})
class TreeDefaultHostComponent {
  public dataSource: TreeDataSource<string> = { loadChildren: () => [] };
}

const HOST_ICON: IconDefinition = {
  name: 'host-only',
  data: `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" data-host-icon></svg>`,
};

// A row template holding an icon only this host registers. The tree provides its own icon set, which
// would shadow this one if the template were rendered with the injector of the element it lands on.
@Component({
  selector: 'et-test-tree-template-host',
  template: `
    <et-tree [dataSource]="dataSource">
      <ng-template etTreeNodeDef let-node let-row="row">
        <i etIcon="host-only"></i>
        <span class="et-test-label">{{ node.label }} @ {{ row.level }}</span>
      </ng-template>
    </et-tree>
  `,
  imports: [TREE_IMPORTS, ICON_IMPORTS],
  providers: [provideIcons(HOST_ICON)],
})
class TreeTemplateHostComponent {
  public dataSource: TreeDataSource<string> = syncSource;
}

describe('TreeComponent', () => {
  let fixture: ComponentFixture<TreeHostComponent>;
  let tree: TreeDirective<string>;

  const tick = () => TestBed.inject(ApplicationRef).tick();

  /** Runs change detection until the load pipeline (an effect-driven observable) has settled. */
  const settle = async () => {
    for (let round = 0; round < 6; round++) {
      tick();
      await Promise.resolve();
    }
  };

  const rows = () => Array.from(fixture.nativeElement.querySelectorAll('.et-tree-node') as NodeListOf<HTMLElement>);
  const labels = () => rows().map((row) => row.querySelector('.et-tree-node-label')?.textContent?.trim());
  const rowByLabel = (label: string) =>
    rows().find((row) => row.querySelector('.et-tree-node-label')?.textContent?.trim() === label);
  const status = () => fixture.nativeElement.querySelector('.et-tree-status') as HTMLElement | null;
  const press = (element: HTMLElement, key: string) =>
    element.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [TreeHostComponent] });
    fixture = TestBed.createComponent(TreeHostComponent);
    fixture.detectChanges();
    tree = fixture.debugElement.children[0]!.injector.get(TreeDirective);
    await settle();
  });

  it('renders the root level as an ARIA tree', () => {
    const host = fixture.nativeElement.querySelector('et-tree') as HTMLElement;

    expect(host.getAttribute('role')).toBe('tree');
    expect(host.getAttribute('aria-multiselectable')).toBeNull();
    expect(labels()).toEqual(['src', 'docs', 'README.md', 'empty']);
  });

  it('states the position of every row, which a flat tree has to do itself', () => {
    const [first] = rows();

    expect(first?.getAttribute('aria-level')).toBe('1');
    expect(first?.getAttribute('aria-posinset')).toBe('1');
    expect(first?.getAttribute('aria-setsize')).toBe('4');
  });

  it('marks branches expandable and leaves not', () => {
    expect(rowByLabel('src')?.getAttribute('aria-expanded')).toBe('false');
    expect(rowByLabel('README.md')?.getAttribute('aria-expanded')).toBeNull();
  });

  it('gives the first row the only tab stop', () => {
    expect(rows().map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('moves the tab stop to the last focused row', () => {
    rows()[2]?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    tick();

    expect(rows().map((row) => row.tabIndex)).toEqual([-1, -1, 0, -1]);
  });

  it('hands focus to the collapsed branch when a descendant row held it', async () => {
    fixture.componentInstance.expandedValues.set(['docs']);
    await settle();

    rowByLabel('guide.md')?.focus();
    tick();

    const docs = tree.visibleRows().find((row) => row.node.value === 'docs')!.node;

    tree.collapse(docs);
    await settle();

    expect(document.activeElement).toBe(rowByLabel('docs'));
    expect(rows().map((row) => row.tabIndex)).toEqual([-1, 0, -1, -1]);
  });

  it('hands focus to the outermost surviving ancestor on collapseAll', async () => {
    fixture.componentInstance.expandedValues.set(['src', 'src/app', 'docs']);
    await settle();

    rowByLabel('routes.ts')?.focus();
    tick();

    tree.collapseAll();
    await settle();

    expect(document.activeElement).toBe(rowByLabel('src'));
    expect(rows().map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
  });

  it('leaves the tab stop on the surviving ancestor after an outside collapse, without stealing focus', async () => {
    fixture.componentInstance.expandedValues.set(['docs']);
    await settle();

    rowByLabel('guide.md')?.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    tick();

    fixture.componentInstance.expandedValues.set([]);
    await settle();

    expect(rows().map((row) => row.tabIndex)).toEqual([-1, 0, -1, -1]);
    expect(document.activeElement).toBe(document.body);
  });

  it('loads and reveals the children of a branch when it is expanded', async () => {
    rowByLabel('src')?.click();
    await settle();

    expect(rowByLabel('src')?.getAttribute('aria-expanded')).toBe('true');
    expect(labels()).toEqual(['src', 'app', 'main.ts', 'locked', 'docs', 'README.md', 'empty']);
    expect(rowByLabel('app')?.getAttribute('aria-level')).toBe('2');
  });

  it('collapses a branch again without unloading it', async () => {
    const loaded: string[] = [];

    fixture.componentInstance.dataSource.set({
      loadChildren: (parent) => {
        loaded.push(keyOf(parent));

        return TREE[keyOf(parent)] ?? [];
      },
    });
    await settle();

    rowByLabel('src')?.click();
    await settle();
    rowByLabel('src')?.click();
    await settle();
    rowByLabel('src')?.click();
    await settle();

    expect(labels()).toContain('app');
    expect(loaded.filter((key) => key === 'src').length).toBe(1);
  });

  it('loads a branch that starts out expanded', async () => {
    fixture.componentInstance.expandedValues.set(['src', 'src/app']);
    await settle();

    expect(labels()).toEqual(['src', 'app', 'routes.ts', 'main.ts', 'locked', 'docs', 'README.md', 'empty']);
  });

  it('selects the activated row in single mode', () => {
    rowByLabel('README.md')?.click();
    tick();

    expect(fixture.componentInstance.value()).toBe('readme');
    expect(rowByLabel('README.md')?.getAttribute('aria-selected')).toBe('true');
    expect(fixture.componentInstance.activatedLabels).toEqual(['README.md']);
  });

  it('toggles selection in multiple mode', () => {
    fixture.componentInstance.selectionMode.set('multiple');
    tick();

    const host = fixture.nativeElement.querySelector('et-tree') as HTMLElement;

    expect(host.getAttribute('aria-multiselectable')).toBe('true');

    rowByLabel('README.md')?.click();
    tick();
    rowByLabel('docs')?.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['readme', 'docs']);

    rowByLabel('README.md')?.click();
    tick();

    expect(fixture.componentInstance.value()).toEqual(['docs']);
  });

  it('never selects while the mode is none, but still expands and emits', async () => {
    fixture.componentInstance.selectionMode.set('none');
    tick();

    rowByLabel('src')?.click();
    await settle();

    expect(fixture.componentInstance.value()).toBeNull();
    expect(rowByLabel('src')?.getAttribute('aria-selected')).toBeNull();
    expect(rowByLabel('src')?.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.componentInstance.activatedLabels).toEqual(['src']);
  });

  it('ignores a disabled node', async () => {
    fixture.componentInstance.expandedValues.set(['src']);
    await settle();

    const locked = rowByLabel('locked');

    expect(locked?.getAttribute('aria-disabled')).toBe('true');

    locked?.click();
    await settle();

    expect(locked?.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('ignores every interaction while the whole tree is disabled', async () => {
    fixture.componentInstance.disabled.set(true);
    tick();

    rowByLabel('src')?.click();
    await settle();

    expect(rowByLabel('src')?.getAttribute('aria-expanded')).toBe('false');
    expect(fixture.componentInstance.value()).toBeNull();
  });

  it('moves focus down, up and to the ends with the arrow keys, Home and End', () => {
    const first = rows()[0]!;

    first.focus();
    press(first, 'ArrowDown');
    tick();

    expect(document.activeElement).toBe(rowByLabel('docs'));

    press(rowByLabel('docs')!, 'ArrowUp');
    tick();

    expect(document.activeElement).toBe(rowByLabel('src'));

    press(rowByLabel('src')!, 'End');
    tick();

    expect(document.activeElement).toBe(rowByLabel('empty'));

    press(rowByLabel('empty')!, 'Home');
    tick();

    expect(document.activeElement).toBe(rowByLabel('src'));
  });

  it('expands with ArrowRight and steps into the branch on the second press', async () => {
    const src = rowByLabel('src')!;

    src.focus();
    press(src, 'ArrowRight');
    await settle();

    expect(rowByLabel('src')?.getAttribute('aria-expanded')).toBe('true');
    expect(document.activeElement).toBe(rowByLabel('src'));

    press(rowByLabel('src')!, 'ArrowRight');
    await settle();

    expect(document.activeElement).toBe(rowByLabel('app'));
  });

  it('collapses with ArrowLeft, then walks up to the parent', async () => {
    fixture.componentInstance.expandedValues.set(['src', 'src/app']);
    await settle();

    const routes = rowByLabel('routes.ts')!;

    routes.focus();
    press(routes, 'ArrowLeft');
    await settle();

    expect(document.activeElement).toBe(rowByLabel('app'));

    press(rowByLabel('app')!, 'ArrowLeft');
    await settle();

    expect(rowByLabel('app')?.getAttribute('aria-expanded')).toBe('false');

    press(rowByLabel('app')!, 'ArrowLeft');
    await settle();

    expect(document.activeElement).toBe(rowByLabel('src'));
  });

  it('selects with Space without expanding the branch', () => {
    const src = rowByLabel('src')!;

    src.focus();
    press(src, ' ');
    tick();

    expect(fixture.componentInstance.value()).toBe('src');
    expect(rowByLabel('src')?.getAttribute('aria-expanded')).toBe('false');
  });

  it('expands every sibling of the focused row with *', async () => {
    const src = rowByLabel('src')!;

    src.focus();
    press(src, '*');
    await settle();

    expect(labels()).toEqual(['src', 'app', 'main.ts', 'locked', 'docs', 'guide.md', 'README.md', 'empty']);
  });

  it('moves focus to the row a typed prefix matches', () => {
    const src = rowByLabel('src')!;

    src.focus();
    press(src, 'd');
    tick();

    expect(document.activeElement).toBe(rowByLabel('docs'));
  });

  it('shows the empty state when the root loads nothing', async () => {
    fixture.componentInstance.dataSource.set({ loadChildren: () => [] });
    await settle();

    expect(rows().length).toBe(0);
    expect(status()?.textContent?.trim()).toBe('Nothing to show');
    expect(status()?.getAttribute('role')).toBe('treeitem');
  });

  it('shows the message of a failed branch and reloads it when the row is activated again', async () => {
    let shouldFail = true;

    fixture.componentInstance.dataSource.set({
      loadChildren: (parent) => {
        if (parent?.value === 'src' && shouldFail) {
          throw new Error('Network unreachable');
        }

        return TREE[keyOf(parent)] ?? [];
      },
    });
    await settle();

    rowByLabel('src')?.click();
    await settle();

    expect(rowByLabel('src')?.querySelector('.et-tree-node-error')?.textContent).toContain('Network unreachable');

    shouldFail = false;
    rowByLabel('src')?.click();
    await settle();

    expect(rowByLabel('src')?.querySelector('.et-tree-node-error')).toBeNull();
    expect(labels()).toContain('app');
  });

  it('offers a failed root load as a retryable row', async () => {
    let shouldFail = true;

    fixture.componentInstance.dataSource.set({
      loadChildren: (parent) => {
        if (shouldFail) {
          throw new Error('Nope');
        }

        return TREE[keyOf(parent)] ?? [];
      },
    });
    await settle();

    expect(status()?.textContent).toContain('Nope');

    shouldFail = false;
    status()?.click();
    await settle();

    expect(labels()).toEqual(['src', 'docs', 'README.md', 'empty']);
  });

  it('drops what it learned from a swapped data source', async () => {
    fixture.componentInstance.expandedValues.set(['src']);
    await settle();

    expect(labels()).toContain('app');

    fixture.componentInstance.dataSource.set({
      loadChildren: () => [{ value: 'other', label: 'other', isLeaf: true }],
    });
    await settle();

    expect(labels()).toEqual(['other']);
  });

  it('resolves children from a promise', async () => {
    fixture.componentInstance.dataSource.set({
      loadChildren: (parent) => Promise.resolve(TREE[keyOf(parent)] ?? []),
    });
    await settle();

    expect(labels()).toEqual(['src', 'docs', 'README.md', 'empty']);
  });

  it('exposes the flattened rows with their level and load state', async () => {
    fixture.componentInstance.expandedValues.set(['src']);
    await settle();

    expect(tree.visibleRows().map((row) => [row.node.label, row.level, row.isExpanded])).toEqual([
      ['src', 1, true],
      ['app', 2, false],
      ['main.ts', 2, false],
      ['locked', 2, false],
      ['docs', 1, false],
      ['README.md', 1, false],
      ['empty', 1, false],
    ]);
    expect(tree.rootStatus()).toBe('loaded');
  });

  it('uses its own labels when nothing is bound', async () => {
    const defaultFixture = TestBed.createComponent(TreeDefaultHostComponent);

    defaultFixture.detectChanges();

    for (let round = 0; round < 6; round++) {
      TestBed.inject(ApplicationRef).tick();
      await Promise.resolve();
    }

    expect(defaultFixture.nativeElement.querySelector('.et-tree-status')?.textContent?.trim()).toBe('Nothing to show');
  });

  it('renders a projected row template with the DI of the place it was written', async () => {
    const templateFixture = TestBed.createComponent(TreeTemplateHostComponent);

    templateFixture.detectChanges();

    for (let round = 0; round < 6; round++) {
      TestBed.inject(ApplicationRef).tick();
      await Promise.resolve();
    }

    const labels = Array.from(
      templateFixture.nativeElement.querySelectorAll('.et-test-label') as NodeListOf<HTMLElement>,
    ).map((label) => label.textContent?.trim());

    expect(labels).toEqual(['src @ 1', 'docs @ 1', 'README.md @ 1', 'empty @ 1']);
    expect(templateFixture.nativeElement.querySelectorAll('[data-host-icon]').length).toBe(4);
  });
});
