import { forceInteraction, interactionRows, slot } from '@design-system';
import { control } from '@ethlete/components/design/control';
import { icon } from '@system/foundations/icons';
import { tooltip } from '@ethlete/components/design/tooltip';

export type WindowButton = 'minimize' | 'maximize' | 'close';

type Os = 'linux' | 'windows' | 'macos';

type TitleBarControl = 'update' | 'notice' | 'uncommitted' | WindowButton;

type TitleBarInteraction = 'hover' | 'active' | 'focus-visible';

type PushState = { unpushed: number; age: string };

export const pushCount = ({ unpushed }: PushState) => `${unpushed} ungepusht`;

export const openCount = (uncommitted: string[]) => `${uncommitted.length} offen`;

const UNCOMMITTED_KINDS: Record<string, string> = {
  'READY UNCOMMITTED': 'Ready-Marke',
  'SKETCH UNTRACKED': 'Sketch ungetrackt',
  'SKETCH LEFTOVER': 'Sketch übrig',
};

const uncommittedItems = (uncommitted: string[]) =>
  uncommitted.map((line) => {
    const [kind = '', what = ''] = line.slice(0, line.indexOf(':')).split(' studio ');

    return `<span class="flex flex-col"><span class="text-et-surface-muted">${UNCOMMITTED_KINDS[kind] ?? kind}</span><span class="whitespace-nowrap">${what}</span></span>`;
  });

export const withUncommittedHint = (markup: string, { uncommitted, force }: Props) =>
  uncommitted?.length && force?.control === 'uncommitted'
    ? `<span class="relative inline-flex">${markup.replace('<span ', '<span data-et-opened-by="hover" ')}<span class="st-notice-hint absolute top-full right-0 left-0 z-10 mt-2 flex justify-end">${tooltip(
        {
          content: `<span class="flex flex-col gap-1.5">${uncommittedItems(uncommitted).join('')}</span>`,
          placement: 'bottom-end',
        },
      )}</span></span>`
    : markup;

export type Props = {
  os: Os;
  left: WindowButton[];
  right: WindowButton[];
  update: boolean;
  notice?: boolean;
  noticeText?: string;
  push?: PushState;
  uncommitted?: string[];
  restart?: 'pending' | 'failed';
  product: string;
  part: string;
  force?: { control: TitleBarControl; interaction: TitleBarInteraction };
};

const WHERE = { product: 'studio', part: 'Title bar' };

const LINUX_CLOSE: Props = { os: 'linux', left: [], right: ['close'], update: false, ...WHERE };
const LINUX_FULL: Props = { os: 'linux', left: [], right: ['minimize', 'maximize', 'close'], update: false, ...WHERE };
const LINUX_LEFT: Props = { os: 'linux', left: ['close', 'minimize', 'maximize'], right: [], update: false, ...WHERE };
const WINDOWS: Props = { os: 'windows', left: [], right: ['minimize', 'maximize', 'close'], update: false, ...WHERE };
const MACOS: Props = { os: 'macos', left: [], right: [], update: false, ...WHERE };

const INTERACTIONS = ['hover', 'active', 'focus-visible'] as const;

const CONTENTS = {
  notice: { update: true, notice: true, noticeText: 'CLI geändert - neu starten' },
  'cli-dirty': { noticeText: 'CLI hat uncommittete Änderungen, Studio läuft auf Stand 5dbc7ca' },
  update: { update: true },
  rest: {},
} satisfies Record<string, Partial<Props>>;

type Content = keyof typeof CONTENTS;

const ROWS = [
  ['linux-full-update', { ...LINUX_FULL, update: true }, 'update'],
  ['linux-full-notice', { ...LINUX_FULL, ...CONTENTS.notice }, 'notice'],
  ['linux-left', LINUX_LEFT, 'minimize'],
  ['linux-close', LINUX_CLOSE, 'close'],
  ['windows', WINDOWS, 'maximize'],
  ['windows-update', { ...WINDOWS, update: true }, 'close'],
] as const satisfies readonly (readonly [string, Props, TitleBarControl])[];

const rows = ROWS.map(([name, props, control]) =>
  interactionRows<Props, typeof name, TitleBarInteraction>({ [name]: props } as Record<typeof name, Props>, {
    interactions: INTERACTIONS,
    force: (rest, interaction) => ({ ...rest, force: { control, interaction } }),
  }),
);

type RowName = (typeof ROWS)[number][0];

type StateName = RowName | `${RowName}-${TitleBarInteraction}`;

export const grid = {
  columns: ['rest', ...INTERACTIONS] as const,
  rows: Object.assign({}, ...rows.map((row) => row.grid.rows)) as Record<
    RowName,
    Record<'rest' | TitleBarInteraction, StateName>
  >,
};

const LAYOUTS = {
  'linux-full': LINUX_FULL,
  'linux-left': LINUX_LEFT,
  'linux-close': LINUX_CLOSE,
  windows: WINDOWS,
  macos: MACOS,
};

type Layout = keyof typeof LAYOUTS;

const contentStates = (content: Content) =>
  Object.fromEntries(
    Object.entries(LAYOUTS).map(([layout, props]) => [
      content === 'rest' ? layout : `${layout}-${content}`,
      { ...props, ...CONTENTS[content] },
    ]),
  ) as Record<Layout | `${Layout}-${Exclude<Content, 'rest'>}`, Props>;

const PUSH = { unpushed: 158, age: '5 h' } satisfies PushState;

const UNCOMMITTED = [
  'READY UNCOMMITTED studio components/title-bar: marked ready, HEAD has no mark - commit ready.json or the mark is lost',
  'READY UNCOMMITTED studio pages/sketches: marked ready, HEAD has no mark - commit ready.json or the mark is lost',
  'SKETCH UNTRACKED studio pages-system.canvas-note: in progress - commit it or discard it',
];

export const states = {
  push: { ...LINUX_FULL, push: PUSH },
  uncommitted: { ...LINUX_FULL, uncommitted: UNCOMMITTED },
  'uncommitted-push': { ...LINUX_FULL, push: PUSH, uncommitted: UNCOMMITTED },
  'uncommitted-push-hint': {
    ...LINUX_FULL,
    push: PUSH,
    uncommitted: UNCOMMITTED,
    force: { control: 'uncommitted', interaction: 'hover' },
  },
  'push-update': { ...LINUX_FULL, update: true, push: PUSH },
  'macos-push': { ...MACOS, push: PUSH },
  ...contentStates('notice'),
  ...contentStates('cli-dirty'),
  ...(Object.assign({}, ...rows.map((row) => row.states)) as Record<StateName, Props>),
  ...contentStates('update'),
  ...contentStates('rest'),
  'linux-full-notice-pending': { ...LINUX_FULL, ...CONTENTS.notice, restart: 'pending' },
  'linux-full-notice-failed': { ...LINUX_FULL, ...CONTENTS.notice, restart: 'failed' },
} satisfies Record<string, Props>;

/** `control()` for one title-bar control, forced into the interaction its state draws. */
export const titleBarControl = (markup: string, id: TitleBarControl, { force }: Props) => {
  const drawn = control(markup, id);

  return force?.control === id ? forceInteraction(drawn, force.interaction) : drawn;
};

const BUTTON = { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] };

export const controls = {
  search: { kind: 'button' as const, part: 'components/title-search' as const },
  update: BUTTON,
  notice: BUTTON,
  minimize: BUTTON,
  maximize: BUTTON,
  close: BUTTON,
};

export const imports = ['BUTTON_IMPORTS', 'LOADER_IMPORTS'];

const TRAFFIC_LIGHTS = '<span class="size-3 rounded-full bg-et-surface-border" aria-hidden="true"></span>'.repeat(3);

/** The 78 px macOS keeps for its native traffic lights; the drawn ones are demo content that compare empties. */
export const MAC_RESERVE = `<div class="flex w-19.5 shrink-0 items-center gap-2 pl-1.75" data-tauri-drag-region ${slot('traffic-lights')}>${TRAFFIC_LIGHTS}</div>`;

export const LABELS: Record<WindowButton, string> = {
  minimize: 'Minimieren',
  maximize: 'Maximieren',
  close: 'Schließen',
};

/** The window buttons of one side as an Angular template for `ng()`: round on Linux, square tiles on Windows. */
export const windowControls = (props: Props, buttons: WindowButton[]) => {
  const { os } = props;
  if (!buttons.length) return '';

  const shape = os === 'linux' ? 'round' : 'square';
  const items = buttons
    .map((button) =>
      titleBarControl(
        `<button et-window-control-button type="button" color="surface" size="md" shape="${shape}"${
          button === 'close' ? ' kind="close"' : ''
        } data-et-action="emit:${button}" aria-label="${LABELS[button]}">${icon(button, { size: '1em' })}</button>`,
        button,
        props,
      ),
    )
    .join('');

  return `<div class="flex items-center ${os === 'linux' ? 'gap-1.5' : 'gap-0.5'}">${items}</div>`;
};

/** Gives a Windows close tile the error theme's fill and ink on hover, focus and press. */
export const errorClose = (markup: string) =>
  `<span class="contents [--et-window-control-button-close-background-active:rgb(var(--et-color-primary-active))] [--et-window-control-button-close-background:var(--et-theme-color-primary-solid)] [--et-window-control-button-close-color:var(--et-theme-color-on-primary-solid)]" data-et-semantic-color="error">${markup}</span>`;
