import { forceInteraction, html, interactionRows } from '@design-system';
import { control } from '@ethlete/components/design/control';
import titleBar from '@system/components/title-bar';

type Control = 'restart' | 'later';
type Interaction = 'hover' | 'active' | 'focus-visible';

export type Props = { version: string; force?: { control: Control; interaction: Interaction } };

const VERSION = '0.42.0';

const interactions = ['hover', 'active', 'focus-visible'] as const;

const rowOf = (name: Control) =>
  interactionRows<Props, Control, Interaction>({ [name]: { version: VERSION } } as Record<Control, Props>, {
    interactions,
    force: (props, interaction) => ({ ...props, force: { control: name, interaction } }),
  });

const restart = rowOf('restart');
const later = rowOf('later');

export const states = {
  open: { version: VERSION },
  'long-version': { version: '0.42.0-next.137+build.20261102.4f1c9ad7e2b3' },
  ...restart.states,
  ...later.states,
} satisfies Record<string, Props>;

export const grid = {
  columns: restart.grid.columns,
  rows: { ...restart.grid.rows, ...later.grid.rows },
};

export const controls = {
  restart: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
  later: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
};

const displayVersion = (version: string) => version.split('+')[0] ?? version;

export const QUESTION = (version: string) => `Update auf v${displayVersion(version)} installieren?`;
export const RESTART_NOTE = 'Studio startet dafür neu.';

export const mark = (name: Control, markup: string, { force }: Props) => {
  const drawn = control(markup, name);

  return force?.control === name ? forceInteraction(drawn, force.interaction) : drawn;
};

export const studioWindow = async (overlay: string) => {
  const bar = await titleBar.render({
    os: 'linux',
    left: [],
    right: ['minimize', 'maximize', 'close'],
    update: true,
    product: 'studio',
    part: 'Title bar',
  });

  return {
    body: html`<div class="relative flex h-100 w-360 flex-col overflow-hidden bg-et-surface-bg" data-et-surface>
      ${bar.body}
      <div class="flex-1 border-t border-et-surface-border"></div>
      ${overlay}
    </div>`,
    styles: bar.styles,
  };
};
