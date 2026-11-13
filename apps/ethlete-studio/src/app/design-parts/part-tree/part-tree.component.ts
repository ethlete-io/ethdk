import { Component, computed, input, linkedSignal, output, viewChild, ViewEncapsulation } from '@angular/core';
import { TREE_IMPORTS, TreeDataSource, TreeDirective, TreeNode } from '@ethlete/components';
import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { TreeRow, TreeRowItemComponent, TreeRowStatus } from '../tree-row/tree-row-item.component';

type Marks = {
  key?: string;
  selected?: boolean;
  /** A string is the warning's own title instead of `warningTitle`. */
  warns?: boolean | string;
};

/** A part; one with `nested` parts is their host and opens unless `open` is false. */
export type PartTreePart = Marks & { name: string; open?: boolean; nested?: PartTreePart[] };

export type PartTreeLayer = { title: string; key?: string; open: boolean; parts: PartTreePart[] };

/** A sketch; one with `nested` target parts is their open host. */
export type PartTreeSketch = Marks & { part: string; name?: string; status: TreeRowStatus; nested?: PartTreePart[] };

export type PartTreeSketches = { key?: string; open: boolean; items: PartTreeSketch[] };

export type PartTreeCall = Marks & { name: string };

/** A legacy project, closed unless `open` is true. */
export type PartTreeLegacyProject = { name: string; key?: string; open?: boolean; calls: (string | PartTreeCall)[] };

export type PartTreeLegacy = { key?: string; open: boolean; projects: PartTreeLegacyProject[] };

export type PartTree = { layers: PartTreeLayer[]; sketches?: PartTreeSketches; legacy?: PartTreeLegacy };

type RowMarks = Pick<TreeRow, 'kind' | 'selected' | 'warning' | 'status'>;

const keyOf = (...names: string[]) => names.join('/');

/** The Studio part tree: open sketches on top, then the layers with their parts, then the Legacy projects, drawn with tree rows. */
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
            warning: marks?.warning,
            status: marks?.status,
          }"
          etTreeNode
          ethlete-tree-row-item
        ></div>
      }
    </div>
  `,
  encapsulation: ViewEncapsulation.None,
  imports: [TREE_IMPORTS, TreeRowItemComponent],
  host: { class: 'block', '(keydown.space)': 'activateFocused($event)' },
})
export class PartTreeComponent {
  public layers = input<PartTreeLayer[]>([]);
  public sketches = input<PartTreeSketches>();
  public legacy = input<PartTreeLegacy>();
  public label = input('Designsystem');
  public warningTitle = input('Render-Check: 1 Warnung');

  /** The key of an activated row: its own `key`, else the path of labels from its group down, joined by `/`. */
  public activate = output<string>();

  /** The keys of the open groups, hosts and projects after the user opened or closed one. */
  public expandedChange = output<readonly string[]>();

  public tree = viewChild(TreeDirective<string>);

  protected model = computed(() => {
    const children = new Map<string | null, TreeNode<string>[]>();
    const marks = new Map<string, RowMarks>();
    const open: string[] = [];
    const warning = this.warningTitle();

    const add = (node: {
      value: string;
      label: string;
      mark: RowMarks;
      open?: boolean;
      nodes?: TreeNode<string>[];
    }) => {
      marks.set(node.value, node.mark);
      if (!node.nodes) return { value: node.value, label: node.label, isLeaf: true };
      if (node.open) open.push(node.value);
      children.set(node.value, node.nodes);

      return { value: node.value, label: node.label };
    };
    const markOf = (kind: RowMarks['kind'], own: Marks = {}): RowMarks => ({
      kind,
      selected: own.selected,
      warning: typeof own.warns === 'string' ? own.warns : own.warns ? warning : undefined,
    });

    const partNode = (parentKey: string, part: PartTreePart): TreeNode<string> => {
      const value = part.key ?? keyOf(parentKey, part.name);
      const host = !!part.nested?.length;

      return add({
        value,
        label: part.name,
        mark: markOf(host ? 'part' : 'leaf', part),
        open: part.open !== false,
        nodes: host ? part.nested?.map((child) => partNode(value, child)) : undefined,
      });
    };

    const sketchGroup = (group: PartTreeSketches) => {
      const value = group.key ?? STUDIO_LABELS.systemTree.sketches;

      return add({
        value,
        label: STUDIO_LABELS.systemTree.sketches,
        mark: markOf('group'),
        open: group.open,
        nodes: group.items.map((item) => {
          const label = item.name ? `${item.part}@${item.name}` : item.part;
          const itemKey = item.key ?? keyOf(value, label);
          const host = !!item.nested?.length;

          return add({
            value: itemKey,
            label,
            mark: { ...markOf(host ? 'part' : 'leaf', item), status: item.status },
            open: true,
            nodes: host ? item.nested?.map((child) => partNode(itemKey, child)) : undefined,
          });
        }),
      });
    };

    const legacyGroup = (group: PartTreeLegacy) => {
      const value = group.key ?? STUDIO_LABELS.systemTree.legacy;

      return add({
        value,
        label: STUDIO_LABELS.systemTree.legacy,
        mark: markOf('group'),
        open: group.open,
        nodes: group.projects.map((project) => {
          const projectKey = project.key ?? keyOf(value, project.name);

          return add({
            value: projectKey,
            label: project.name,
            mark: markOf('part'),
            open: project.open === true,
            nodes: project.calls.map((call) => {
              const own = typeof call === 'string' ? { name: call } : call;

              return add({ value: own.key ?? keyOf(projectKey, own.name), label: own.name, mark: markOf('leaf', own) });
            }),
          });
        }),
      });
    };

    const sketches = this.sketches();
    const legacy = this.legacy();

    children.set(null, [
      ...(sketches ? [sketchGroup(sketches)] : []),
      ...this.layers().map((layer) => {
        const value = layer.key ?? layer.title;

        return add({
          value,
          label: layer.title,
          mark: markOf('group'),
          open: layer.open,
          nodes: layer.parts.map((part) => partNode(value, part)),
        });
      }),
      ...(legacy ? [legacyGroup(legacy)] : []),
    ]);

    return { children, marks, open };
  });

  protected dataSource = computed<TreeDataSource<string>>(() => {
    const { children } = this.model();

    return { loadChildren: (parent) => children.get(parent?.value ?? null) ?? [] };
  });

  protected expandedValues = linkedSignal<readonly string[]>(() => this.model().open);

  protected activateFocused(event: Event) {
    const tree = this.tree();
    const node = tree?.activeNode();

    if (!tree || !node) return;

    event.preventDefault();
    tree.activate(node);
  }
}
