import { Theme } from '@ethlete/core';

export const BRAND_THEME: Theme = {
  name: 'brand',
  isDefault: true,
  primary: {
    color: {
      default: '0 255 161',
      hover: '76 247 184',
      focus: '76 247 184',
      active: '0 198 126',
      disabled: '0 122 77',
    },
    onColor: {
      default: '0 0 0',
      disabled: '0 36 23',
    },
  },
};

export const DANGER_THEME: Theme = {
  name: 'danger',
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
      disabled: '255 220 220',
    },
  },
};

export const SUCCESS_THEME: Theme = {
  name: 'success',
  primary: {
    color: {
      default: '22 163 74',
      hover: '34 197 94',
      focus: '34 197 94',
      active: '21 128 61',
      disabled: '46 111 68',
    },
    onColor: {
      default: '255 255 255',
      disabled: '221 247 231',
    },
  },
};

export const WARNING_THEME: Theme = {
  name: 'warning',
  primary: {
    color: {
      default: '217 119 6',
      hover: '245 158 11',
      focus: '245 158 11',
      active: '180 83 9',
      disabled: '133 77 14',
    },
    onColor: {
      default: '255 255 255',
      disabled: '255 237 213',
    },
  },
};

export const NEUTRAL_THEME: Theme = {
  name: 'neutral',
  primary: {
    color: {
      default: '75 85 99',
      hover: '107 114 128',
      focus: '107 114 128',
      active: '55 65 81',
      disabled: '55 65 81',
    },
    onColor: {
      default: '255 255 255',
      disabled: '209 213 219',
    },
    inkColor: {
      default: '229 231 235',
      hover: '243 244 246',
      focus: '243 244 246',
      active: '209 213 219',
      disabled: '156 163 175',
    },
  },
};

export const THEMES = [BRAND_THEME, DANGER_THEME, SUCCESS_THEME, WARNING_THEME, NEUTRAL_THEME];
