import { IconDefinition } from '../src/lib/icon/headless/icon-definition';

/** Draws `<i etIcon>` as the icon directive renders it: the icon's classes around its trimmed SVG. */
export const iconMarkup = (icon: IconDefinition, className?: string) => {
  const base = `et-icon et-icon--${icon.name}`;
  const classes = [className, base, icon.variant ? `${base}--${icon.variant}` : undefined].filter(Boolean).join(' ');

  return `<i etIcon="${icon.name}" aria-hidden="true" class="${classes}">${icon.data.trim()}</i>`;
};
