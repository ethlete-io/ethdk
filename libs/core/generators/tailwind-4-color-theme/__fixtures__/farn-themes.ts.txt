import { ColorTheme } from '@ethlete/core';

export const FARN_THEME: ColorTheme = {
  name: 'farn' as ColorTheme['name'],
  isDefault: true,
  primary: {
    color: {
      default: '47 107 71',
      hover: '58 125 84',
      focus: '58 125 84',
      active: '36 88 58',
      disabled: '156 172 158',
    },
    onColor: {
      default: '247 243 233',
      disabled: '236 232 220',
    },
    inkColor: {
      default: '41 98 63',
      hover: '41 98 63',
      focus: '41 98 63',
      active: '41 98 63',
      disabled: '140 156 142',
    },
  },
};

export const THEMES = [FARN_THEME];
