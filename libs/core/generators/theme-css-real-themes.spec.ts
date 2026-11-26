import {
  colorThemeCss,
  surfaceThemeCss,
  type ThemeCssColorTheme,
  type ThemeCssSurfaceTheme,
} from '../design/theme-css.js';
import { RETIRED_TOKEN_FAMILY } from './migrate-theme-token-names/token-names.js';

const APP_A_SURFACES: ThemeCssSurfaceTheme[] = [
  {
    name: 'app-a-dark',
    type: 'dark',
    elevation: 0,
    isDefault: true,
    background: '18 23 30',
    color: '255 255 255',
    colorMuted: '155 161 174',
    colorSubtle: '75 85 99',
    border: '31 41 55',
    interactionColor: {
      color: {
        default: '155 161 174',
        hover: '219 223 234',
        focus: '219 223 234',
        active: '255 255 255',
        disabled: '75 85 99',
      },
    },
  },
  {
    name: 'app-a-dark-inset',
    type: 'dark',
    elevation: -1,
    background: '10 13 16',
    color: '255 255 255',
    colorMuted: '155 161 174',
    colorSubtle: '75 85 99',
    border: '31 41 55',
  },
];

const APP_A_COLORS: ThemeCssColorTheme[] = [
  {
    name: 'blue',
    isDefault: true,
    primary: {
      color: { default: '10 127 255', hover: '47 146 255', active: '9 114 230', disabled: '30 77 128' },
      onColor: { default: '10 13 16' },
      inkColor: { default: '10 127 255', disabled: '30 77 128' },
    },
  },
  {
    name: 'blue-inverse',
    primary: {
      color: { default: '10 127 255', hover: '40 49 64', active: '25 34 45', disabled: '40 49 64' },
      onColor: { default: '10 127 255', disabled: '30 77 128' },
      inkColor: { default: '10 127 255', disabled: '30 77 128' },
    },
  },
  {
    name: 'red',
    type: 'error',
    primary: {
      color: { default: '248 59 81', hover: '249 88 107', active: '223 53 73', disabled: '125 49 58' },
      onColor: { default: '10 13 16' },
      inkColor: { default: '248 59 81', disabled: '125 49 58' },
    },
  },
];

const APP_B_SURFACES: ThemeCssSurfaceTheme[] = [
  {
    name: 'dark',
    type: 'dark',
    elevation: 0,
    isDefault: true,
    interactionColor: {
      color: {
        default: '151 151 148',
        hover: '202 202 198',
        focus: '202 202 198',
        active: '252 252 247',
        disabled: '101 101 99',
      },
    },
    background: '2 2 2',
    color: '252 252 247',
    colorMuted: '151 151 148',
    colorSubtle: '101 101 99',
    border: '48 48 46',
  },
  {
    name: 'dark-elevated',
    type: 'dark',
    elevation: 1,
    background: '17 18 18',
    color: '252 252 247',
    colorMuted: '151 151 148',
    colorSubtle: '101 101 99',
    border: '72 72 68',
  },
];

const APP_B_COLORS: ThemeCssColorTheme[] = [
  {
    name: 'green',
    isDefault: true,
    type: 'success',
    primary: {
      color: { default: '7 244 104', hover: '58 245 133', active: '105 248 163', disabled: '3 98 41' },
      onColor: { default: '21 22 22' },
    },
  },
  {
    name: 'red',
    type: 'error',
    primary: {
      color: { default: '239 68 68', hover: '247 113 113', active: '247 90 90', disabled: '127 29 29' },
      onColor: { default: '252 252 247', disabled: '185 28 28' },
    },
  },
];

const ruleOf = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);

  return css.slice(start, css.indexOf('}', start));
};

describe('themeCss on real app themes', () => {
  const cssOf = (surfaces: ThemeCssSurfaceTheme[], colors: ThemeCssColorTheme[], prefix: string) =>
    `${surfaceThemeCss(surfaces, { prefix, runtimePrefix: 'et' })}\n${colorThemeCss(colors, { prefix, runtimePrefix: 'et' })}`;

  const appA = cssOf(APP_A_SURFACES, APP_A_COLORS, 'aa');
  const appB = cssOf(APP_B_SURFACES, APP_B_COLORS, 'bb');

  it.each([
    ['app-a', appA],
    ['app-b', appB],
  ])('writes no retired token name and no bare triplet for %s', (_, css) => {
    expect(css.match(RETIRED_TOKEN_FAMILY)).toBeNull();
    expect(css).not.toMatch(/:\s*\d+ \d+ \d+;/u);
    expect(css).not.toMatch(/-(?:rgb|solid)\b/u);
    expect(css).not.toContain('tone-fill-opacity');
  });

  it('resolves every tone state of a partial ink swatch the way the runtime always did', () => {
    const blue = ruleOf(appA, ':root, .et-color--default, .et-color--blue');

    expect(blue).toContain('--et-tone-fill-rest: rgb(10 127 255);');
    expect(blue).toContain('--et-tone-fill-focus: rgb(47 146 255);');
    expect(blue).toContain('--et-tone-fill-active: rgb(9 114 230);');
    expect(blue).toContain('--et-tone-on-fill-active: rgb(10 13 16);');
    expect(blue).toContain('--et-tone-text-hover: rgb(10 127 255);');
    expect(blue).toContain('--et-tone-text-disabled: rgb(30 77 128);');
  });

  it('keeps the static utilities on their own fallbacks', () => {
    expect(appA).toContain('--color-aa-tone-blue-inverse-on-fill-active: rgb(10 127 255);');
    expect(appA).toContain('--color-aa-tone-red-text-active: rgb(248 59 81);');
    expect(appB).toContain('--color-bb-tone-green-text-hover: rgb(58 245 133);');
    expect(ruleOf(appB, ':root, .et-color--default, .et-color--green')).toContain(
      '--et-tone-text-hover: rgb(7 244 104);',
    );
  });

  it('writes the surface values as colours under the new names', () => {
    const inset = ruleOf(appA, '.et-surface--app-a-dark-inset');

    expect(inset).toContain('--et-surface-background: rgb(10 13 16);');
    expect(inset).toContain('--et-surface-text-muted: rgb(155 161 174);');
    expect(appB).toContain('--color-bb-surface-dark-elevated-text-subtle: rgb(101 101 99);');
    expect(appB).toContain('--color-bb-surface-text: var(--et-surface-text);');
  });

  it('aliases the current tone to its rest state and lets the reserved surface tone follow the surface', () => {
    expect(appB).toContain('--et-tone-fill: var(--et-tone-fill-rest);');
    expect(appB).toContain('--et-tone-text: var(--et-tone-text-rest, var(--et-tone-fill-rest));');
    expect(ruleOf(appB, '.et-color--surface')).toContain(
      '--et-tone-on-fill-hover: var(--et-surface-on-interaction-hover, var(--et-surface-on-interaction, var(--et-surface-background)));',
    );
  });

  it.each([
    ['app-a', appA],
    ['app-b', appB],
  ])('matches the stored output for %s', async (name, css) => {
    await expect(css).toMatchFileSnapshot(`./__snapshots__/theme-css-${name}.css.snap`);
  });
});
