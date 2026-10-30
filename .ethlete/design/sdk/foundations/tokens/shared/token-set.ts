import { forceInteraction, type Interaction } from '@design-system';

type Surface = 'light' | 'dark';

type Group = 'surfaces' | 'colors' | 'type-and-shadow';

export type TokenProps = { group: Group; surface: Surface };

export const tokenStates = {
  light: { group: 'surfaces', surface: 'light' },
  dark: { group: 'surfaces', surface: 'dark' },
  'colors-light': { group: 'colors', surface: 'light' },
  'colors-dark': { group: 'colors', surface: 'dark' },
  'type-and-shadow-light': { group: 'type-and-shadow', surface: 'light' },
  'type-and-shadow-dark': { group: 'type-and-shadow', surface: 'dark' },
} satisfies Record<string, TokenProps>;

type State = { label: string; force?: Interaction };

export const STATES: State[] = [
  { label: 'rest' },
  { label: 'hover', force: 'hover' },
  { label: 'focus', force: 'focus-visible' },
  { label: 'active', force: 'active' },
  { label: 'disabled', force: 'disabled' },
];

export const inState = (markup: string, state: State) => (state.force ? forceInteraction(markup, state.force) : markup);

export const COLOR_THEMES = ['brand', 'danger', 'warning'] as const;

export const demoThemesNote = `<p class="sdk-demo-note">brand, danger and warning are demo themes of the SDK Storybook (apps/storybook/src/themes.ts). The SDK ships no theme names; each app registers its own.</p>`;

export const demoThemeLabel = (theme: string) => `${theme} (demo theme)`;

export const FONTS = [
  { role: 'font family', token: '--et-font-family', sample: 'The quick brown fox jumps over the lazy dog' },
  { role: 'mono', token: '--et-font-family-mono', sample: 'font-family: var(--et-font-family-mono);' },
] as const;

export const SHADOWS = [
  { role: 'resting', className: 'sdk-shadow-resting', layers: '0 3px 8px / 0.2, 0 1px 3px / 0.12' },
  { role: 'raised', className: 'sdk-shadow-raised', layers: '0 6px 12px / 0.22, 0 2px 4px / 0.14' },
] as const;

export const shadowStyles = `
  .sdk-shadow-resting { box-shadow: 0 0.3rem 0.8rem rgb(var(--et-shadow-color-rgb) / 0.2), 0 0.1rem 0.3rem rgb(var(--et-shadow-color-rgb) / 0.12); }
  .sdk-shadow-raised { box-shadow: 0 0.6rem 1.2rem rgb(var(--et-shadow-color-rgb) / 0.22), 0 0.2rem 0.4rem rgb(var(--et-shadow-color-rgb) / 0.14); }
`;
