import { control } from '@ethlete/components/design/control';
import { html, slot, withAction } from '@design-system';
import badge from '@system/components/badge';
import button from '@system/components/button';
import { canvasFrame, canvasView } from '@system/elements/canvas-frames';

type Drawn = { body: string; styles: string };

export type Approval = 'go' | 'go-given' | 'accept' | 'accepted';

const quiet = (text: string, data: string) =>
  html`<span class="self-center text-et-surface-muted text-ui-sm" ${data}>${text}</span>`;

export const approvalControl = async (approval: Approval, size: 'sm' | 'xs' = 'sm'): Promise<Drawn> => {
  if (approval === 'go-given') return { body: quiet('Go erteilt', 'data-part-go-given'), styles: '' };
  if (approval === 'accepted') return { body: quiet('Änderung abgenommen', 'data-part-accepted'), styles: '' };

  const go = approval === 'go';
  const drawn = await button.render({ label: go ? 'Go geben' : 'Änderung abnehmen', variant: 'filled', size });
  const title = go
    ? 'Gibt diesen Teil in seinem jetzigen Stand zur Umsetzung frei'
    : 'Nimmt die direkte Änderung an diesem gemergten Teil ab';
  const acting = control(withAction(drawn.body, go ? 'emit:giveGo' : 'emit:accept'), go ? 'give-go' : 'accept');

  return {
    body: html`<span class="contents" title="${title}">${acting}</span>`,
    styles: drawn.styles,
  };
};

type PartException = { rule: string; reason: string; reopened: boolean };

export const buttonExceptions: PartException[] = [
  { rule: 'filled/UNBOUND-INPUT', reason: 'Das Label kommt im Harness aus einem Beispieltext.', reopened: false },
  {
    rule: 'outline/CONTRAST',
    reason: 'Die Kontur liegt bewusst unter 3:1, der Text trägt den Kontrast.',
    reopened: true,
  },
];

export const exceptionRows = async (exceptions: PartException[]): Promise<Drawn> => {
  const approve = await button.render({ label: 'Freigeben', variant: 'filled', size: 'xs' });
  const rows = exceptions
    .map(
      ({ rule, reason, reopened }) =>
        html`<li class="flex items-start gap-space-3 px-space-3 py-space-2">
          <span class="flex min-w-0 flex-1 flex-col">
            <span class="font-code text-et-surface text-ui-xs break-all">${rule}</span>
            <span class="text-et-surface-muted">${reason}</span>
            <span class="text-et-surface-muted text-ui-xs"
              >${reopened ? 'wieder offen - der Teil hat sich geändert' : 'offen'}</span
            >
          </span>
          ${control(withAction(approve.body, 'emit:approveException'), 'exception-approve')}
        </li>`,
    )
    .join('');

  return {
    body: html`<ul class="m-0 p-0 list-none">
      ${rows}
    </ul>`,
    styles: approve.styles,
  };
};

const THEMES = [
  { label: 'Oberflächen-Theme', names: ['light', 'dark'], current: 'light' },
  { label: 'Farb-Theme', names: ['brand', 'danger', 'warning'], current: 'brand' },
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
          class="flex gap-0.5 rounded-control-lg border border-(--et-surface-border-solid) bg-(--et-surface-background-solid) p-0.5"
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
    ? await badge.render({ badges: [{ label: 'übertragen', variant: 'tonal', size: 'sm' }] })
    : await button.render({ label: 'Als übertragen markieren', variant: 'outline', color: 'surface', size: 'sm' });
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
      <header
        class="absolute inset-x-0 top-0 flex items-center gap-space-3 border-b border-(--et-surface-border-solid) bg-(--et-surface-background-solid) ps-[calc(var(--st-shell-inset-left)+var(--spacing-space-4))] pe-space-4 py-space-3"
      >
        <div class="min-w-0 flex-1">
          <span class="font-code text-et-surface-muted text-ui-xs">timetrack/kerbe/03-narrow-lane</span>
          <h2 class="m-0 truncate text-et-surface font-ui-strong text-ui-md">Schmale Spur für die Wochenansicht</h2>
        </div>
        ${themes.body}${transferMarkup}
      </header>`,
    styles: themes.styles + transfer.styles,
  };
};
