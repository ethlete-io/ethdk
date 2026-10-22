import { Component, ViewEncapsulation, signal } from '@angular/core';
import { AutoSurfaceDirective } from '@ethlete/core';
import { FILE_ICON, ICON_IMPORTS, TREE_IMPORTS, TreeDataSource, TreeNode, provideIcons } from '@ethlete/components';

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
  selector: 'app-tree-custom-rows-example',
  template: `
    <div class="example-tree-frame" etAutoSurface>
      <et-tree [(value)]="selectedPath" [(expandedValues)]="expanded" [dataSource]="FILES" aria-label="Project files">
        <ng-template etTreeNodeDef let-node let-row="row">
          @if (!row.isExpandable) {
            <i etIcon="et-file"></i>
          }
          {{ node.label }}
        </ng-template>
      </et-tree>
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TREE_IMPORTS, ICON_IMPORTS, AutoSurfaceDirective],
  providers: [provideIcons(FILE_ICON)],
  styles: `
    .example-tree-frame {
      inline-size: 360px;
      padding: 8px;
      border: 1px solid var(--et-surface-border-solid);
      border-radius: 10px;
      background: var(--et-surface-background-solid);
    }

    .example-tree-frame .et-tree-node-label {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .example-tree-frame .et-tree-node-label i {
      inline-size: 12px;
      block-size: 12px;
      color: var(--et-surface-color-muted-solid);
    }
  `,
})
export class TreeCustomRowsExampleComponent {
  protected selectedPath = signal<string | null>(null);
  protected expanded = signal<readonly string[]>(['src']);
  protected readonly FILES: TreeDataSource<string> = { loadChildren: toNodes };
}
