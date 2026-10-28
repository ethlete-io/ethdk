import { definePart, drawing } from '@design-system';
import canvasFrames from '@system/elements/canvas-frames';
import partTree from '@system/elements/part-tree';
import shellMain from '@system/elements/shell-main';

export default definePart({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas.',
  madeBy: ['claude-opus-5-5'],
  states: { part: {} },
  render: async () => {
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
