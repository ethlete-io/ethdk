import { definePart } from '@design-system';
import { shellMain } from './shared/shell-main';
import styles from './shell-main.css?inline';

export default definePart({
  ...shellMain('above', styles),
  note: 'The shell owns rail and panel geometry, with a 40-px studio slot for the independently composed Studio menu. Pages supply that element and its styles and setup. Menu states live on elements/studio-menu; this overview draws the empty slot.',
  madeBy: ['claude-opus-5-5', 'gpt-6.1-terra', 'claude-sonnet-5-5', 'gpt-6'],
});
