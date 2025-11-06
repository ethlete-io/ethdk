import { InjectionToken } from '@angular/core';
import { ComboboxConfig } from '../types';

export const COMBOBOX_CONFIG_TOKEN = new InjectionToken<ComboboxConfig>('COMBOBOX_CONFIG_TOKEN');

export const COMBOBOX_DEFAULT_CONFIG = {
  bodyEmptyText: 'No results found',
} satisfies ComboboxConfig;
