import { interactionRows, type Interaction } from '@design-system';
import type { Row } from '@system/components/tree-row';

type RowInteraction = Extract<Interaction, 'hover' | 'active' | 'focus-visible'>;

type TreePart = {
  name: string;
  interaction?: RowInteraction;
  warns?: boolean;
  leaf?: boolean;
  selected?: boolean;
  open?: boolean;
  nested?: TreePart[];
};
type TreeLayer = { title: string; open: boolean; parts: TreePart[] };
export type OpenSketch = { part: string; name?: string; status: 'in-progress' | 'ready' };
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

const partRows = (part: TreePart, depth: number): Row[] => {
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
      ...(part.interaction ? { interaction: part.interaction } : {}),
      ...(part.warns ? { warning: 'Render check: 1 warning' } : {}),
    },
    ...(open ? (part.nested ?? []).flatMap((child) => partRows(child, depth + 1)) : []),
  ];
};

const layerRows = (layer: TreeLayer): Row[] => [
  group(layer.title, layer.open),
  ...(layer.open ? layer.parts.flatMap((part) => partRows(part, 1)) : []),
];

const legacyRows = ({ open, projects }: NonNullable<Props['legacy']>): Row[] => [
  group('Legacy', open),
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

const componentParts = (interaction?: RowInteraction, hostOpen = true): TreePart[] => [
  { name: 'button' },
  { name: 'select', warns: true },
  {
    name: 'title-bar',
    open: hostOpen,
    nested: [{ name: 'title-search', ...(interaction ? { interaction } : {}) }],
  },
  { name: 'tree-row', selected: true },
];

const layers = (
  open: Partial<Record<'Foundations' | 'Elements' | 'Components' | 'Pages', boolean>>,
  parts: TreePart[],
) => [
  { title: 'Foundations', open: open.Foundations === true, parts: [{ name: 'colors' }, { name: 'tokens' }] },
  {
    title: 'Elements',
    open: open.Elements === true,
    parts: [{ name: 'part-tree' }, { name: 'shell-main' }, { name: 'studio-menu' }],
  },
  { title: 'Components', open: open.Components === true, parts },
  { title: 'Pages', open: open.Pages === true, parts: [{ name: 'inventory' }, { name: 'system' }] },
];

const atRest = (interaction?: RowInteraction): Props => ({
  sketches: { open: true, items: openSketches },
  layers: layers({ Components: true }, componentParts(interaction)),
  legacy: { open: false, projects: legacyProjects },
});

const rows = interactionRows<Props, 'row', RowInteraction>(
  { row: atRest() },
  { interactions: ['hover', 'active', 'focus-visible'], force: (_, interaction) => atRest(interaction) },
);

export const treeStates = {
  'components-open': atRest(),
  remembered: {
    sketches: { open: false, items: openSketches },
    layers: layers({ Components: true, Elements: true }, componentParts(undefined, false)),
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
  ...rows.states,
} satisfies Record<string, Props>;

export const treeGrid = rows.grid;
