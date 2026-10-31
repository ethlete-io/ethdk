import { html } from '@design-system';

type Surface = 'light' | 'dark';

const tokenValues = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`);

  if (start === -1) throw new Error(`colors.css has no ${selector} block`);

  const block = css.slice(start, css.indexOf('}', start));

  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+): (\d+ \d+ \d+);/g)].map(([, name, value]) => [name, value as string]),
  ) as Record<string, string>;
};

const channel = (value: number) => {
  const c = value / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb: string) => {
  const [r = 0, g = 0, b = 0] = rgb.split(' ').map(Number);

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

const contrastRatio = (a: string, b: string) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];

  return (high + 0.05) / (low + 0.05);
};

const AA = 4.5;

const pair = (label: string, fill: string, ink: string, fixed: boolean) => {
  const ratio = contrastRatio(fill, ink);

  return html`<span class="sdk-pair" style="background: rgb(${fill}); color: rgb(${ink})">Aa</span>
    <span class="sdk-pair-label ${fixed ? 'sdk-fixed' : ''}">${label}</span>
    <code class="sdk-value">${fill} / ${ink}</code>
    <strong class="sdk-ratio" data-pass="${ratio >= AA}"
      >${ratio.toFixed(2)}:1 ${ratio >= AA ? 'AA' : 'below AA'}</strong
    >`;
};

const STATE_SUFFIX = { rest: '', hover: '-hover', focus: '-focus', active: '-active' } as const;

const FIXED: Record<string, (keyof typeof STATE_SUFFIX)[]> = { danger: ['hover', 'focus'], warning: ['active'] };

const pairTable = (title: string, rows: string) =>
  html`<section class="sdk-table">
    <h2 class="sdk-title">${title}</h2>
    <div class="sdk-pairs">${rows}</div>
  </section>`;

export const contrastSheet = (css: string, surface: Surface) => {
  const level = tokenValues(css, `.et-surface--${surface}`);
  const background = level['--et-surface-background'] ?? '';
  const suffix = surface === 'light' ? '-on-light' : '';

  const text = pairTable(
    `Text on the ${surface} background`,
    (
      [
        ['text', '--et-surface-color'],
        ['muted', '--et-surface-color-muted'],
        ['subtle', '--et-surface-color-subtle'],
      ] as const
    )
      .map(([role, token]) => pair(role, background, level[token] ?? '', role === 'subtle'))
      .join(''),
  );

  const fills = (['danger', 'warning'] as const)
    .map((theme) => {
      const values = tokenValues(css, `.et-color--${theme}${suffix}`);

      return pairTable(
        `.et-color--${theme}${suffix} (demo theme): on-primary on the fill`,
        Object.entries(STATE_SUFFIX)
          .map(([state, end]) =>
            pair(
              state,
              values[`--et-color-primary${end}`] ?? '',
              values[`--et-color-on-primary${end}`] ?? '',
              FIXED[theme]?.includes(state as keyof typeof STATE_SUFFIX) ?? false,
            ),
          )
          .join(''),
      );
    })
    .join('');

  const ink = pairTable(
    `Ink on the ${surface} background`,
    (['brand', 'danger', 'warning'] as const)
      .map((theme) =>
        pair(
          `${theme}${suffix}`,
          background,
          tokenValues(css, `.et-color--${theme}${suffix}`)['--et-color-primary-ink'] ?? '',
          false,
        ),
      )
      .join(''),
  );

  return text + fills + ink;
};

export const contrastStyles = `
  .sdk-pairs { display: grid; grid-template-columns: 4rem auto auto auto; gap: 0.6rem 1.2rem; align-items: center; margin-top: 0.4rem; }
  .sdk-pair { display: grid; place-items: center; width: 4rem; height: 2.8rem; border-radius: 0.4rem; border: 0.1rem solid var(--et-surface-border-solid); font-size: 1.4rem; font-weight: 600; }
  .sdk-pair-label { font-size: 1.2rem; white-space: nowrap; }
  .sdk-fixed { font-weight: 600; }
  .sdk-ratio { font-size: 1.2rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sdk-ratio[data-pass='false'] { color: var(--et-surface-color-muted-solid); text-decoration: line-through; }
`;
