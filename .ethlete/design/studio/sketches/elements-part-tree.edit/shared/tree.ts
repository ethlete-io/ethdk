import type { Row } from '@system/components/tree-row';
import { SYSTEM_TREE_LABELS, TREE_ROW_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/system-labels';

type TreePart = {
  name: string;
  warns?: boolean;
  leaf?: boolean;
  selected?: boolean;
  layer?: string;
  layerKey?: string;
  open?: boolean;
  nested?: TreePart[];
};
type TreeLayer = { title: string; open: boolean; parts: TreePart[] };
export type OpenSketch = {
  part: string;
  name?: string;
  status: 'in-progress' | 'ready';
  selected?: boolean;
  open?: boolean;
  nested?: TreePart[];
};
type LegacyProject = { name: string; open?: boolean; calls: string[] };

export type Props = {
  layers: TreeLayer[];
  sketches?: { open: boolean; items: OpenSketch[] };
  legacy?: { open: boolean; projects: LegacyProject[] };
};

type SketchRows = (items: OpenSketch[]) => Row[];

const group = (label: string, expanded: boolean): Row => ({
  label,
  depth: 0,
  kind: 'group',
  expanded,
  action: 'emit:expandedChange',
});

export const partRows = (part: TreePart, depth: number): Row[] => {
  const host = part.nested !== undefined && part.nested.length > 0;
  const open = host && part.open !== false;

  return [
    {
      label: part.name,
      depth,
      kind: host ? 'part' : 'leaf',
      action: host ? 'emit:expandedChange' : 'emit:activate',
      ...(host ? { expanded: open } : {}),
      selected: part.selected === true,
      ...(part.warns ? { warning: [TREE_ROW_LABELS.warnings['changed since ready']] } : {}),
      ...(part.layer ? { layer: part.layer, ...(part.layerKey ? { layerKey: part.layerKey } : {}) } : {}),
    },
    ...(open ? (part.nested ?? []).flatMap((child) => partRows(child, depth + 1)) : []),
  ];
};

const layerRows = (layer: TreeLayer): Row[] => [
  group(layer.title, layer.open),
  ...(layer.open ? layer.parts.flatMap((part) => partRows(part, 1)) : []),
];

const legacyRows = ({ open, projects }: NonNullable<Props['legacy']>): Row[] => [
  group(SYSTEM_TREE_LABELS.legacy, open),
  ...(open
    ? projects.flatMap((project): Row[] => [
        {
          label: project.name,
          depth: 1,
          kind: 'part',
          expanded: project.open === true,
          action: 'emit:expandedChange',
        },
        ...(project.open === true
          ? project.calls.map((call): Row => ({ label: call, depth: 2, kind: 'leaf', action: 'emit:activate' }))
          : []),
      ])
    : []),
];

export const segments = (props: Props, sketchRows: SketchRows) => ({
  sketches: props.sketches
    ? [group('Sketches', props.sketches.open), ...(props.sketches.open ? sketchRows(props.sketches.items) : [])]
    : [],
  layers: props.layers.flatMap(layerRows),
  legacy: props.legacy ? legacyRows(props.legacy) : [],
});

const openSketches: OpenSketch[] = [
  { part: 'command-palette', status: 'ready' },
  { part: 'sketches', name: 'change-crop', status: 'ready' },
  { part: 'shell-main', name: 'logo-menu', status: 'ready' },
  { part: 'shell-main', name: 'sidebar-resize', status: 'ready' },
  { part: 'part-tree', name: 'parts-only', status: 'in-progress' },
];

const legacyProjects: LegacyProject[] = [
  { name: 'components', calls: ['bar-chart', 'form-mock', 'calendar-contrast'] },
  { name: 'studio', calls: ['chat-surface', 'workbench', 'tile-controls', 'verdict-mark'] },
  { name: 'timetrack', calls: [] },
];

const componentParts = (hostOpen = true): TreePart[] => [
  { name: 'button' },
  { name: 'select', warns: true },
  {
    name: 'title-bar',
    open: hostOpen,
    nested: [{ name: 'title-search' }],
  },
  { name: 'tree-row', selected: true },
];

const layers = (
  open: Partial<Record<'Foundations' | 'Elements' | 'Components' | 'Pages', boolean>>,
  parts: TreePart[],
  pages: TreePart[] = [{ name: 'inventory' }, { name: 'system' }],
) => [
  { title: 'Foundations', open: open.Foundations === true, parts: [{ name: 'colors' }, { name: 'tokens' }] },
  {
    title: 'Elements',
    open: open.Elements === true,
    parts: [{ name: 'part-tree' }, { name: 'shell-main' }, { name: 'studio-menu' }],
  },
  { title: 'Components', open: open.Components === true, parts },
  { title: 'Pages', open: open.Pages === true, parts: pages },
];

const atRest = (): Props => ({
  sketches: { open: true, items: openSketches },
  layers: layers({ Components: true }, componentParts()),
  legacy: { open: false, projects: legacyProjects },
});

export const treeStates = {
  'components-open': atRest(),
  remembered: {
    sketches: { open: false, items: openSketches },
    layers: layers({ Components: true, Elements: true }, componentParts(false)),
    legacy: { open: false, projects: legacyProjects },
  },
  'legacy-open': {
    sketches: { open: false, items: openSketches },
    layers: layers({}, componentParts()),
    legacy: {
      open: true,
      projects: legacyProjects.map((project) => (project.name === 'studio' ? { ...project, open: true } : project)),
    },
  },
  'cross-layer': {
    sketches: { open: false, items: openSketches },
    layers: layers({ Pages: true }, componentParts(), [
      { name: 'inventory' },
      { name: 'sketches', nested: [{ name: 'hold-trigger', layer: 'Components', layerKey: 'components' }] },
      { name: 'system' },
    ]),
    legacy: { open: false, projects: legacyProjects },
  },
  row: atRest(),
} satisfies Record<string, Props>;
