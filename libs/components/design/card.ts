import cardBase from '../src/lib/card/card.component.css?inline';
import { button, ButtonMockOptions, buttonStyles } from './button';

export type CardMockOptions = {
  variant?: 'elevated' | 'outlined' | 'filled';
  /** A surface theme name the app registers. Left out, the card takes the surface around it. */
  surface?: string;
  /** The projected content, as HTML. `cardContent()` draws a typical one. */
  content: string;
  /** Extra attributes on the card, e.g. design markers or a style. */
  attributes?: string;
};

export type CardContentMockOptions = {
  title?: string;
  /** Muted text under the title, e.g. a date or a category. */
  subtitle?: string;
  text?: string;
  /** Media at the top, as HTML. `cardPlaceholderMedia` draws a generic one. */
  media?: string;
  actions?: ButtonMockOptions[];
};

/** A generic landscape placeholder as an inline SVG, for drawing media in a card. */
export const cardPlaceholderMedia =
  '<svg class="et-card-mock-media" viewBox="0 0 320 140" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Placeholder image"><rect width="320" height="140" fill="#8a94a6"/><circle cx="250" cy="40" r="16" fill="#e6e9ef"/><path d="M0 140 90 60l60 50 40-30 130 60z" fill="#e6e9ef"/></svg>';

/** The stylesheets `card()` and `cardContent()` draw with: the real card and button CSS, plus the mock's content layout. */
export const cardStyles = /* @__PURE__ */ [
  buttonStyles,
  cardBase,
  `@layer components {
  .et-card-mock-media {
    display: block;
    inline-size: calc(100% + 2 * var(--et-card-padding));
    block-size: auto;
    margin: calc(-1 * var(--et-card-padding)) calc(-1 * var(--et-card-padding)) 0;
    border-start-start-radius: inherit;
    border-start-end-radius: inherit;
  }

  .et-card-mock-title {
    margin: 0;
    font-size: 1.6rem;
    font-weight: 600;
    line-height: 1.4;
  }

  .et-card-mock-subtitle {
    margin: 0.2rem 0 0;
    font-size: 1.3rem;
    color: var(--et-surface-color-muted-solid);
  }

  .et-card-mock-text {
    margin: 0;
    font-size: 1.4rem;
    line-height: 1.5;
  }

  .et-card-mock-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }
}`,
].join('\n');

/** Draws an `et-card` as the component renders it, as HTML. */
export const card = (options: CardMockOptions) => {
  const attributes = [
    options.attributes,
    `data-variant="${options.variant ?? 'outlined'}"`,
    `class="et-card et-surface--${options.surface ?? 'inherited'}"`,
  ].filter(Boolean);

  return `<et-card ${attributes.join(' ')}>${options.content}</et-card>`;
};

/** Draws typical consumer content for a card: media, a title with subtitle, text and an actions row. The SDK card ships none of these parts. */
export const cardContent = (options: CardContentMockOptions) => {
  const heading = options.title
    ? `<div><h3 class="et-card-mock-title">${options.title}</h3>${options.subtitle ? `<p class="et-card-mock-subtitle">${options.subtitle}</p>` : ''}</div>`
    : '';
  const text = options.text ? `<p class="et-card-mock-text">${options.text}</p>` : '';
  const actions = options.actions?.length
    ? `<div class="et-card-mock-actions">${options.actions.map((each) => button(each)).join('')}</div>`
    : '';

  return `${options.media ?? ''}${heading}${text}${actions}`;
};
