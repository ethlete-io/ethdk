import { iconMarkup } from '@ethlete/components/design/icon';
import { SDK_ICONS } from '@ethlete/components/design/icon-set';
import { definePart, drawing, html } from '@design-system';
import styles from './icons.css?inline';

type Props = { surface: 'light' | 'dark' };

const tile = (icon: (typeof SDK_ICONS)[number]) =>
  html`<li class="sdk-icon-tile">
    ${iconMarkup(icon, 'sdk-icon-glyph')}<span class="sdk-icon-name">${icon.name}</span>
  </li>`;

const render = ({ surface }: Props) =>
  drawing({
    body: html`<div class="sdk-icons et-surface--${surface}">
      <h2 class="sdk-icons-title">Icons, ${surface}</h2>
      <p class="sdk-icons-note">
        ${SDK_ICONS.length} icons from libs/components/src/lib/icon/headless, drawn in currentColor.
      </p>
      <ul class="sdk-icons-grid">
        ${SDK_ICONS.map(tile).join('')}
      </ul>
    </div>`,
    styles,
  });

export default definePart<Props>({
  note: 'Every icon the SDK ships, read from the icon source files in libs/components/src/lib/icon/headless, with its registered name, on a light and a dark surface.',
  states: {
    light: { surface: 'light' },
    dark: { surface: 'dark' },
  },
  render,
});
