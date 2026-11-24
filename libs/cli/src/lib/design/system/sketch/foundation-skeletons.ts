import { LOGO_SECTIONS } from '../rules/logo-sections';
import { colorsSkeletonOf } from './colors-skeleton';

/** The files a new foundations part starts from: part files by name, and assets for the variant's `assets/` folder. */
export type FoundationSkeleton = { files: Record<string, string>; assets: Record<string, string> };

const LOGO_ASSET = 'logo.svg';

const logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"></svg>\n';

const LOGO_DESCRIBE: Record<string, string> = {
  sizes: 'The mark at 16, 32 and 64 px and on a light bar; check that it stays readable at 16 px.',
  anatomy: 'The mark large with each of its parts named; check that every part has one line.',
  'clear-space': 'The mark inside its clear space; check that the space sits evenly on all four sides.',
  'minimum-size': 'The mark at its smallest sizes; check that the text names the smallest readable one.',
  'colour-variants': 'The mark on a dark and a light surface; check that each colour variant stays readable.',
  misuse: 'Wrong uses of the mark, each marked as wrong; check that every one reads as a warning.',
  motion: 'The mark in motion; check that only the mark moves and it stands still under reduced motion.',
};

const titleOf = (section: string) => {
  const words = section.replace(/-/gu, ' ');

  return `${words.charAt(0).toUpperCase()}${words.slice(1)}`;
};

const quoted = (key: string) => (/^[a-z]+$/u.test(key) ? key : `'${key}'`);

const LOGO_STATES = ['sizes', ...LOGO_SECTIONS];

const logoTs = [
  "import { definePart, drawing, html, logoSheet, svgAsset } from '@design-system';",
  `import mark from '@assets/${LOGO_ASSET}?raw';`,
  "import styles from './logo.css?inline';",
  '',
  `type View = ${LOGO_STATES.map((state) => `'${state}'`).join(' | ')};`,
  '',
  'const section = (view: View, title: string) =>',
  '  html`<section class="logo-section" data-view=${view}><h2 class="logo-title">${title}</h2>${svgAsset(mark, { size: 96 })}</section>`;',
  '',
  "const TITLES: Record<Exclude<View, 'sizes'>, string> = {",
  ...LOGO_SECTIONS.map((state) => `  ${quoted(state)}: '${titleOf(state)}',`),
  '};',
  '',
  'export default definePart<{ view: View }>({',
  "  note: '',",
  '  styles,',
  '  states: {',
  ...LOGO_STATES.map((state) => `    ${quoted(state)}: { view: '${state}' },`),
  '  },',
  '  describe: {',
  ...LOGO_STATES.map((state) => `    ${quoted(state)}: '${LOGO_DESCRIBE[state] ?? ''}',`),
  '  },',
  '  render: ({ view }) =>',
  "    view === 'sizes'",
  "      ? logoSheet({ marks: [{ title: 'Mark', svg: mark, sizes: [16, 32, 64], onLight: [16, 32] }] })",
  '      : drawing({ body: section(view, TITLES[view]) }),',
  '});',
  '',
].join('\n');

const logoCss = [
  '@layer components {',
  '  .logo-section {',
  '    display: flex;',
  '    flex-direction: column;',
  '    align-items: flex-start;',
  '    gap: 16px;',
  '    padding: 24px;',
  '  }',
  '',
  '  .logo-title {',
  '    margin: 0;',
  '  }',
  '',
  "  .logo-section[data-view='motion'] svg {",
  '    animation: logo-fade-in 600ms ease-out both;',
  '  }',
  '',
  '  @media (prefers-reduced-motion: reduce) {',
  "    .logo-section[data-view='motion'] svg {",
  '      animation: none;',
  '    }',
  '  }',
  '',
  '  @keyframes logo-fade-in {',
  '    from {',
  '      opacity: 0;',
  '    }',
  '  }',
  '}',
  '',
].join('\n');

const SKELETONS: Record<string, FoundationSkeleton> = {
  'foundations/colors': colorsSkeletonOf({ scheme: 'both' }),
  'foundations/logo': { files: { 'logo.ts': logoTs, 'logo.css': logoCss }, assets: { [LOGO_ASSET]: logoSvg } },
};

/**
 * The fixed start of a new foundations part a sketch opens without a part to copy: structure and token names with
 * placeholder values, never a look. `null` for a part that starts from the empty stub.
 */
export const foundationSkeletonOf = (partKey: string): FoundationSkeleton | null => SKELETONS[partKey] ?? null;
