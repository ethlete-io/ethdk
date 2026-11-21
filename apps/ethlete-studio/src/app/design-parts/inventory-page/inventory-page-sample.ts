import { STUDIO_LABELS } from '../../i18n/studio-labels';
import { PartTree } from '../part-tree/part-tree.component';
import { InventoryPageEntry, InventoryPageRow, InventoryPageState } from './inventory-page.component';

const LABELS = STUDIO_LABELS.inventory;
const NAMES = LABELS.sample;

export const INVENTORY_PAGE_TREE: PartTree = {
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    { title: 'Elements', open: false, parts: [] },
    { title: 'Components', open: false, parts: [] },
    {
      title: 'Pages',
      open: true,
      parts: [{ name: 'flows', selected: true }, { name: 'inbox' }, { name: 'system' }],
    },
  ],
};

const SHOT = { width: 1440, height: 900 };

const MENU = { x: 12, y: 12, width: 40, height: 40 };

const FLOWS: Pick<InventoryPageEntry, 'controls' | 'assets' | 'overlays'> = {
  controls: [
    { number: '1', name: NAMES.studio, detail: LABELS.status.undeclared, tone: 'error', box: MENU },
    {
      number: '2',
      name: NAMES.system,
      detail: LABELS.ownedBy('elements/shell-main'),
      tone: 'ok',
      box: { x: 12, y: 72, width: 40, height: 40 },
    },
    {
      number: '3',
      name: NAMES.sketchCheck,
      detail: LABELS.status.declared,
      tone: 'ok',
      box: { x: 72, y: 72, width: 216, height: 28 },
    },
    {
      number: '4',
      name: NAMES.preset,
      detail: LABELS.status.unclassified,
      tone: 'warning',
      box: { x: 1172, y: 20, width: 240, height: 36 },
    },
  ],
  assets: [
    { number: 'A1', name: NAMES.logo, detail: LABELS.ownedBy('foundations/logo'), tone: 'ok', box: MENU },
    {
      number: 'A2',
      name: NAMES.arrow,
      detail: LABELS.assetFinding,
      tone: 'error',
      box: { x: 640, y: 420, width: 24, height: 24 },
    },
  ],
  overlays: [
    {
      number: 'O1',
      name: NAMES.size,
      detail: LABELS.ownedBy('components/menu'),
      tone: 'ok',
      box: { x: 1172, y: 60, width: 240, height: 160 },
    },
  ],
};

const resolvedAs =
  (detail: string) =>
  (row: InventoryPageRow): InventoryPageRow =>
    row.tone === 'ok' ? row : { ...row, tone: 'ok', detail };

const page = (entry: Omit<InventoryPageEntry, 'shot' | 'size'>): InventoryPageEntry => ({
  ...entry,
  shot: null,
  size: SHOT,
});

export const inventoryPageSampleOf = (state: InventoryPageState): InventoryPageEntry[] => [
  page({
    part: 'pages/flows',
    approval: state === 'approved' ? 'approved' : state === 'approvable' ? 'approvable' : 'open',
    approvalLabel: state === 'approved' ? LABELS.approvedBy : LABELS.notApproved,
    ...(state === 'open'
      ? FLOWS
      : {
          controls: FLOWS.controls.map(resolvedAs(LABELS.status.declared)),
          assets: FLOWS.assets.map(resolvedAs(LABELS.ownedBy('foundations/icons'))),
          overlays: FLOWS.overlays.map(resolvedAs(LABELS.ownedBy('foundations/icons'))),
        }),
  }),
  page({
    part: 'pages/inbox',
    approval: 'approved',
    approvalLabel: LABELS.approvedBy,
    controls: [
      { number: '1', name: NAMES.studio, detail: LABELS.ownedBy('elements/studio-menu'), tone: 'ok', box: MENU },
      {
        number: '2',
        name: NAMES.reply,
        detail: LABELS.ownedBy('components/button'),
        tone: 'ok',
        box: { x: 1260, y: 820, width: 140, height: 40 },
      },
    ],
    assets: [],
    overlays: [],
  }),
  page({
    part: 'pages/system',
    approval: 'approvable',
    approvalLabel: LABELS.notApproved,
    controls: [
      { number: '1', name: NAMES.studio, detail: LABELS.ownedBy('elements/studio-menu'), tone: 'ok', box: MENU },
      {
        number: '2',
        name: NAMES.canvas,
        detail: LABELS.ownedBy('components/canvas-viewport'),
        tone: 'ok',
        box: { x: 300, y: 64, width: 1128, height: 824 },
      },
    ],
    assets: [{ number: 'A1', name: NAMES.logo, detail: LABELS.ownedBy('foundations/logo'), tone: 'ok', box: MENU }],
    overlays: [],
  }),
];
