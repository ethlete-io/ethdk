import { kbd, kbdStyles } from '@ethlete/components/design/kbd';
import { definePart, drawing } from '@design-system';
import frame from './kbd.css?inline';

type Platform = 'apple' | 'other';

type Props = {
  form: 'single' | 'combo' | 'in-text' | 'shortcut-list';
  platform: Platform;
};

const MOD = { apple: '⌘', other: 'Ctrl' } as const;
const SHIFT = { apple: '⇧', other: 'Shift' } as const;
const ALT = { apple: '⌥', other: 'Alt' } as const;

const SHORTCUTS = (p: Platform) => [
  { label: 'Save', keys: [MOD[p], 'S'] },
  { label: 'Undo', keys: [MOD[p], 'Z'] },
  { label: 'Redo', keys: [MOD[p], SHIFT[p], 'Z'] },
  { label: 'Move up a level', keys: [ALT[p], '↑'] },
  { label: 'Next page', keys: ['PgDn'] },
  { label: 'Zoom in', keys: [MOD[p], '+'] },
];

const render = ({ form, platform: p }: Props) => {
  switch (form) {
    case 'single':
      return kbd({ keys: ['Esc'] });
    case 'combo':
      return kbd({ keys: [MOD[p], 'K'] });
    case 'in-text':
      return `<p class="kbd-text">Press ${kbd({ keys: [MOD[p], 'K'] })} to open the palette, then ${kbd({ keys: ['Esc'] })} to dismiss it.</p>`;
    case 'shortcut-list':
      return `<div class="kbd-list">${SHORTCUTS(p)
        .map(({ label, keys }) => `<div class="kbd-row"><span>${label}</span>${kbd({ keys })}</div>`)
        .join('')}</div>`;
  }
};

export default definePart({
  note: 'The SDK kbd (et-kbd), drawn by its mock from @ethlete/components/design on the page: an inline flex row of keycaps 3px apart, each a <kbd> at least 18px wide with 5px inline padding, a 1px --et-surface-border-solid edge, 4px radius, a fill of --et-surface-interaction-solid at 8% over the page and 11px text at weight 500 in --et-surface-color-muted-solid. Platform glyphs: Apple prints ⌘ ⌥ ⇧, other prints Ctrl Alt Shift. States: a single key, a mod+k combo, keycaps inside a sentence and a shortcut list as in the story. The kbd is not interactive and has no colour theme, hover or focus of its own.',
  madeBy: ['claude-opus-5-5'],
  states: {
    single: { form: 'single', platform: 'apple' },
    'combo-apple': { form: 'combo', platform: 'apple' },
    'combo-other': { form: 'combo', platform: 'other' },
    'in-text': { form: 'in-text', platform: 'apple' },
    'shortcut-list-apple': { form: 'shortcut-list', platform: 'apple' },
    'shortcut-list-other': { form: 'shortcut-list', platform: 'other' },
  },
  widths: [480],
  render: (props: Props) =>
    drawing({
      body: `<div class="kbd-frame">${render(props)}</div>`,
      styles: [kbdStyles, frame].join('\n'),
    }),
});
