import { definePart } from '@design-system';
import { shellMain } from './shared/shell-main';
import styles from './shell-main.css?inline';

export default definePart({
  ...shellMain('above', styles),
  note: 'Chrome only: the canvas runs edge to edge behind a floating, rounded side panel that hides from its own header, while the dark rail stays put as the only fixed chrome. Hiding is a second click on the active section bubble, as in the VS Code activity bar; the panel goes and the bubble drops its fill but keeps the accent icon and bar. The page fills the panel list (side) and the canvas (content).',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6'],
});
