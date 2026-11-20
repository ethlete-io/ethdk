import { definePart, drawing, html } from '@design-system';
import { dialog, dialogStyles, overlayBackdrop } from '@ethlete/components/design/dialog';
import { studioMark } from '@system/foundations/logo';
import styles from './about-dialog.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = { version: string; close?: Interaction };

const closeAttributes = (close?: Interaction) =>
  ['aria-label="Schließen" data-et-control="close" data-et-action="emit:close"', close && `data-et-force="${close}"`]
    .filter(Boolean)
    .join(' ');

const content = (version: string) =>
  html`<div class="flex items-center gap-space-3">
      ${studioMark(48)}
      <div class="flex min-w-0 flex-col gap-space-1">
        <span class="font-ui-strong text-ui-md text-et-surface">Ethlete Studio</span>
        <span class="ad-wrap text-ui-sm text-et-surface-muted">Version ${version}</span>
      </div>
    </div>
    <p class="mt-space-3 text-ui-sm text-et-surface-muted">MIT-Lizenz, © 2025 The Authors</p>`;

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/about-dialog/about-dialog.component.ts',
  note: 'Über Studio aus dem Studio-Menü: ein SDK-Dialog mit Titel und Schließen-Knopf, darin das Studio-Zeichen, der Produktname, die laufende Version aus dem Host und die Lizenz. Keine Fußzeile: Esc, der Schließen-Knopf und ein Klick auf den Hintergrund schließen ihn, der Fokus kehrt zum Studio-Menü zurück.',
  madeBy: ['claude-opus-5-5'],
  widths: [800],
  states: {
    default: { version: '0.2.0-next.27' },
    'long-version': { version: '0.2.0-next.27+build.20261120.a1b2c3d4e5f6a7b8c9d0' },
    'close-hover': { version: '0.2.0-next.27', close: 'hover' },
    'close-active': { version: '0.2.0-next.27', close: 'active' },
    'close-focus-visible': { version: '0.2.0-next.27', close: 'focus-visible' },
  },
  describe: {
    default:
      'Über Studio offen über dem Hintergrund; check Titel, Schließen-Knopf, Zeichen, Ethlete Studio, Version und Lizenz.',
    'long-version': 'Eine lange Build-Version; check that the version wraps inside the dialog and nothing overflows.',
    'close-hover': 'Schließen hovered; check its hover fill and that nothing else changes.',
    'close-active': 'Schließen pressed; check its press fill.',
    'close-focus-visible': 'Schließen focused by keyboard; check its focus ring, not clipped by the dialog edge.',
  },
  motions: {
    'close-hover-in': { from: 'default', to: 'close-hover' },
    'close-hover-out': { from: 'close-hover', to: 'default' },
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
          title: 'Über Studio',
          body: content(version),
          close: closeAttributes(close),
          attributes: 'data-et-surface-fill',
        }),
      ),
      styles: [dialogStyles, styles].join('\n'),
    }),
});
