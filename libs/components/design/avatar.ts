import avatarBase from '../src/lib/avatar/avatar.component.css?inline';
import avatarGroupBase from '../src/lib/avatar/avatar-group.component.css?inline';
import iconBase from '../src/lib/icon/headless/icon-styles.component.css?inline';
import { IconDefinition } from '../src/lib/icon/headless/icon-definition';
import { iconMarkup } from './icon';

export type AvatarMockOptions = {
  /** Image URL. Keep it a data URI in a drawing. */
  src?: string;
  name?: string;
  initials?: string;
  /** Projected content, shown when there is no image and no initials. */
  icon?: IconDefinition;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  shape?: 'circle' | 'square';
  /** A color theme name the app registers. Left out, the avatar takes the color theme around it. */
  color?: string;
  /** Extra attributes on the avatar, e.g. design markers. */
  attributes?: string;
};

/** A generic placeholder portrait as an SVG data URI, for drawing the image form. */
export const avatarPlaceholderImage = `data:image/svg+xml,${
  /* @__PURE__ */ encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#8a94a6"/><circle cx="32" cy="25" r="11" fill="#e6e9ef"/><path d="M12 60c2-12 10-18 20-18s18 6 20 18z" fill="#e6e9ef"/></svg>',
  )
}`;

/** The stylesheets `avatar()` and `avatarGroup()` draw with: the real avatar, avatar group and icon CSS. */
export const avatarStyles = /* @__PURE__ */ [
  iconBase,
  avatarBase,
  avatarGroupBase,
  `@layer components {
  .et-avatar-mock-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
  }
}`,
].join('\n');

const initialsFromName = (name: string) => {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return (first + last).toUpperCase();
};

const avatarAttributes = (options: Pick<AvatarMockOptions, 'size' | 'shape' | 'color' | 'attributes'>, extra = '') =>
  [
    options.attributes ?? '',
    `data-size="${options.size ?? 'md'}"`,
    `data-shape="${options.shape ?? 'circle'}"`,
    `class="${extra}et-avatar et-color--${options.color ?? 'inherited'}"`,
  ]
    .filter(Boolean)
    .join(' ');

/** Draws an `et-avatar` as the component renders it, as HTML: image, else initials, else the icon. */
export const avatar = (options: AvatarMockOptions) => {
  const initials = options.initials ?? (options.name ? initialsFromName(options.name) : '');
  const content = options.src
    ? `<img src="${options.src}" alt="${options.name ?? ''}" class="et-avatar-image" />`
    : initials
      ? `<span${options.name ? ` role="img" aria-label="${options.name}"` : ''} class="et-avatar-initials">${initials}</span>`
      : options.icon
        ? iconMarkup(options.icon)
        : '';

  return `<et-avatar ${avatarAttributes(options)}>${content}</et-avatar>`;
};

/** Draws an `et-avatar-group`: the avatars past `maxVisible` hidden and counted into a trailing `+N` avatar. */
export const avatarGroup = (avatars: AvatarMockOptions[], maxVisible?: number) => {
  const visible = maxVisible === undefined ? avatars : avatars.slice(0, Math.max(maxVisible, 0));
  const overflow = avatars.length - visible.length;
  const first = avatars[0] ?? {};
  const more =
    overflow > 0
      ? `<et-avatar ${avatarAttributes({ size: first.size, shape: first.shape }, 'et-avatar-group-overflow ')} role="img" aria-label="${overflow} more">+${overflow}</et-avatar>`
      : '';

  return `<et-avatar-group class="et-avatar-group">${visible.map((each) => avatar(each)).join('')}${more}</et-avatar-group>`;
};

/** Draws avatars or groups in a wrapping row. */
export const avatarRow = (items: string[]) => `<div class="et-avatar-mock-row">${items.join('')}</div>`;
