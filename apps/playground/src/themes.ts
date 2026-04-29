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
      disabled: '142 142 142',
    },
    onColor: {
      default: '0 0 0',
    },
  },
};

export const DANGER_THEME: Theme = {
  name: 'danger',
  primary: {
    color: {
      default: '220 38 38',
      hover: '185 28 28',
      focus: '153 27 27',
      active: '153 27 27',
      disabled: '252 165 165',
    },
    onColor: {
      default: '255 255 255',
    },
  },
};

export const SUCCESS_THEME: Theme = {
  name: 'success',
  primary: {
    color: {
      default: '22 163 74',
      hover: '21 128 61',
      focus: '20 83 45',
      active: '20 83 45',
      disabled: '134 239 172',
    },
    onColor: {
      default: '255 255 255',
    },
  },
};

export const WARNING_THEME: Theme = {
  name: 'warning',
  primary: {
    color: {
      default: '217 119 6',
      hover: '180 83 9',
      focus: '146 64 14',
      active: '146 64 14',
      disabled: '253 230 138',
    },
    onColor: {
      default: '255 255 255',
    },
  },
};

export const NEUTRAL_THEME: Theme = {
  name: 'neutral',
  primary: {
    color: {
      default: '75 85 99',
      hover: '55 65 81',
      focus: '31 41 55',
      active: '31 41 55',
      disabled: '209 213 219',
    },
    onColor: {
      default: '255 255 255',
    },
  },
};

export const THEMES = [BRAND_THEME, DANGER_THEME, SUCCESS_THEME, WARNING_THEME, NEUTRAL_THEME];
