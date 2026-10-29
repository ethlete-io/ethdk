import { definePart, drawing, html } from '@design-system';
import button from '@system/components/button';
import canvasFrames from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';

const copy = await button.render({ label: 'Prompt kopieren', variant: 'outline', size: 'sm' });

const ghostBox = '<span class="block w-15 h-10 rounded-sm outline outline-surface-border bg-surface"></span>';

const emptyCanvas = html`<div class="h-full flex items-center justify-center ps-(--st-shell-inset-left)">
  <div class="w-[420px] flex flex-col items-center gap-space-4 text-center text-ui-sm">
    <div class="grid grid-cols-2 gap-space-2" aria-hidden="true">${ghostBox}${ghostBox}${ghostBox}${ghostBox}</div>
    <p class="m-0 text-text font-ui-strong text-ui-md">Noch keine Teile</p>
    <p class="m-0 text-text-muted">
      Das Design-System eines Produkts wächst in Schichten: Foundations, Components, Elements und Pages. Dein Agent
      zeichnet jeden Teil als Sketch, du wählst unter Sketches. Bitte ihn zum Beispiel so:
    </p>
    <p class="m-0 p-space-3 rounded-(--radius-control-md) bg-surface-sunken text-text text-ui-sm">
      Lege die Foundations für studio an: Farben, Schrift und Abstände.
    </p>
    ${copy.body}
  </div>
</div>`;

const emptySide = html`<p class="px-space-3 py-space-2 text-text-muted text-ui-sm">Noch keine Teile.</p>`;

export default definePart<{ empty?: boolean }>({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas. A product without parts shows a short line in the panel and a centred card on the canvas, the same card as the empty Flows page: a ghost of four boxes, a title, what the layers are, an example prompt for the agent and a copy button.',
  madeBy: ['claude-opus-5-5'],
  states: { part: {}, empty: { empty: true } },
  render: async ({ empty }) => {
    if (empty) {
      const shell = await shellMain.render({
        section: 'System',
        product: 'studio',
        side: emptySide,
        content: emptyCanvas,
      });

      return drawing({ body: shell.body, styles: shell.styles + copy.styles });
    }

    const tree = await partTree.render(partTree.states['components-open']);
    const frames = await canvasFrames.render(canvasFrames.states.default);
    const shell = await shellMain.render({
      section: 'System',
      product: 'studio',
      side: tree.body,
      content: frames.body,
    });

    return drawing({ body: shell.body, styles: shell.styles + tree.styles + frames.styles });
  },
});
