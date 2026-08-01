import { IconDefinition } from './icon-provider';

const svg = (path: string) =>
  `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
      <path
        d="${path}"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  `;

// U-turn arrows: the arrow head, then the line running into the half-circle it turns around.
export const UNDO_ICON: IconDefinition = {
  name: 'et-undo',
  data: /* @__PURE__ */ svg('M9.5 15 4.5 10l5-5M4.5 10h9a5.5 5.5 0 0 1 0 11h-3'),
};

export const REDO_ICON: IconDefinition = {
  name: 'et-redo',
  data: /* @__PURE__ */ svg('M14.5 15l5-5-5-5M19.5 10h-9a5.5 5.5 0 0 0 0 11h3'),
};
