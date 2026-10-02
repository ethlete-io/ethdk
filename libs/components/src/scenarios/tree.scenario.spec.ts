import { Component, inject, signal, ViewEncapsulation } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { delay, of, throwError, timer } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import {
  DEFAULT_TREE_LABELS,
  injectTreeLabels,
  provideTreeLabels,
  TREE_ERROR_CODES,
  TREE_IMPORTS,
  TREE_LABELS,
  TREE_LEVEL_STATUSES,
  TREE_MARKERS,
  TREE_SELECTION_MODES,
  TreeComponent,
  TreeDataSource,
  TreeDirective,
  TreeMarkerComponent,
  TreeNode,
  TreeNodeDefDirective,
  TreeNodeDirective,
  TreeSelectionMode,
} from '../index';
import '../test-helpers';
import { Scenario, useScenario } from './harness';

const code = (value: number) => `ET${value}`;

const UNSTYLED_BLOCKS = 'et-spinner, et-tree-marker { display: block; }';

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const rows = () => Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'));

const labels = () => rows().map((row) => text(row.querySelector('.et-tree-node-label') ?? row));

const row = (label: string) => {
  const match = rows().find((candidate) => text(candidate.querySelector('.et-tree-node-label') ?? candidate) === label);

  if (!match) throw new Error(`No row ${label}`);

  return match;
};

const focused = () => text(document.activeElement?.querySelector('.et-tree-node-label') ?? document.activeElement);

const settle = (s: Scenario) => {
  s.tick();
  s.frame(2);
  s.tick();
};

const CLUB: Record<string, TreeNode<string>[]> = {
  root: [
    { value: 'club', label: 'Club' },
    { value: 'archive', label: 'Archive', disabled: true },
    { value: 'imprint', label: 'Imprint', isLeaf: true },
  ],
  club: [
    { value: 'team-a', label: 'Team A' },
    { value: 'team-b', label: 'Team B', hasChildren: false },
  ],
  'team-a': [
    { value: 'team-a-keepers', label: 'Keepers', isLeaf: true },
    { value: 'team-a-strikers', label: 'Strikers', isLeaf: true },
  ],
  archive: [],
};

const staticSource: TreeDataSource<string> = {
  loadChildren: (parent) => CLUB[parent?.value ?? 'root'] ?? [],
};

const createLazySource = () => {
  const calls: (string | null)[] = [];
  let failNext = true;

  const source: TreeDataSource<string> = {
    loadChildren: (parent) => {
      calls.push(parent?.value ?? null);

      if (parent?.value === 'team-a' && failNext) {
        failNext = false;

        return timer(200).pipe(switchMap(() => throwError(() => new Error('Roster offline'))));
      }

      return of(CLUB[parent?.value ?? 'root'] ?? []).pipe(delay(200));
    },
  };

  return { source, calls };
};

@Component({
  selector: 'et-scenario-club-tree',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TreeComponent],
  template: `
    <et-tree
      [(value)]="value"
      [(expandedValues)]="expanded"
      [dataSource]="source"
      [selectionMode]="mode()"
      [disabled]="disabled()"
      (nodeActivate)="activated.push($event.value)"
      aria-label="Club"
    />
  `,
})
class ClubTreeComponent {
  source = staticSource;
  mode = signal<TreeSelectionMode>(TREE_SELECTION_MODES.SINGLE);
  disabled = signal(false);
  value = signal<string | string[] | null>(null);
  expanded = signal<readonly string[]>([]);
  activated: string[] = [];
}

@Component({
  selector: 'et-scenario-lazy-tree',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TREE_IMPORTS],
  template: `
    <et-tree
      [(expandedValues)]="expanded"
      [dataSource]="lazy.source"
      [labels]="{ loading: 'Loading club', retry: 'retry' }"
    >
      <ng-template etTreeNodeDef let-node let-row="row">
        <span [attr.data-level]="row.level" class="custom-label">{{ node.label }}</span>
      </ng-template>
    </et-tree>
  `,
})
class LazyTreeComponent {
  lazy = createLazySource();
  expanded = signal<readonly string[]>([]);
}

@Component({
  selector: 'et-scenario-failing-root',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TreeComponent],
  template: `<et-tree [dataSource]="source" [toErrorMessage]="toMessage" [labels]="{ empty: 'No teams' }" />`,
})
class FailingRootComponent {
  attempts = 0;
  source: TreeDataSource<string> = {
    loadChildren: () => {
      this.attempts++;

      if (this.attempts === 1) return Promise.reject('offline');

      return [];
    },
  };
  toMessage = (error: unknown) => `Could not load (${String(error)})`;
}

@Component({
  selector: 'et-scenario-localized-failing-root',
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  imports: [TreeComponent],
  providers: [provideTreeLabels({ empty: 'Keine Teams', retry: 'zum Wiederholen auswählen' })],
  template: `<et-tree [dataSource]="source" [toErrorMessage]="toMessage" />`,
})
class LocalizedFailingRootComponent extends FailingRootComponent {
  labels = injectTreeLabels();
  labelsFromToken = inject(TREE_LABELS);
}

@Component({
  selector: 'et-scenario-headless-tree',
  imports: [TreeDirective, TreeNodeDirective, TreeMarkerComponent],
  styles: [UNSTYLED_BLOCKS],
  encapsulation: ViewEncapsulation.None,
  template: `
    <ul #tree="etTree" [dataSource]="source" selectionMode="none" etTree>
      @for (entry of tree.visibleRows(); track entry.node) {
        <li [row]="entry" [attr.data-status]="entry.childrenStatus" etTreeNode>
          <et-tree-marker [marker]="entry.isExpandable ? chevron : none" />
          <span class="et-tree-node-label">{{ entry.node.label }}</span>
        </li>
      }
    </ul>
    <button (click)="tree.expandAll()" class="expand-all" type="button">Expand all</button>
    <button (click)="tree.collapseAll()" class="collapse-all" type="button">Collapse all</button>
  `,
})
class HeadlessTreeComponent {
  source = staticSource;
  chevron = TREE_MARKERS.CHEVRON;
  none = TREE_MARKERS.NONE;
}

@Component({
  selector: 'et-scenario-stray-tree-parts',
  imports: [TreeDirective, TreeNodeDirective, TreeNodeDefDirective],
  template: `
    <div class="no-source" etTree></div>
    <div
      [row]="{
        node: { value: 'x', label: 'x' },
        level: 1,
        path: [],
        isExpandable: false,
        isExpanded: false,
        isDisabled: false,
        childrenStatus: 'idle',
        childrenError: null,
        posInSet: 1,
        setSize: 1,
      }"
      class="stray-node"
      etTreeNode
    ></div>
    <ng-template etTreeNodeDef>stray</ng-template>
  `,
})
class StrayTreePartsComponent {}

describe('tree scenarios', () => {
  const scenario = useScenario();

  it('renders a club hierarchy with tree semantics and expands a branch on click', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ClubTreeComponent);
    const page = fixture.componentInstance;

    settle(s);

    const tree = document.querySelector('et-tree')!;

    expect(tree.getAttribute('role')).toBe('tree');
    expect(tree.getAttribute('aria-multiselectable')).toBeNull();
    expect(labels()).toEqual(['Club', 'Archive', 'Imprint']);
    expect(rows().map((entry) => entry.getAttribute('aria-level'))).toEqual(['1', '1', '1']);
    expect(rows().map((entry) => entry.getAttribute('aria-posinset'))).toEqual(['1', '2', '3']);
    expect(rows().map((entry) => entry.getAttribute('aria-setsize'))).toEqual(['3', '3', '3']);
    expect(row('Club').getAttribute('aria-expanded')).toBe('false');
    expect(row('Imprint').hasAttribute('aria-expanded')).toBe(false);
    expect(row('Archive').getAttribute('aria-disabled')).toBe('true');
    expect(rows().map((entry) => entry.getAttribute('tabindex'))).toEqual(['0', '-1', '-1']);
    expect(row('Club').querySelector('.et-tree-node-chevron')).not.toBeNull();
    expect(row('Imprint').querySelector('.et-tree-node-marker i')).toBeNull();

    row('Club').click();
    settle(s);

    expect(page.expanded()).toEqual(['club']);
    expect(page.value()).toBe('club');
    expect(page.activated).toEqual(['club']);
    expect(labels()).toEqual(['Club', 'Team A', 'Team B', 'Archive', 'Imprint']);
    expect(row('Club').getAttribute('aria-expanded')).toBe('true');
    expect(row('Club').getAttribute('aria-selected')).toBe('true');
    expect(row('Team A').getAttribute('aria-level')).toBe('2');
    expect(row('Team B').hasAttribute('aria-expanded')).toBe(false);

    row('Archive').click();
    settle(s);
    expect(page.value()).toBe('club');
    expect(page.activated).toEqual(['club']);
  });

  it('walks the tree by keyboard: arrows, expand and collapse, typeahead, star and Enter', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ClubTreeComponent);
    const page = fixture.componentInstance;

    settle(s);
    row('Club').focus();

    s.keydown('ArrowRight');
    settle(s);
    expect(page.expanded()).toEqual(['club']);
    expect(focused()).toBe('Club');

    s.keydown('ArrowRight');
    settle(s);
    expect(focused()).toBe('Team A');

    s.keydown('*');
    settle(s);
    expect(page.expanded()).toEqual(['club', 'team-a']);
    expect(labels()).toEqual(['Club', 'Team A', 'Keepers', 'Strikers', 'Team B', 'Archive', 'Imprint']);

    s.keydown('s');
    settle(s);
    expect(focused()).toBe('Strikers');
    s.tick(1000);

    s.keydown(' ');
    settle(s);
    expect(page.value()).toBe('team-a-strikers');

    s.keydown('ArrowLeft');
    settle(s);
    expect(focused()).toBe('Team A');

    s.keydown('ArrowLeft');
    settle(s);
    expect(page.expanded()).toEqual(['club']);

    s.keydown('End');
    settle(s);
    expect(focused()).toBe('Imprint');

    s.keydown('Enter');
    settle(s);
    expect(page.value()).toBe('imprint');
    expect(page.activated).toEqual(['imprint']);

    s.keydown('Home');
    settle(s);
    expect(focused()).toBe('Club');

    s.keydown('ArrowUp');
    settle(s);
    expect(focused()).toBe('Club');
    expect(row('Club').getAttribute('tabindex')).toBe('0');
    expect(row('Imprint').getAttribute('tabindex')).toBe('-1');
  });

  it('moves focus to the surviving parent when an outside write collapses the focused branch', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ClubTreeComponent);
    const page = fixture.componentInstance;

    page.expanded.set(['club', 'team-a']);
    settle(s);
    settle(s);

    row('Keepers').focus();
    s.keydown('ArrowLeft');
    settle(s);
    s.keydown('ArrowLeft');
    settle(s);
    expect(focused()).toBe('Team A');
    expect(page.expanded()).toEqual(['club']);

    page.expanded.set(['club', 'team-a']);
    settle(s);
    row('Strikers').focus();
    settle(s);

    page.expanded.set([]);
    settle(s);

    expect(labels()).toEqual(['Club', 'Archive', 'Imprint']);
    expect(document.activeElement).toBe(row('Club'));
  });

  it('toggles a multiple selection and ignores input while disabled', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(ClubTreeComponent);
    const page = fixture.componentInstance;

    page.mode.set(TREE_SELECTION_MODES.MULTIPLE);
    page.value.set([]);
    page.expanded.set(['club']);
    settle(s);

    expect(document.querySelector('et-tree')?.getAttribute('aria-multiselectable')).toBe('true');
    expect(row('Team A').querySelector('.et-tree-node-check')).not.toBeNull();

    row('Team B').click();
    row('Imprint').click();
    settle(s);
    expect(page.value()).toEqual(['team-b', 'imprint']);

    row('Team B').click();
    settle(s);
    expect(page.value()).toEqual(['imprint']);
    expect(row('Imprint').hasAttribute('data-selected')).toBe(true);

    page.disabled.set(true);
    settle(s);

    expect(document.querySelector('et-tree')?.hasAttribute('data-disabled')).toBe(true);
    expect(rows().every((entry) => entry.getAttribute('aria-disabled') === 'true')).toBe(true);

    row('Team A').click();
    s.keydown('ArrowRight', row('Team A'));
    settle(s);
    expect(page.value()).toEqual(['imprint']);
    expect(page.expanded()).toEqual(['club']);
  });

  it('loads branches lazily with a spinner, shows a failed load and retries it on activation', () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LazyTreeComponent);
    const page = fixture.componentInstance;

    settle(s);

    const tree = document.querySelector('et-tree')!;

    expect(tree.getAttribute('aria-busy')).toBe('true');
    expect(text(document.querySelector('.et-tree-status'))).toBe('Loading club');

    s.tick(200);
    settle(s);

    expect(tree.hasAttribute('aria-busy')).toBe(false);
    expect(document.querySelector('.custom-label')?.getAttribute('data-level')).toBe('1');
    expect(labels()).toEqual(['Club', 'Archive', 'Imprint']);

    row('Club').click();
    settle(s);

    expect(row('Club').getAttribute('aria-busy')).toBe('true');
    expect(row('Club').querySelector('et-spinner')).not.toBeNull();

    s.tick(200);
    settle(s);
    expect(labels()).toEqual(['Club', 'Team A', 'Team B', 'Archive', 'Imprint']);

    row('Team A').click();
    s.tick(200);
    settle(s);

    expect(row('Team A').getAttribute('data-error')).toBe('true');
    expect(row('Team A').querySelector('.et-tree-node-warning')).not.toBeNull();
    expect(text(row('Team A').querySelector('.et-tree-node-error'))).toBe('Roster offline · retry');
    expect(page.expanded()).toEqual(['club', 'team-a']);

    row('Team A').click();
    settle(s);
    s.tick(200);
    settle(s);

    expect(row('Team A').hasAttribute('data-error')).toBe(false);
    expect(page.expanded()).toEqual(['club', 'team-a']);
    expect(labels()).toContain('Keepers');
    expect(page.lazy.calls).toEqual([null, 'club', 'team-a', 'team-a']);

    page.expanded.set(['club']);
    settle(s);
    page.expanded.set(['club', 'team-a']);
    settle(s);
    expect(page.lazy.calls).toHaveLength(4);
  });

  it('shows a failed root load as a retry row and an empty tree as a status line', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(FailingRootComponent);

    settle(s);
    await Promise.resolve();
    await Promise.resolve();
    settle(s);

    const status = document.querySelector<HTMLElement>('.et-tree-status--error')!;

    expect(status.getAttribute('role')).toBe('treeitem');
    expect(text(status)).toBe('Could not load (offline) · select to retry');

    s.keydown('Enter', status);
    settle(s);

    expect(fixture.componentInstance.attempts).toBe(2);
    expect(text(document.querySelector('.et-tree-status'))).toBe('No teams');
  });

  it('localizes the status and retry text app-wide through provideTreeLabels', async () => {
    const s = scenario();
    const fixture = TestBed.createComponent(LocalizedFailingRootComponent);
    const page = fixture.componentInstance;

    settle(s);
    await Promise.resolve();
    await Promise.resolve();
    settle(s);

    expect(page.labels().loading).toBe(DEFAULT_TREE_LABELS.loading);
    expect(page.labelsFromToken).toBeDefined();

    const status = document.querySelector<HTMLElement>('.et-tree-status--error')!;

    expect(text(status)).toBe('Could not load (offline) · zum Wiederholen auswählen');

    s.keydown('Enter', status);
    settle(s);

    expect(text(document.querySelector('.et-tree-status'))).toBe('Keine Teams');
  });

  it('expands and collapses everything loaded from a headless navigation tree', () => {
    const s = scenario();

    TestBed.createComponent(HeadlessTreeComponent);
    settle(s);

    expect(row('Club').hasAttribute('aria-selected')).toBe(false);
    expect(row('Club').getAttribute('data-status')).toBe(TREE_LEVEL_STATUSES.IDLE);

    (document.querySelector('.expand-all') as HTMLElement).click();
    settle(s);
    expect(labels()).toEqual(['Club', 'Team A', 'Team B', 'Archive', 'Imprint']);
    expect(row('Club').getAttribute('data-status')).toBe(TREE_LEVEL_STATUSES.LOADED);

    (document.querySelector('.expand-all') as HTMLElement).click();
    settle(s);
    expect(labels()).toEqual(['Club', 'Team A', 'Keepers', 'Strikers', 'Team B', 'Archive', 'Imprint']);

    row('Keepers').click();
    settle(s);
    expect(row('Keepers').hasAttribute('data-selected')).toBe(false);

    (document.querySelector('.collapse-all') as HTMLElement).click();
    settle(s);
    expect(labels()).toEqual(['Club', 'Archive', 'Imprint']);
  });

  it('reports a tree without a data source and parts outside a tree', () => {
    const s = scenario();

    TestBed.createComponent(StrayTreePartsComponent);
    s.tick(1);

    s.expectError(code(TREE_ERROR_CODES.MISSING_DATA_SOURCE));
    s.expectError(new RegExp(`${code(TREE_ERROR_CODES.PART_OUTSIDE_TREE)}: \\[TreeNodeDirective\\]`));
    s.expectError(new RegExp(`${code(TREE_ERROR_CODES.PART_OUTSIDE_TREE)}: \\[TreeNodeDefDirective\\]`));

    const contexts = s.errors.splice(0).map((entry) => (entry.error as { element?: Node }).element);

    expect(contexts).toEqual(
      expect.arrayContaining([document.querySelector('.no-source'), document.querySelector('.stray-node')]),
    );
    expect(contexts.some((element) => element?.nodeType === Node.COMMENT_NODE)).toBe(true);
  });
});
