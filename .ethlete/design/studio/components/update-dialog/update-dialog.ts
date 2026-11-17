import { definePart, drawing, html, ng } from '@design-system';
import anchoredDialog from '@system/components/anchored-dialog';
import { controls, grid, mark, QUESTION, RESTART_NOTE, states, studioWindow, type Props } from './shared/window';
import styles from './update-dialog.css?inline';

export default definePart({
  implements: 'apps/ethlete-studio/src/app/components/update-dialog/update-dialog.component.ts',
  note: 'Confirm before the Update button restarts Studio: an anchored dialog under the Update button, arrow pointing at it, no scrim. "Später" only closes it; the Update button stays.',
  madeBy: ['claude-opus-5-5', 'design check'],
  widths: [1440],
  states,
  grid,
  describe: {
    open: 'The update dialog under the Update button; check the arrow on the button, the question with the version, the restart note and both buttons.',
    'long-version':
      'A long build version; check that the question shows the version without its build suffix and wraps inside the dialog.',
    restart:
      'The dialog row of the Neu starten button at rest; check the filled brand button beside the outlined Später.',
    'restart-hover': 'Neu starten hovered; check that its brand fill lightens and Später does not change.',
    'restart-active': 'Neu starten pressed; check that its brand fill darkens.',
    'restart-focus-visible':
      'Neu starten focused by keyboard; check its focus ring inside the dialog, not clipped by the dialog edge.',
    later: 'The dialog row of the Später button at rest; check the outlined surface button beside Neu starten.',
    'later-hover': 'Später hovered; check the hover tint inside its outline and that Neu starten does not change.',
    'later-active': 'Später pressed; check its press tint.',
    'later-focus-visible': 'Später focused by keyboard; check its focus ring and that it does not overlap Neu starten.',
  },
  controls,
  render: async (props: Props) => {
    const dialog = await anchoredDialog.render({
      label: 'Update installieren',
      anchor: '[data-et-control="update"]',
      placement: 'bottom-end',
      content: await ng(
        `<div class="box-border flex w-80 flex-col gap-space-3 p-space-3 text-ui-sm">
          <div class="flex flex-col gap-space-1">
            <span class="ud-wrap text-et-surface font-ui-strong">${QUESTION(props.version)}</span>
            <span class="text-et-surface-muted">${RESTART_NOTE}</span>
          </div>
          <div class="flex justify-end gap-space-2">
            ${mark('later', '<button et-button type="button" data-et-action="emit:later" variant="outline" color="surface" size="xs">Später</button>', props)}
            ${mark('restart', '<button et-button type="button" data-et-action="emit:restart" variant="filled" color="brand" size="xs">Neu starten</button>', props)}
          </div>
        </div>`,
        { imports: ['BUTTON_IMPORTS'] },
      ),
    });
    const window = await studioWindow(
      html`<div class="absolute top-[calc(anchor(bottom)+10px)] right-[anchor(right)] [position-anchor:--ud-update]">
        ${dialog.body}
      </div>`,
    );

    return drawing({ body: window.body, styles: [window.styles, dialog.styles, styles].join('\n') });
  },
});
