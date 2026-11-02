import { definePart, drawing, html, ng } from '@design-system';
import anchoredDialog from '@system/components/anchored-dialog';
import { controls, mark, QUESTION, RESTART_NOTE, states, studioWindow, type Props } from './shared/window';
import styles from './update-dialog.css?inline';

export default definePart({
  note: 'Confirm before the Update button restarts Studio: an anchored dialog under the Update button, arrow pointing at it, no scrim. "Später" only closes it; the Update button stays.',
  madeBy: ['claude-opus-5-5'],
  widths: [1440],
  states,
  controls,
  render: async (props: Props) => {
    const dialog = await anchoredDialog.render({
      label: 'Update installieren',
      placement: 'bottom-end',
      content: await ng(
        `<div class="box-border flex w-80 flex-col gap-space-3 p-space-3 text-ui-sm">
          <div class="flex flex-col gap-space-1">
            <span class="ud-wrap text-et-surface font-ui-strong">${QUESTION(props.version)}</span>
            <span class="text-et-surface-muted">${RESTART_NOTE}</span>
          </div>
          <div class="flex justify-end gap-space-2">
            <button et-button ${mark('later', props)} type="button" variant="outline" color="surface" size="xs">Später</button>
            <button et-button ${mark('restart', props)} type="button" variant="filled" color="brand" size="xs">Neu starten</button>
          </div>
        </div>`,
        { imports: ['BUTTON_IMPORTS'] },
      ),
    });
    const window = await studioWindow(html`<div class="absolute top-10 right-25">${dialog.body}</div>`);

    return drawing({ body: window.body, styles: [window.styles, dialog.styles, styles].join('\n') });
  },
});
