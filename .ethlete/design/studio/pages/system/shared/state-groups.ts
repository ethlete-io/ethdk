import { drawing, html } from '@design-system';
import { canvasFrame, canvasFrameStyles } from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';
import { studioMenu } from '@system/elements/studio-menu';

const SYSTEM_STATES = [
  'part',
  'empty',
  'listing-error',
  'canvas-note',
  'many-states',
  'fit',
  'points-closed',
  'nothing-open',
  'comment-mode',
  'comment-draft',
  'comment-draft-typed',
  'send-busy',
  'send-error',
  'send-rejected',
  'comments',
  'comments-mode',
  'comments-draft',
  'one-blocker',
  'checking',
  'blocked-checking',
  'direct-edit',
  'direct-edit-closed',
  'blockers-open',
  'agent-working',
  'agent-working-ready',
  'agent-failed',
  'agent-failed-ready',
  'agent-waiting',
  'agent-interrupted',
  'call',
  'call-transferred',
];

export type StateGroup = { name: string; states: string[] };

const REST_GROUP = 'Weitere';

const groupStates = (states: string[]): StateGroup[] => {
  const byPrefix = new Map<string, string[]>();
  for (const state of states) {
    const prefix = state.split('-')[0] ?? state;
    byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), state]);
  }
  const groups = [...byPrefix].filter(([, members]) => members.length > 1);
  const rest = [...byPrefix].filter(([, members]) => members.length === 1).flatMap(([, members]) => members);
  return [
    ...groups.map(([name, members]) => ({ name, states: members })),
    ...(rest.length ? [{ name: REST_GROUP, states: rest }] : []),
  ];
};

export const SYSTEM_GROUPS = groupStates(SYSTEM_STATES);

const thumbnail = html`<div class="flex h-36 w-60">
  <div class="w-14 border-e border-et-surface-border"></div>
  <div class="flex flex-1 items-center justify-center"><div class="h-12 w-24 bg-et-surface-interaction"></div></div>
</div>`;

export const stateFrame = (state: string) => canvasFrame(state, thumbnail);

export const groupCount = (group: StateGroup) =>
  html`<span class="text-et-surface-muted tabular-nums">${String(group.states.length)}</span>`;

const treeOfSystem = {
  layers: [
    { title: 'Foundations', open: false, parts: [] },
    { title: 'Components', open: false, parts: [] },
    { title: 'Elements', open: false, parts: [] },
    {
      title: 'Pages',
      open: true,
      parts: [{ name: 'inbox' }, { name: 'sketches' }, { name: 'start' }, { name: 'system', selected: true }],
    },
  ],
};

export const stateGroupsPage = async (content: string, styles = '') => {
  const tree = await partTree.render(treeOfSystem);
  const menu = await studioMenu({ open: false });
  const shell = await shellMain.render({
    studio: menu.body,
    section: 'System',
    product: 'studio',
    side: tree.body,
    content,
  });
  return drawing({
    body: shell.body,
    setup: menu.setup,
    styles: shell.styles + menu.styles + tree.styles + canvasFrameStyles + styles,
  });
};
