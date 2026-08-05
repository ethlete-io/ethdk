import { Component, ViewEncapsulation, computed, input, signal } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { Observable, map, of, switchMap, throwError, timer } from 'rxjs';
import { FILE_ICON, ICON_IMPORTS, provideIcons } from '../../icon';
import { TreeDataSource, TreeNode, TreeSelectionMode } from '../headless';
import { TREE_IMPORTS } from '../tree.imports';

type FileEntry = { label: string; children?: FileEntry[] };

const FILES: FileEntry[] = [
  {
    label: 'src',
    children: [
      {
        label: 'app',
        children: [
          { label: 'app.component.ts' },
          { label: 'app.config.ts' },
          { label: 'routes', children: [{ label: 'home.routes.ts' }, { label: 'admin.routes.ts' }] },
        ],
      },
      { label: 'assets', children: [{ label: 'logo.svg' }, { label: 'favicon.ico' }] },
      { label: 'main.ts' },
    ],
  },
  {
    label: 'docs',
    children: [{ label: 'getting-started.md' }, { label: 'deployment.md' }],
  },
  { label: 'node_modules', children: [] },
  { label: 'package.json' },
  { label: 'README.md' },
];

/** Depth-first lookup: a node's value is its slash-joined path, so the source can find it again. */
const entryAt = (path: string): FileEntry | null => {
  const segments = path.split('/');
  let entries = FILES;
  let found: FileEntry | null = null;

  for (const segment of segments) {
    found = entries.find((entry) => entry.label === segment) ?? null;

    if (!found) return null;

    entries = found.children ?? [];
  }

  return found;
};

const toNodes = (entries: FileEntry[], parentPath: string): TreeNode<string>[] =>
  entries.map((entry) => ({
    value: parentPath ? parentPath + '/' + entry.label : entry.label,
    label: entry.label,
    isLeaf: entry.children === undefined,
  }));

const childrenOf = (parent: TreeNode<string> | null) => {
  if (!parent) return toNodes(FILES, '');

  return toNodes(entryAt(parent.value)?.children ?? [], parent.value);
};

const syncSource: TreeDataSource<string> = { loadChildren: childrenOf };

/** Every level takes 600ms, and `assets` never loads - the branch shows its message and retries on select. */
const asyncSource: TreeDataSource<string> = {
  loadChildren: (parent) =>
    timer(600).pipe(
      switchMap((): Observable<TreeNode<string>[]> => {
        if (parent?.label === 'assets') {
          return throwError(() => new Error('Could not reach the file service'));
        }

        return of(parent).pipe(map(childrenOf));
      }),
    ),
};

@Component({
  selector: 'et-sb-tree',
  template: `
    <div class="flex flex-col gap-6 p-8 font-sans">
      <div [style.max-inline-size.px]="360" class="et-sb-tree-frame" etAutoSurface>
        <et-tree
          [(value)]="value"
          [(expandedValues)]="expandedValues"
          [dataSource]="dataSource()"
          [selectionMode]="selectionMode()"
          [disabled]="disabled()"
          aria-label="Project files"
        >
          @if (customRows()) {
            <ng-template etTreeNodeDef let-node let-row="row">
              @if (!row.isExpandable) {
                <i etIcon="et-file"></i>
              }
              {{ node.label }}
            </ng-template>
          }
        </et-tree>
      </div>

      <p class="text-small">
        Tab into the tree, then use the arrow keys, Home, End, Enter and <code>*</code>. Selected:
        {{ selectionSummary() }}
      </p>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TREE_IMPORTS, ICON_IMPORTS, AutoSurfaceDirective],
  providers: [provideIcons(FILE_ICON)],
  styles: `
    et-sb-tree .et-sb-tree-frame {
      padding: 8px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 10px;
      background: var(--et-surface-background-solid);
    }

    et-sb-tree .et-tree-node-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    et-sb-tree .et-tree-node-label i {
      inline-size: 12px;
      block-size: 12px;
      color: var(--et-surface-color-muted-solid);
    }
  `,
})
export class TreeStorybookComponent {
  public selectionMode = input<TreeSelectionMode>('single');

  public disabled = input(false);

  public async = input(false);

  public customRows = input(false);

  protected value = signal<string | string[] | null>(null);

  protected expandedValues = signal<readonly string[]>(['src']);

  protected dataSource = computed(() => (this.async() ? asyncSource : syncSource));

  protected selectionSummary = computed(() => {
    const value = this.value();

    if (Array.isArray(value)) {
      return value.length ? value.join(', ') : 'nothing';
    }

    return value ?? 'nothing';
  });
}
