import { ColorTheme } from '@ethlete/core';

export const BRAND_THEME: ColorTheme = {
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
      default: '229 229 229',
      hover: '245 245 245',
      focus: '245 245 245',
      active: '212 212 212',
      disabled: '161 161 161',
    },
  },
};

export const NEUTRAL_DARK_THEME: ColorTheme = {
  name: 'neutral-dark',
  primary: {
    color: {
      default: '23 23 23',
      hover: '38 38 38',
      focus: '38 38 38',
      active: '10 10 10',
      disabled: '64 64 64',
    },
    onColor: {
      default: '255 255 255',
      disabled: '212 212 212',
    },
    inkColor: {
      default: '23 23 23',
      hover: '38 38 38',
      focus: '38 38 38',
      active: '10 10 10',
      disabled: '115 115 115',
    },
  },
};

export const CHART_BLUE_THEME: ColorTheme = {
  name: 'chart-blue',
  primary: {
    color: {
      default: '42 120 214',
      hover: '42 120 214',
      focus: '42 120 214',
      active: '42 120 214',
      disabled: '42 120 214',
    },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const CHART_ORANGE_THEME: ColorTheme = {
  name: 'chart-orange',
  primary: {
    color: {
      default: '235 104 52',
      hover: '235 104 52',
      focus: '235 104 52',
      active: '235 104 52',
      disabled: '235 104 52',
    },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const CHART_AQUA_THEME: ColorTheme = {
  name: 'chart-aqua',
  primary: {
    color: {
      default: '27 175 122',
      hover: '27 175 122',
      focus: '27 175 122',
      active: '27 175 122',
      disabled: '27 175 122',
    },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const CHART_YELLOW_THEME: ColorTheme = {
  name: 'chart-yellow',
  primary: {
    color: { default: '237 161 0', hover: '237 161 0', focus: '237 161 0', active: '237 161 0', disabled: '237 161 0' },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const CHART_BLUE_DARK_THEME: ColorTheme = {
  name: 'chart-blue-dark',
  primary: {
    color: {
      default: '57 135 229',
      hover: '57 135 229',
      focus: '57 135 229',
      active: '57 135 229',
      disabled: '57 135 229',
    },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const CHART_ORANGE_DARK_THEME: ColorTheme = {
  name: 'chart-orange-dark',
  primary: {
    color: { default: '217 89 38', hover: '217 89 38', focus: '217 89 38', active: '217 89 38', disabled: '217 89 38' },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const CHART_AQUA_DARK_THEME: ColorTheme = {
  name: 'chart-aqua-dark',
  primary: {
    color: {
      default: '25 158 112',
      hover: '25 158 112',
      focus: '25 158 112',
      active: '25 158 112',
      disabled: '25 158 112',
    },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const CHART_YELLOW_DARK_THEME: ColorTheme = {
  name: 'chart-yellow-dark',
  primary: {
    color: { default: '201 133 0', hover: '201 133 0', focus: '201 133 0', active: '201 133 0', disabled: '201 133 0' },
    onColor: { default: '255 255 255', disabled: '255 255 255' },
  },
};

export const THEMES = [
  BRAND_THEME,
  DANGER_THEME,
  SUCCESS_THEME,
  WARNING_THEME,
  NEUTRAL_THEME,
  NEUTRAL_DARK_THEME,
  CHART_BLUE_THEME,
  CHART_ORANGE_THEME,
  CHART_AQUA_THEME,
  CHART_YELLOW_THEME,
  CHART_BLUE_DARK_THEME,
  CHART_ORANGE_DARK_THEME,
  CHART_AQUA_DARK_THEME,
  CHART_YELLOW_DARK_THEME,
];
