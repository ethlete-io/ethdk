import { definePart, drawing, html, interactionRows } from '@design-system';
import { dialog, dialogStyles, overlayBackdrop } from '@ethlete/components/design/dialog';
import { studioMark } from '@system/foundations/logo';
import styles from './about-dialog.css?inline';
import { ABOUT_DIALOG_LABELS } from '../../../../../apps/ethlete-studio/src/app/i18n/shell-labels';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = { version: string; close?: Interaction };

const closeAttributes = (close?: Interaction) =>
  [
    `aria-label="${ABOUT_DIALOG_LABELS.close}" data-et-control="close" data-et-action="emit:close" data-can-animate`,
    close && `data-et-force="${close}"`,
  ]
    .filter(Boolean)
    .join(' ');

const content = (version: string) =>
  html`<div class="flex items-center gap-space-3">
      <div class="size-12 shrink-0">${studioMark(48)}</div>
      <div class="flex min-w-0 flex-col gap-space-1">
        <span class="font-ui-strong text-ui-md text-et-surface-text">${ABOUT_DIALOG_LABELS.product}</span>
        <span class="ad-wrap text-ui-sm text-et-surface-text-muted">Version ${version}</span>
      </div>
    </div>
    <p class="mt-space-3 text-ui-sm text-et-surface-text-muted">
      ${ABOUT_DIALOG_LABELS.license(new Date().getFullYear())}
    </p>`;

export const { states, grid } = interactionRows<Props, 'close', Interaction>(
  { close: { version: '0.2.0-next.27' } },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, close) => ({ ...props, close }) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/about-dialog/about-dialog.component.ts',
  note: 'Über Studio aus dem Studio-Menü: ein SDK-Dialog mit Titel und Schließen-Knopf, darin das Studio-Zeichen, der Produktname, die laufende Version aus dem Host und die Lizenz. Keine Fußzeile: Esc, der Schließen-Knopf und ein Klick auf den Hintergrund schließen ihn, der Fokus kehrt zum Studio-Menü zurück.',
  madeBy: ['claude-opus-5-5', 'design check'],
  widths: [800],
  states: { ...states, 'long-version': { version: '0.2.0-next.27+build.20261120.a1b2c3d4e5f6a7b8c9d0' } },
  grid,
  describe: {
    close:
      'Über Studio offen über dem Hintergrund; check Titel, Schließen-Knopf, Zeichen, Ethlete Studio, Version und Lizenz.',
    'long-version': 'Eine lange Build-Version; check that the version wraps inside the dialog and nothing overflows.',
    'close-hover': 'Schließen hovered; check its hover fill and that nothing else changes.',
    'close-active': 'Schließen pressed; check its press fill.',
    'close-focus-visible': 'Schließen focused by keyboard; check its focus ring, not clipped by the dialog edge.',
  },
  motions: {
    'close-hover-in': { from: 'close', to: 'close-hover' },
    'close-hover-out': { from: 'close-hover', to: 'close' },
    'close-press': { from: 'close-hover', to: 'close-active' },
    'close-release': { from: 'close-active', to: 'close-hover' },
  },
  controls: { close: { kind: 'button', input: ['pointer', 'keyboard'] } },
  frame: (body) => `<div class="ad-frame overflow-hidden">${body}</div>`,
  render: ({ version, close }: Props) =>
    drawing({
      body: overlayBackdrop(
        dialog({
          id: 'about',
          title: ABOUT_DIALOG_LABELS.title,
          body: content(version),
          close: closeAttributes(close),
          attributes: 'data-et-surface-fill',
        }),
      ),
      styles: [dialogStyles, styles].join('\n'),
    }),
});
