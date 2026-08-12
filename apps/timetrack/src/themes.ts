import { ColorTheme } from '@ethlete/core';

export const BRAND_THEME: ColorTheme = {
  name: 'brand',
  isDefault: true,
  primary: {
    color: {
      default: '61 214 140',
      hover: '90 226 160',
      focus: '90 226 160',
      active: '42 178 114',
      disabled: '34 96 68',
    },
    onColor: {
      default: '10 20 16',
      disabled: '20 46 34',
    },
    inkColor: {
      default: '90 226 160',
      hover: '124 236 180',
      focus: '124 236 180',
      active: '61 214 140',
      disabled: '52 112 84',
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
      disabled: '255 220 220',
    },
    inkColor: {
      default: '248 113 113',
      hover: '252 165 165',
      focus: '252 165 165',
      active: '239 68 68',
      disabled: '150 80 80',
    },
  },
};

export const SUCCESS_THEME: ColorTheme = {
  name: 'success',
  type: 'success',
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
    inkColor: {
      default: '74 222 128',
      hover: '134 239 172',
      focus: '134 239 172',
      active: '34 197 94',
      disabled: '60 120 80',
    },
  },
};

export const WARNING_THEME: ColorTheme = {
  name: 'warning',
  type: 'warning',
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
    inkColor: {
      default: '251 191 36',
      hover: '253 224 71',
      focus: '253 224 71',
      active: '245 158 11',
      disabled: '140 100 30',
    },
  },
};

export const NEUTRAL_THEME: ColorTheme = {
  name: 'neutral',
  primary: {
    color: {
      default: '82 82 82',
      hover: '115 115 115',
      focus: '115 115 115',
      active: '64 64 64',
      disabled: '64 64 64',
    },
    onColor: {
      default: '255 255 255',
      disabled: '212 212 212',
    },
    inkColor: {
      default: '212 212 212',
      hover: '245 245 245',
      focus: '245 245 245',
      active: '161 161 161',
      disabled: '115 115 115',
    },
  },
};

export const THEMES = [BRAND_THEME, DANGER_THEME, SUCCESS_THEME, WARNING_THEME, NEUTRAL_THEME];
