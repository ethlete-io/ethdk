import { IconDefinition } from './icon-provider';

const svg = (lines: string) =>
  `<svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="none"
    stroke="currentColor" stroke-width="1.4" stroke-linecap="round">${lines}</svg>`;

// Custom icons — horizontal rules representing text-align.
export const ALIGN_LEFT_ICON: IconDefinition = {
  name: 'et-align-left',
  data: /* @__PURE__ */ svg(`<line x1="2.5" y1="4" x2="13.5" y2="4"/><line x1="2.5" y1="8" x2="9.5" y2="8"/>
    <line x1="2.5" y1="12" x2="12" y2="12"/>`),
};

export const ALIGN_CENTER_ICON: IconDefinition = {
  name: 'et-align-center',
  data: /* @__PURE__ */ svg(`<line x1="2.5" y1="4" x2="13.5" y2="4"/><line x1="4.5" y1="8" x2="11.5" y2="8"/>
    <line x1="3.5" y1="12" x2="12.5" y2="12"/>`),
};

export const ALIGN_RIGHT_ICON: IconDefinition = {
  name: 'et-align-right',
  data: /* @__PURE__ */ svg(`<line x1="2.5" y1="4" x2="13.5" y2="4"/><line x1="6.5" y1="8" x2="13.5" y2="8"/>
    <line x1="4" y1="12" x2="13.5" y2="12"/>`),
};

export const ALIGN_JUSTIFY_ICON: IconDefinition = {
  name: 'et-align-justify',
  data: /* @__PURE__ */ svg(`<line x1="2.5" y1="4" x2="13.5" y2="4"/><line x1="2.5" y1="8" x2="13.5" y2="8"/>
    <line x1="2.5" y1="12" x2="13.5" y2="12"/>`),
};
