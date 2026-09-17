import { ColorTheme } from '@ethlete/core';

export const BRAND_THEME: ColorTheme = {
  name: 'brand',
  isDefault: true,
  primary: {
    color: {
      default: '142 210 187',
      hover: '166 224 203',
      focus: '166 224 203',
      active: '118 190 166',
      disabled: '62 92 82',
    },
    onColor: {
      default: '18 33 27',
      disabled: '40 62 54',
    },
    inkColor: {
      default: '166 224 203',
      hover: '192 236 220',
      focus: '192 236 220',
      active: '142 210 187',
      disabled: '78 110 98',
    },
  },
};

export const DANGER_THEME: ColorTheme = {
  name: 'danger',
  type: 'error',
  primary: {
    color: {
      default: '220 38 38',
      hover: '239 68 68',
      focus: '239 68 68',
      active: '185 28 28',
      disabled: '120 52 52',
    },
    onColor: {
      default: '255 255 255',
      disabled: '190 170 170',
    },
    inkColor: {
      default: '248 113 113',
      hover: '252 165 165',
      focus: '252 165 165',
      active: '239 68 68',
      disabled: '130 80 80',
    },
  },
};

export const THEMES = [BRAND_THEME, DANGER_THEME];
