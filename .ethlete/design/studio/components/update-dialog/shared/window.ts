import { html } from '@design-system';
import titleBar from '@system/components/title-bar';

export type Props = { version: string; force?: { control: 'restart' | 'later'; interaction: 'focus-visible' } };

export const states = {
  open: { version: '0.42.0' },
  'long-version': { version: '0.42.0-next.137+build.20261102.4f1c9ad7e2b3' },
  'restart-focus-visible': { version: '0.42.0', force: { control: 'restart', interaction: 'focus-visible' } },
} satisfies Record<string, Props>;

export const controls = {
  restart: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
  later: { kind: 'button' as const, input: ['pointer' as const, 'keyboard' as const] },
};

export const QUESTION = (version: string) => `Update auf v${version} installieren?`;
export const RESTART_NOTE = 'Studio startet dafür neu.';

export const mark = (control: 'restart' | 'later', { force }: Props) =>
  [
    `data-et-control="${control}" data-can-animate`,
    force?.control === control && `data-et-force="${force.interaction}"`,
  ]
    .filter(Boolean)
    .join(' ');

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
