import { Component, computed, input, linkedSignal, output, ViewEncapsulation } from '@angular/core';
import { TREE_IMPORTS, TreeDataSource, TreeNode } from '@ethlete/components';
import { TreeRow, TreeRowItemComponent } from '../tree-row/tree-row-item.component';

export type PartTreeState = { name: string; inert?: boolean; selected?: boolean };

export type PartTreePart = {
  name: string;
  warns?: boolean;
  leaf?: boolean;
  selected?: boolean;
  states?: PartTreeState[];
};

export type PartTreeLayer = { title: string; open: boolean; parts: PartTreePart[] };

type RowMarks = Pick<TreeRow, 'kind' | 'selected' | 'inert' | 'warning'>;

const keyOf = (...names: string[]) => names.join('/');

/** The Studio part tree: layers, then their parts, then the frames of an open part, drawn with tree rows. */
@Component({
  selector: 'ethlete-part-tree',
  template: `
    <div
      #tree="etTree"
      [(expandedValues)]="expandedValues"
      [dataSource]="dataSource()"
      [attr.aria-label]="label()"
      (nodeActivate)="activate.emit($event.value)"
      class="flex flex-col gap-px"
      selectionMode="none"
      etTree
    >
      @for (row of tree.visibleRows(); track row.node.value) {
        @let marks = model().marks.get(row.node.value);
        <div
          [row]="row"
          [item]="{
            label: row.node.label,
            depth: row.level - 1,
            kind: marks?.kind ?? 'leaf',
            expanded: row.isExpanded,
            selected: marks?.selected,
            inert: marks?.inert,
            warning: marks?.warning,
          }"
          etTreeNode
          ethlete-tree-row-item
        ></div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TREE_IMPORTS, TreeRowItemComponent],
  host: { class: 'block' },
})
export class PartTreeComponent {
  public layers = input<PartTreeLayer[]>([]);
  public label = input('Designsystem');
  public warningTitle = input('Render-Check: 1 Warnung');

  /** The key of an activated row: `layer`, `layer/part` or `layer/part/state`. */
  public activate = output<string>();

  protected model = computed(() => {
    const children = new Map<string | null, TreeNode<string>[]>();
    const marks = new Map<string, RowMarks>();
    const open: string[] = [];
    const warning = this.warningTitle();

    const stateNode = (partKey: string, state: PartTreeState): TreeNode<string> => {
      const value = keyOf(partKey, state.name);

      marks.set(value, { kind: 'leaf', inert: state.inert, selected: state.selected });

      return { value, label: state.name, isLeaf: true };
    };

    const partNode = (layerKey: string, part: PartTreePart): TreeNode<string> => {
      const value = keyOf(layerKey, part.name);

      marks.set(value, {
        kind: part.leaf ? 'leaf' : 'part',
        selected: part.selected,
        warning: part.warns ? warning : undefined,
      });

      if (part.leaf) return { value, label: part.name, isLeaf: true };

      if (part.states) open.push(value);
      children.set(
        value,
        (part.states ?? []).map((state) => stateNode(value, state)),
      );

      return { value, label: part.name };
    };

    children.set(
      null,
      this.layers().map((layer) => {
        marks.set(layer.title, { kind: 'group' });
        if (layer.open) open.push(layer.title);
        children.set(
          layer.title,
          layer.parts.map((part) => partNode(layer.title, part)),
        );

        return { value: layer.title, label: layer.title };
      }),
    );

    return { children, marks, open };
  });

  protected dataSource = computed<TreeDataSource<string>>(() => {
    const { children } = this.model();

    return { loadChildren: (parent) => children.get(parent?.value ?? null) ?? [] };
  });

  protected expandedValues = linkedSignal<readonly string[]>(() => this.model().open);
}
