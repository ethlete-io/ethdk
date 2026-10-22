import { Component, ViewEncapsulation, signal } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { TREE_IMPORTS, TreeDataSource, TreeNode } from '@ethlete/components';
import { Observable, of, switchMap, throwError, timer } from 'rxjs';

const TREE: Record<string, string[]> = {
  '': ['src', 'docs', 'package.json', 'README.md'],
  src: ['src/app', 'src/assets', 'src/main.ts'],
  'src/app': ['src/app/app.component.ts', 'src/app/app.config.ts'],
  'src/assets': ['src/assets/logo.svg', 'src/assets/favicon.ico'],
  docs: ['docs/getting-started.md', 'docs/deployment.md'],
};

const toNodes = (parent: TreeNode<string> | null): TreeNode<string>[] =>
  (TREE[parent?.value ?? ''] ?? []).map((value) => ({
    value,
    label: value.split('/').at(-1) ?? value,
    isLeaf: !(value in TREE),
  }));

@Component({
  selector: 'app-tree-lazy-loading-example',
  template: `
    <div class="example-tree-frame" etAutoSurface>
      <et-tree [(value)]="selectedPath" [dataSource]="files" aria-label="Project files" />
    </div>

    <p>Every level takes 600ms. The assets branch always fails: select it again to retry.</p>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TREE_IMPORTS, AutoSurfaceDirective],
  styles: `
    .example-tree-frame {
      inline-size: 360px;
      padding: 8px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 10px;
      background: var(--et-surface-background-solid);
    }
  `,
})
export class TreeLazyLoadingExampleComponent {
  protected selectedPath = signal<string | null>(null);

  protected readonly files: TreeDataSource<string> = {
    loadChildren: (parent) =>
      timer(600).pipe(
        switchMap((): Observable<TreeNode<string>[]> => {
          if (parent?.label === 'assets') {
            return throwError(() => new Error('Could not reach the file service'));
          }

          return of(toNodes(parent));
        }),
      ),
  };
}
