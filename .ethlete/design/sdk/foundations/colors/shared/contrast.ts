import { html } from '@design-system';

type Surface = 'light' | 'dark';

const AA = 4.5;

const pair = (options: {
  label: string;
  text: string;
  on: string;
  scope: string;
  surface: Surface;
  fixed: boolean;
}) => {
  const { label, text, on, scope, surface, fixed } = options;

  return html`<div class="sdk-pair-row ${scope}">
    <span class="sdk-pair" style="background: var(${on}); color: var(${text})">Aa</span>
    <span class="sdk-pair-label ${fixed ? 'sdk-fixed' : ''}">${label}</span>
    <code class="sdk-value">${text} / ${on}</code>
    <strong
      class="sdk-ratio"
      data-et-contrast="${text} ${on}"
      data-et-contrast-needs="${AA}"
      data-et-contrast-theme="${scope ? `${scope} on ` : ''}et-surface--${surface}"
    ></strong>
  </div>`;
};

const STATE_SUFFIX = { rest: '-rest', hover: '-hover', focus: '-focus', active: '-active' } as const;

const FIXED: Record<string, (keyof typeof STATE_SUFFIX)[]> = { danger: ['hover', 'focus'], warning: ['active'] };

const pairTable = (title: string, rows: string) =>
  html`<section class="sdk-table">
    <h2 class="sdk-title">${title}</h2>
    <div class="sdk-pairs">${rows}</div>
  </section>`;

export const contrastSheet = (surface: Surface) => {
  const suffix = surface === 'light' ? '-on-light' : '';

  const text = pairTable(
    `Text on the ${surface} background`,
    (
      [
        ['text', '--et-surface-text'],
        ['muted', '--et-surface-text-muted'],
        ['subtle', '--et-surface-text-subtle'],
      ] as const
    )
      .map(([role, token]) =>
        pair({ label: role, text: token, on: '--et-surface-background', scope: '', surface, fixed: role === 'subtle' }),
      )
      .join(''),
  );

  const fills = (['danger', 'warning'] as const)
    .map((theme) =>
      pairTable(
        `.et-color--${theme}${suffix} (demo theme): on-primary on the fill`,
        Object.entries(STATE_SUFFIX)
          .map(([state, end]) =>
            pair({
              label: state,
              text: `--et-tone-on-fill${end}`,
              on: `--et-tone-fill${end}`,
              scope: `et-color--${theme}${suffix}`,
              surface,
              fixed: FIXED[theme]?.includes(state as keyof typeof STATE_SUFFIX) ?? false,
            }),
          )
          .join(''),
      ),
    )
    .join('');

  const ink = pairTable(
    `Ink on the ${surface} background`,
    (['brand', 'danger', 'warning'] as const)
      .map((theme) =>
        pair({
          label: `${theme}${suffix}`,
          text: '--et-tone-text-rest',
          on: '--et-surface-background',
          scope: `et-color--${theme}${suffix}`,
          surface,
          fixed: false,
        }),
      )
      .join(''),
  );

  return text + fills + ink;
};

export const contrastStyles = `
  .sdk-pairs { display: grid; grid-template-columns: 4rem auto auto auto; gap: 0.6rem 1.2rem; align-items: center; margin-top: 0.4rem; }
  .sdk-pair-row { display: contents; }
  .sdk-pair { display: grid; place-items: center; width: 4rem; height: 2.8rem; border-radius: 0.4rem; border: 0.1rem solid var(--et-surface-border); font-size: 1.4rem; font-weight: 600; }
  .sdk-pair-label { font-size: 1.2rem; white-space: nowrap; }
  .sdk-fixed { font-weight: 600; }
  .sdk-ratio { font-size: 1.2rem; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .sdk-ratio[data-et-contrast-low] { color: var(--et-surface-text-muted); text-decoration: line-through; }
`;
