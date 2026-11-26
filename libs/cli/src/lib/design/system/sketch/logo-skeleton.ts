import { LOGO_SECTIONS } from '../rules/logo-sections';
import { FoundationSkeleton } from './foundation-skeletons';

const LOGO_ASSET = 'logo.svg';

const logoSvg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"></svg>\n';

const LOGO_DESCRIBE: Record<string, string> = {
  sizes: 'The mark at 16, 32 and 64 px and on a light bar; check that it stays readable at 16 px.',
  anatomy: 'The mark large with each of its parts named; check that every part has one line.',
  'clear-space': 'The mark inside its clear space; check that the space sits evenly on all four sides.',
  'minimum-size': 'The mark at its smallest sizes; check that the text names the smallest readable one.',
  'colour-variants': 'The mark on the product surfaces side by side; check that each colour variant stays readable.',
  misuse: 'Wrong uses of the mark, each marked as wrong; check that every one reads as a warning.',
  motion: 'The mark in motion; check that only the mark moves and it stands still under reduced motion.',
};

const TITLES: Record<string, string> = {
  anatomy: 'Anatomy',
  'clear-space': 'Clear space',
  'minimum-size': 'Minimum size',
  'colour-variants': 'Colour variants',
  misuse: 'Misuse',
  motion: 'Motion',
};

const quoted = (key: string) => (/^[a-z]+$/u.test(key) ? key : `'${key}'`);

const LOGO_STATES = ['sizes', ...LOGO_SECTIONS];

const logoTs = `import { definePart, drawing, html, logoSheet, svgAsset } from '@design-system';
import mark from '@assets/${LOGO_ASSET}?raw';
import styles from './logo.css?inline';

type View = ${LOGO_STATES.map((state) => `'${state}'`).join(' | ')};

const TITLES: Record<Exclude<View, 'sizes'>, string> = {
${LOGO_SECTIONS.map((state) => `  ${quoted(state)}: '${TITLES[state] ?? state}',`).join('\n')}
};

const tile = (size: number, attrs = '') => html\`<span class="logo-tile" \${attrs}>\${svgAsset(mark, { size })}</span>\`;

const anatomyBody = () =>
  html\`<div class="logo-anatomy">\${tile(160)}\${['Part one', 'Part two', 'Part three']
    .map((name, index) => html\`<span class="logo-callout" data-index="\${index}"><span class="logo-label">\${name}</span></span>\`)
    .join('')}</div>\`;

const clearSpaceBody = () =>
  html\`<div class="logo-zone">\${tile(96)}\${['top', 'right', 'bottom', 'left']
    .map((side) => html\`<span class="logo-unit" data-side="\${side}"><span class="logo-label">x</span></span>\`)
    .join('')}</div>\`;

const SURFACES = ['background', 'primary', 'ink'];

const colourBody = () =>
  html\`<div class="logo-row">\${SURFACES.map(
    (surface) =>
      html\`<div class="logo-panel" data-surface="\${surface}">\${tile(72)}<span class="logo-label">\${surface}</span></div>\`,
  ).join('')}</div>\`;

const WRONG = [
  { reason: 'Stretched', scaleX: 1.7, scaleY: 1, rotate: 0, fade: 1 },
  { reason: 'Rotated', scaleX: 1, scaleY: 1, rotate: -22, fade: 1 },
  { reason: 'Off colour', scaleX: 1, scaleY: 1, rotate: 0, fade: 0.35 },
  { reason: 'Squashed', scaleX: 1, scaleY: 0.5, rotate: 0, fade: 1 },
];

const misuseBody = () =>
  html\`<div class="logo-row">\${WRONG.map(
    ({ reason, scaleX, scaleY, rotate, fade }) =>
      html\`<div class="logo-wrong" data-scale-x="\${scaleX}" data-scale-y="\${scaleY}" data-rotate="\${rotate}" data-fade="\${fade}"><div class="logo-stage">\${tile(72)}</div><span class="logo-label">\${reason}</span></div>\`,
  ).join('')}</div>\`;

const SIZES = [16, 24, 32, 48];

const minimumBody = () =>
  html\`<div class="logo-row">\${SIZES.map(
    (size) =>
      html\`<div class="logo-size" data-min="\${size === SIZES[0]}"><div class="logo-ruler" data-width="\${size}"></div>\${tile(size)}<span class="logo-label">\${size} px</span></div>\`,
  ).join('')}</div>\`;

const motionBody = () => html\`<div class="logo-track">\${tile(64, 'data-moving')}</div>\`;

const BODIES: Record<Exclude<View, 'sizes'>, () => string> = {
  anatomy: anatomyBody,
  'clear-space': clearSpaceBody,
  'minimum-size': minimumBody,
  'colour-variants': colourBody,
  misuse: misuseBody,
  motion: motionBody,
};

const place = (root: HTMLElement) => {
  root.querySelectorAll<HTMLElement>('[data-scale-x]').forEach((element) => {
    const { scaleX, scaleY, rotate, fade } = element.dataset;
    const stage = element.querySelector<HTMLElement>('.logo-stage');

    if (!stage) return;

    stage.style.transform = \`rotate(\${rotate}deg) scale(\${scaleX}, \${scaleY})\`;
    stage.style.opacity = fade ?? '1';
  });

  root.querySelectorAll<HTMLElement>('[data-width]').forEach((element) => {
    element.style.width = \`\${element.dataset['width']}px\`;
  });
};

const section = (view: Exclude<View, 'sizes'>) =>
  html\`<section class="logo-section" data-view="\${view}"><h2 class="logo-title">\${TITLES[view]}</h2>\${BODIES[view]()}</section>\`;

export default definePart<{ view: View }>({
  note: '',
  styles,
  states: {
${LOGO_STATES.map((state) => `    ${quoted(state)}: { view: '${state}' },`).join('\n')}
  },
  describe: {
${LOGO_STATES.map((state) => `    ${quoted(state)}: '${LOGO_DESCRIBE[state] ?? ''}',`).join('\n')}
  },
  render: ({ view }) =>
    view === 'sizes'
      ? logoSheet({ marks: [{ title: 'Mark', svg: mark, sizes: [16, 32, 64], onLight: [16, 32] }] })
      : drawing({ body: section(view), setup: place }),
});
`;

const logoCss = `@layer components {
  .logo-section {
    --logo-accent: var(--et-color-primary, 128 128 128);
    --logo-ink: var(--et-color-primary-ink, var(--logo-accent));
    --logo-on-accent: var(--et-color-on-primary, 255 255 255);
    --logo-bg: var(--et-surface-background, rgb(255 255 255));
    --logo-fg: var(--et-surface-color, 0 0 0);
    --logo-line: var(--et-surface-border, rgb(200 200 200));
    font-family: var(--default-font-family, system-ui, sans-serif);
    background: rgb(var(--logo-bg));
    color: rgb(var(--logo-fg));
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 16px;
    padding: 24px;
  }

  .logo-title {
    margin: 0;
  }

  .logo-tile {
    display: inline-block;
    line-height: 0;
    outline: 1px dashed rgb(var(--logo-accent) / 0.6);
    background: rgb(var(--logo-accent) / 0.08);
  }

  .logo-row {
    display: flex;
    gap: 24px;
    align-items: flex-end;
  }

  .logo-label {
    font-size: 12px;
    line-height: 1.2;
  }

  .logo-anatomy {
    position: relative;
    padding: 24px 120px;
  }

  .logo-callout {
    position: absolute;
    left: 50%;
    display: flex;
    align-items: center;
    gap: 6px;
    width: 160px;
    height: 1px;
    background: rgb(var(--logo-accent));
  }

  .logo-callout::before {
    content: '';
    width: 8px;
    height: 8px;
    margin-left: -4px;
    border-radius: 50%;
    background: rgb(var(--logo-accent));
  }

  .logo-callout .logo-label {
    position: absolute;
    left: 100%;
    margin-left: 8px;
    white-space: nowrap;
  }

  .logo-callout[data-index='0'] {
    top: 56px;
  }

  .logo-callout[data-index='1'] {
    top: 104px;
  }

  .logo-callout[data-index='2'] {
    top: 152px;
  }

  .logo-zone {
    position: relative;
    padding: 48px;
    outline: 2px dashed rgb(var(--logo-accent));
    background: repeating-linear-gradient(45deg, rgb(var(--logo-accent) / 0.14) 0 4px, transparent 4px 10px);
  }

  .logo-zone .logo-tile {
    background: rgb(var(--logo-bg));
  }

  .logo-unit {
    position: absolute;
    display: grid;
    place-items: center;
    background: rgb(var(--logo-accent) / 0.45);
  }

  .logo-unit[data-side='top'],
  .logo-unit[data-side='bottom'] {
    left: 50%;
    width: 2px;
    height: 48px;
  }

  .logo-unit[data-side='left'],
  .logo-unit[data-side='right'] {
    top: 50%;
    width: 48px;
    height: 2px;
  }

  .logo-unit[data-side='top'] {
    top: 0;
  }

  .logo-unit[data-side='bottom'] {
    bottom: 0;
  }

  .logo-unit[data-side='left'] {
    left: 0;
  }

  .logo-unit[data-side='right'] {
    right: 0;
  }

  .logo-unit .logo-label {
    padding: 0 4px;
    background: rgb(var(--logo-bg));
  }

  .logo-panel {
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    padding: 24px;
    border: 1px solid rgb(var(--logo-line));
  }

  .logo-panel[data-surface='background'] {
    background: rgb(var(--logo-bg));
    color: rgb(var(--logo-fg));
  }

  .logo-panel[data-surface='primary'] {
    background: rgb(var(--logo-accent));
    color: rgb(var(--logo-on-accent));
  }

  .logo-panel[data-surface='ink'] {
    background: rgb(var(--logo-ink));
    color: rgb(var(--logo-on-accent));
  }

  .logo-wrong {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    align-items: center;
    padding: 16px;
    border: 2px solid rgb(var(--logo-accent));
  }

  .logo-wrong::before,
  .logo-wrong::after {
    content: '';
    position: absolute;
    top: 6px;
    right: 6px;
    width: 18px;
    height: 3px;
    background: rgb(var(--logo-accent));
    transform: rotate(45deg);
  }

  .logo-wrong::after {
    transform: rotate(-45deg);
  }

  .logo-stage {
    display: grid;
    place-items: center;
    width: 120px;
    height: 120px;
  }

  .logo-size {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: flex-start;
  }

  .logo-size[data-min='true'] .logo-tile {
    outline: 2px solid rgb(var(--logo-accent));
  }

  .logo-ruler {
    height: 3px;
    background: rgb(var(--logo-accent));
  }

  .logo-track {
    width: 320px;
    padding: 12px 0;
    border-block: 1px solid rgb(var(--logo-line));
  }

  .logo-track [data-moving] {
    animation: logo-slide 900ms ease-out both;
  }

  @media (prefers-reduced-motion: reduce) {
    .logo-track [data-moving] {
      animation: none;
    }
  }

  @keyframes logo-slide {
    from {
      transform: translateX(0);
    }

    to {
      transform: translateX(256px);
    }
  }
}
`;

export const logoSkeleton = (): FoundationSkeleton => ({
  files: { 'logo.ts': logoTs, 'logo.css': logoCss },
  assets: { [LOGO_ASSET]: logoSvg },
});
