import { definePart } from '@design-system';
import shellMain from '@system/elements/shell-main';

export default definePart({
  note: 'The System page: the shell, a quiet collapsible tree of the product parts, and the infinite canvas.',
  madeBy: ['claude-opus-5-5'],
  states: { part: {} },
  render: () => shellMain.render({ section: 'System', product: 'studio' }),
});
