import { control } from '@ethlete/components/design/control';
import { html, slot, withAction } from '@design-system';
import badge from '@system/components/badge';
import button from '@system/components/button';
import { canvasFrame, canvasView } from '@system/elements/canvas-frames';
import { SHELL_LABELS } from '../../../../../../apps/ethlete-studio/src/app/i18n/shell-labels';

type Drawn = { body: string; styles: string };

type PartException = { rule: string; reason: string; reopened: boolean };

export const partExceptions: PartException[] = [
  { rule: 'add/UNBOUND-INPUT', reason: 'Das Label kommt aus einem Beispieltext.', reopened: false },
  {
    rule: 'count/CONTRAST',
    reason: 'Die Ziffer liegt bewusst unter 3:1.',
    reopened: true,
  },
];

const THEMES = [
  { label: SHELL_LABELS.surfaceTheme, names: ['light', 'dark'], current: 'light' },
  { label: SHELL_LABELS.colorTheme, names: ['brand', 'danger', 'warning'], current: 'brand' },
];

const themeSwitch = async (): Promise<Drawn> => {
  const groups = await Promise.all(
    THEMES.map(async ({ label, names, current }) => {
      const buttons = await Promise.all(
        names.map((name) =>
          button.render({
            label: name,
            variant: 'transparent',
            color: 'surface',
            size: 'xs',
            pressed: name === current,
          }),
        ),
      );
      return {
        body: html`<div
          class="flex gap-0.5 rounded-control-lg border border-(--et-surface-border) p-0.5"
          role="group"
          aria-label="${label}"
        >
          ${buttons.map((drawn) => control(withAction(drawn.body, 'emit:pickTheme'), 'theme')).join('')}
        </div>`,
        styles: buttons.map((drawn) => drawn.styles).join(''),
      };
    }),
  );

  return { body: groups.map((group) => group.body).join(''), styles: groups.map((group) => group.styles).join('') };
};

export const callView = async (transferred: boolean): Promise<Drawn> => {
  const themes = await themeSwitch();
  const transfer = transferred
    ? await badge.render({ badges: [{ label: SHELL_LABELS.transferred, variant: 'tonal', size: 'sm' }] })
    : await button.render({
        label: SHELL_LABELS.markTransferred,
        variant: 'outline',
        color: 'surface',
        size: 'sm',
      });
  const transferMarkup = transferred
    ? transfer.body
    : control(withAction(transfer.body, 'emit:markTransferred'), 'transfer');
  const frames = await canvasView(
    [canvasFrame('03-narrow-lane', html`<div class="w-md h-45" ${slot('shot')}></div>`)],
    '100%',
    {},
    'w-full pt-16',
    true,
  );

  return {
    body: html`${frames}
      <div
        class="absolute top-space-3 inset-s-[calc(var(--st-shell-inset-left)+var(--spacing-space-4))] min-w-0 max-w-1/2"
      >
        <h2 class="m-0 truncate text-et-surface-text font-ui-strong text-ui-md">Schmale Spur für die Wochenansicht</h2>
        <span class="font-code text-et-surface-text-muted text-ui-xs">timetrack/kerbe/03-narrow-lane</span>
      </div>
      <div class="absolute top-space-3 right-space-3 flex items-center gap-space-2">
        ${themes.body}${transferMarkup}
      </div>`,
    styles: themes.styles + transfer.styles,
  };
};
