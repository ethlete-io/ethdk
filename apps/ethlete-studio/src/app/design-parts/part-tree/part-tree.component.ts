import { Component, computed, input, linkedSignal, output, ViewEncapsulation } from '@angular/core';
import { TREE_IMPORTS, TreeDataSource, TreeNode } from '@ethlete/components';
import { TreeRow, TreeRowItemComponent } from '../tree-row/tree-row-item.component';

export type PartTreeState = { name: string; key?: string; inert?: boolean; selected?: boolean };

export type PartTreePart = {
  name: string;
  key?: string;
  /** A string is the warning's own title instead of `warningTitle`. */
  warns?: boolean | string;
  leaf?: boolean;
  selected?: boolean;
  /** Whether the part shows its states; without it, a part with `states` is open. */
  open?: boolean;
  states?: PartTreeState[];
};

export type PartTreeLayer = { title: string; key?: string; open: boolean; parts: PartTreePart[] };

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
      (expandedValuesChange)="expandedChange.emit($event)"
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

  /** The key of an activated row: its own `key`, else `layer`, `layer/part` or `layer/part/state`. */
  public activate = output<string>();

  /** The keys of the open layers and parts after the user opened or closed one. */
  public expandedChange = output<readonly string[]>();

  protected model = computed(() => {
    const children = new Map<string | null, TreeNode<string>[]>();
    const marks = new Map<string, RowMarks>();
    const open: string[] = [];
    const warning = this.warningTitle();

    const stateNode = (partKey: string, state: PartTreeState): TreeNode<string> => {
      const value = state.key ?? keyOf(partKey, state.name);

      marks.set(value, { kind: 'leaf', inert: state.inert, selected: state.selected });

      return { value, label: state.name, isLeaf: true };
    };

    const partNode = (layerKey: string, part: PartTreePart): TreeNode<string> => {
      const value = part.key ?? keyOf(layerKey, part.name);

      marks.set(value, {
        kind: part.leaf ? 'leaf' : 'part',
        selected: part.selected,
        warning: typeof part.warns === 'string' ? part.warns : part.warns ? warning : undefined,
      });

      if (part.leaf) return { value, label: part.name, isLeaf: true };

      if (part.open ?? part.states !== undefined) open.push(value);
      children.set(
        value,
        (part.states ?? []).map((state) => stateNode(value, state)),
      );

      return { value, label: part.name };
    };

    children.set(
      null,
      this.layers().map((layer) => {
        const value = layer.key ?? layer.title;

        marks.set(value, { kind: 'group' });
        if (layer.open) open.push(value);
        children.set(
          value,
          layer.parts.map((part) => partNode(value, part)),
        );

        return { value, label: layer.title };
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
