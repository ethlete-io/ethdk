import { Component, ViewEncapsulation, signal } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { TREE_IMPORTS, TreeDataSource, TreeNode } from '@ethlete/components';

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
  selector: 'app-tree-default-example',
  template: `
    <div class="example-tree-frame" etAutoSurface>
      <et-tree [(value)]="selectedPath" [(expandedValues)]="expanded" [dataSource]="FILES" aria-label="Project files" />
    </div>

    <p>
      Tab into the tree, then use the arrow keys, Home, End, Enter and <code>*</code>. Selected:
      {{ selectedPath() ?? 'nothing' }}
    </p>
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
export class TreeDefaultExampleComponent {
  protected selectedPath = signal<string | null>(null);
  protected expanded = signal<readonly string[]>(['src']);
  protected readonly FILES: TreeDataSource<string> = { loadChildren: toNodes };
}
