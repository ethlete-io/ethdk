import { definePart, drawing, forceInteraction, html } from '@design-system';
import { control } from '@ethlete/components/design/control';
import duneImage from '@assets/dune-part-two-2024-hintergrund.webp';
import duneLogo from '@assets/dune-part-two-2024-logo.png';
import johnWilliamsImage from '@assets/john-williams-live-in-vienna-2020-hintergrund.webp';
import { dune, johnWilliams, titleCardDescribe, TitleCardProps, titleCardRows } from '@shared/title-card-sample';
import styles from './title-card.css?inline';

const title = (props: TitleCardProps) =>
  props.logo
    ? html`<img class="tf-title-card-logo" src="${props.logo}" alt="${props.title}" />`
    : html`<span class="tf-title-card-text line-clamp-2">${props.title}</span>`;

export const titleCard = (props: TitleCardProps) => {
  const markup = control(
    html`<a class="tf-title-card relative block aspect-2/3 w-full overflow-hidden rounded-xl no-underline" href="#">
      <img class="tf-title-card-poster absolute inset-0 size-full object-cover" src="${props.image}" alt="" />
      <span
        class="tf-title-card-scrim absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-3 pt-16 pb-3 text-center"
      >
        <span class="flex h-12 w-full items-end justify-center">${title(props)}</span>
        <span class="tf-title-card-meta">${props.year} · ${props.kind}</span>
      </span>
    </a>`,
    'title-card',
  );

  return props.interaction ? forceInteraction(markup, props.interaction) : markup;
};

const { states, grid } = titleCardRows({
  logo: { ...dune, image: duneImage, logo: duneLogo },
  fallback: { ...johnWilliams, image: johnWilliamsImage, logo: null },
});

export default definePart({
  note: 'Hochformat aus dem Hintergrundbild, Logo unten auf dem Bild, das in den Seitenhintergrund ausläuft.',
  madeBy: ['claude-opus-5-5'],
  styles,
  states,
  grid,
  describe: titleCardDescribe,
  widths: [200],
  checks: { skip: ['CLIPPED'] },
  controls: { 'title-card': { kind: 'button', input: ['pointer', 'keyboard'] } },
  render: (props: TitleCardProps) => drawing({ body: html`<div class="p-2">${titleCard(props)}</div>` }),
});
