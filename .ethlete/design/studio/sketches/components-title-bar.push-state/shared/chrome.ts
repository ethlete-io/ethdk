import { forceInteraction, interactionRows, slot } from '@design-system';
import { control } from '@ethlete/components/design/control';
import { icon } from '@system/foundations/icons';

export type WindowButton = 'minimize' | 'maximize' | 'close';

type Os = 'linux' | 'windows' | 'macos';

type TitleBarControl = 'update' | 'notice' | WindowButton;

type TitleBarInteraction = 'hover' | 'active' | 'focus-visible';

export type PushGate = 'green' | 'red' | 'unknown';

type PushState = { unpushed: number; age: string; gate: PushGate };

export const PUSH_GATE_LABEL: Record<PushGate, string> = {
  green: 'Push-Gate grün',
  red: 'Push-Gate rot',
  unknown: 'Push-Gate nicht gelaufen',
};

export const PUSH_RED_ADVICE = 'vor jedem Feature-Slice beheben';

export const pushCount = ({ unpushed }: PushState) => `${unpushed} ungepusht`;

export const pushAge = ({ age }: PushState) => `ältester ${age}`;

export type Props = {
  os: Os;
  left: WindowButton[];
  right: WindowButton[];
  update: boolean;
  notice?: boolean;
  noticeText?: string;
  push?: PushState;
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

const ROWS = [
  ['linux-full-update', { ...LINUX_FULL, update: true }, 'update'],
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

const CONTENTS = {
  notice: { update: true, notice: true, noticeText: 'CLI geändert - neu starten' },
  'cli-dirty': { noticeText: 'CLI hat uncommittete Änderungen, Studio läuft auf Stand 5dbc7ca' },
  update: { update: true },
  rest: {},
} satisfies Record<string, Partial<Props>>;

type Content = keyof typeof CONTENTS;

const contentStates = (content: Content) =>
  Object.fromEntries(
    Object.entries(LAYOUTS).map(([layout, props]) => [
      content === 'rest' ? layout : `${layout}-${content}`,
      { ...props, ...CONTENTS[content] },
    ]),
  ) as Record<Layout | `${Layout}-${Exclude<Content, 'rest'>}`, Props>;

const PUSH = {
  green: { unpushed: 3, age: '40 min', gate: 'green' },
  unknown: { unpushed: 12, age: '2 h', gate: 'unknown' },
  red: { unpushed: 158, age: '5 h', gate: 'red' },
} satisfies Record<PushGate, PushState>;

export const states = {
  'push-green': { ...LINUX_FULL, push: PUSH.green },
  'push-unknown': { ...LINUX_FULL, push: PUSH.unknown },
  'push-red': { ...LINUX_FULL, push: PUSH.red },
  'push-red-update': { ...LINUX_FULL, update: true, push: PUSH.red },
  'macos-push-red': { ...MACOS, push: PUSH.red },
  ...contentStates('notice'),
  ...contentStates('cli-dirty'),
  ...(Object.assign({}, ...rows.map((row) => row.states)) as Record<StateName, Props>),
  ...contentStates('update'),
  ...contentStates('rest'),
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

export const imports = ['BUTTON_IMPORTS'];

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
