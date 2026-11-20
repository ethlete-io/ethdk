import { definePart, drawing, html, interactionRows, ng } from '@design-system';
import { dialog, dialogStyles, overlayBackdrop } from '@ethlete/components/design/dialog';
import styles from './shortcuts-dialog.css?inline';

type Interaction = 'hover' | 'active' | 'focus-visible';

type Props = { close?: Interaction };

const GROUPS = [
  {
    label: 'Allgemein',
    rows: [
      { label: 'Suche und Befehle', keys: 'mod+k' },
      { label: 'Tastenkürzel', keys: 'mod+/' },
    ],
  },
  {
    label: 'Canvas',
    rows: [
      { label: 'Alle Frames zeigen', keys: 'shift+1' },
      { label: 'Gewählten Frame zeigen', keys: 'shift+2' },
      { label: 'Auf 100 % zoomen', keys: 'shift+0' },
      { label: 'Verschieben beim Ziehen', keys: 'space' },
      { label: 'Auswahl aufheben', keys: 'esc' },
    ],
  },
];

const closeAttributes = (close?: Interaction) =>
  [
    'aria-label="Schließen" data-et-control="close" data-et-action="emit:close" data-can-animate',
    close && `data-et-force="${close}"`,
  ]
    .filter(Boolean)
    .join(' ');

const list = () =>
  ng(
    html`<div class="flex flex-col gap-space-4">
      ${GROUPS.map(
        (group) =>
          html`<section class="flex flex-col gap-space-1">
            <h3 class="m-0 text-ui-xs font-ui-strong text-et-surface-muted">${group.label}</h3>
            <dl class="m-0 flex flex-col">
              ${group.rows
                .map(
                  (row) =>
                    html`<div class="flex items-center justify-between gap-space-3 py-space-1 text-ui-sm">
                      <dt class="text-et-surface">${row.label}</dt>
                      <dd class="m-0"><et-kbd keys="${row.keys}" platform="other" /></dd>
                    </div>`,
                )
                .join('')}
            </dl>
          </section>`,
      ).join('')}
    </div>`,
    { imports: ['KBD_IMPORTS'] },
  );

export const { states, grid } = interactionRows<Props, 'close', Interaction>(
  { close: {} },
  { interactions: ['hover', 'active', 'focus-visible'], force: (props, close) => ({ ...props, close }) },
);

export default definePart({
  implements: 'apps/ethlete-studio/src/app/design-parts/shortcuts-dialog/shortcuts-dialog.component.ts',
  note: 'Tastenkürzel aus dem Studio-Menü und mit Strg+/: ein SDK-Dialog mit Titel und Schließen-Knopf, darin die Kürzel, die Studio wirklich hat, nach Allgemein und Canvas gruppiert, jedes mit SDK-Tastenkappe. Keine Fußzeile: Esc, der Schließen-Knopf und ein Klick auf den Hintergrund schließen ihn.',
  madeBy: ['claude-opus-5-5', 'design check'],
  widths: [800],
  states,
  grid,
  describe: {
    close:
      'Tastenkürzel offen über dem Hintergrund; check both groups, every label left and its key cap right-aligned.',
    'close-hover': 'Schließen hovered; check its hover fill and that the list does not change.',
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
  frame: (body) => `<div class="sd-frame overflow-hidden">${body}</div>`,
  render: async ({ close }: Props) =>
    drawing({
      body: overlayBackdrop(
        dialog({
          id: 'shortcuts',
          title: 'Tastenkürzel',
          body: await list(),
          close: closeAttributes(close),
          attributes: 'data-et-surface-fill',
        }),
      ),
      styles: [dialogStyles, styles].join('\n'),
    }),
});
