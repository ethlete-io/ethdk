import { definePart } from '@design-system';
import { shellMain } from './shared/shell-main';
import styles from './shell-main.css?inline';

export default definePart({
  ...shellMain('above', styles),
  note: 'The floating side panel and fixed rail keep their existing geometry. The neutral Studio logo tile opens the SDK menu to its right, with settings, appearance, keyboard shortcuts, help and about. The sketch draws trigger and menu-item interactions; its prototype supports click, arrow keys, Escape, focus return and outside dismissal. Menu destinations remain separate design work.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6'],
});
