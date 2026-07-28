import { IconDefinition } from './icon-provider';

/** Arrows pointing apart along the inline axis — a "fit to width" action (the table's autosize). */
export const ARROWS_LEFT_RIGHT_ICON: IconDefinition = {
  name: 'et-arrows-left-right',
  data: `
    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
      <path
        d="M3.5 12h17"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M8 7.5L3.5 12 8 16.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
      <path
        d="M16 7.5L20.5 12 16 16.5"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `,
};
